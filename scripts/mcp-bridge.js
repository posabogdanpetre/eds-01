/**
 * MCPBridge — Lightweight SDK for the MCP Apps protocol.
 *
 * Implements the ui/* JSON-RPC 2.0 over postMessage bridge between
 * a widget (iframe) and its host (ChatGPT, Claude, VS Code, etc.).
 *
 * Zero dependencies. Works in any browser context.
 * Promise-only API — no callback subscriptions.
 *
 * Spec:  https://modelcontextprotocol.github.io/ext-apps
 * Ref:   https://developers.openai.com/apps-sdk/reference
 *
 * Protocol methods implemented:
 *   ui/initialize                  → bridge.connect()
 *   ui/notifications/initialized   → (automatic after connect)
 *   ui/notifications/tool-result   → bridge.toolResult   (Promise)
 *   ui/notifications/tool-input    → bridge.toolInput    (Promise)
 *   tools/call                     → bridge.callTool(name, args)
 *   ui/message                     → bridge.sendMessage(text)
 *   ui/update-model-context        → bridge.updateModelContext(text)
 *
 * @example
 *   import { MCPBridge } from './mcp-bridge.js';
 *
 *   const bridge = new MCPBridge();
 *   await bridge.connect();
 *
 *   const result = await bridge.toolResult;
 *   renderUI(result.structuredContent);
 */

const PROTOCOL_VERSION = '2026-01-26';
const LOG_PREFIX = '[MCPBridge]';

// ---------------------------------------------------------------
// MCPBridge
// ---------------------------------------------------------------
export class MCPBridge {
  constructor() {
    this._appInfo = { name: 'LLMApps', version: '1.0.0' };
    this._capabilities = {};
    this._target = typeof window !== 'undefined' ? window.parent : null;
    this._targetOrigin = '*';

    // State
    this._rpcId = 0;
    this._pendingRequests = new Map();
    this._connected = false;
    this._destroyed = false;
    this._messageHandler = null;

    // One-shot promises — one tool-result per widget lifecycle
    this._toolResultResolve = null;
    /** Promise that resolves with the `ui/notifications/tool-result` params. */
    this.toolResult = new Promise((resolve) => {
      this._toolResultResolve = resolve;
    });

    this._toolInputResolve = null;
    /** Promise that resolves with the `ui/notifications/tool-input` params. */
    this.toolInput = new Promise((resolve) => {
      this._toolInputResolve = resolve;
    });

    // Locale (standard: document.documentElement.lang)
    this._locale = typeof document !== 'undefined'
      ? document.documentElement.lang || 'en'
      : 'en';
  }

  // ---------------------------------------------------------------
  // Properties
  // ---------------------------------------------------------------

  /** Whether this code is running inside an iframe. */
  get isEmbedded() {
    return typeof window !== 'undefined' && window.parent !== window;
  }

  /** Whether the ui/initialize handshake has completed. */
  get isConnected() {
    return this._connected;
  }

  /** Current locale (from document.documentElement.lang). */
  get locale() {
    return this._locale;
  }

  // ---------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------

  /**
   * Connect to the host — starts listening and performs the ui/initialize
   * handshake. Resolves when the host acknowledges.
   *
   * Safe to call when not embedded (returns immediately, isConnected = false).
   *
   * @returns {Promise<MCPBridge>} this instance (for chaining)
   */
  async connect() {
    if (this._destroyed) throw new Error(`${LOG_PREFIX} Bridge is destroyed`);

    this._startListening();

    if (!this.isEmbedded) {
      // eslint-disable-next-line no-console
      console.log(`${LOG_PREFIX} Not in iframe — bridge in standalone mode`);
      return this;
    }

    try {
      await this.request('ui/initialize', {
        appInfo: this._appInfo,
        appCapabilities: this._capabilities,
        protocolVersion: PROTOCOL_VERSION,
      });
      this.notify('ui/notifications/initialized', {});
      this._connected = true;
      // eslint-disable-next-line no-console
      console.log(`${LOG_PREFIX} Connected`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`${LOG_PREFIX} Handshake failed:`, err);
    }

    return this;
  }

  /** Stop listening and clean up. */
  destroy() {
    this._destroyed = true;
    this._connected = false;
    if (this._messageHandler && typeof window !== 'undefined') {
      window.removeEventListener('message', this._messageHandler);
      this._messageHandler = null;
    }
    this._pendingRequests.forEach(({ reject }) => reject(new Error('Bridge destroyed')));
    this._pendingRequests.clear();
  }

  // ---------------------------------------------------------------
  // Actions — sending to host
  // ---------------------------------------------------------------

  /**
   * Call an MCP tool from the UI.
   * @param {string} name - Tool name
   * @param {Object} [args] - Tool arguments
   * @returns {Promise<Object>} Tool result { content, structuredContent }
   */
  async callTool(name, args = {}) {
    return this.request('tools/call', { name, arguments: args });
  }

  /**
   * Post a follow-up message in the conversation.
   * @param {string} text - Message text
   * @param {string} [role='user'] - Message role
   */
  sendMessage(text, role = 'user') {
    this.notify('ui/message', {
      role,
      content: [{ type: 'text', text }],
    });
  }

  /**
   * Update model-visible context from the UI.
   * @param {string} text - Context description
   * @returns {Promise<Object>} Host response
   */
  async updateModelContext(text) {
    return this.request('ui/update-model-context', {
      content: [{ type: 'text', text }],
    });
  }

  // ---------------------------------------------------------------
  // Low-level JSON-RPC
  // ---------------------------------------------------------------

  /**
   * Send a JSON-RPC request (has id, expects response).
   * @param {string} method
   * @param {Object} [params]
   * @returns {Promise<any>} result
   */
  request(method, params) {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line no-plusplus
      const id = ++this._rpcId;
      this._pendingRequests.set(id, { resolve, reject });
      this._send({ jsonrpc: '2.0', id, method, params });
    });
  }

  /**
   * Send a JSON-RPC notification (no id, fire-and-forget).
   * @param {string} method
   * @param {Object} [params]
   */
  notify(method, params) {
    this._send({ jsonrpc: '2.0', method, params });
  }

  // ---------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------

  _send(message) {
    if (!this._target) return;
    this._target.postMessage(message, this._targetOrigin);
  }

  _startListening() {
    if (this._messageHandler || typeof window === 'undefined') return;

    this._messageHandler = (event) => {
      // Only accept from our target (host / parent)
      if (this._target && event.source !== this._target) return;

      const msg = event.data;
      if (!msg || msg.jsonrpc !== '2.0') return;

      // --- JSON-RPC responses (to our requests) ---
      if (typeof msg.id === 'number' || typeof msg.id === 'string') {
        const pending = this._pendingRequests.get(msg.id);
        if (!pending) return;
        this._pendingRequests.delete(msg.id);
        if (msg.error) {
          pending.reject(msg.error);
        } else {
          pending.resolve(msg.result);
        }
        return;
      }

      // --- JSON-RPC notifications from the host ---
      if (typeof msg.method !== 'string') return;

      if (msg.method === 'ui/notifications/tool-result') {
        // eslint-disable-next-line no-console
        console.log(`${LOG_PREFIX} tool-result received`);
        if (this._toolResultResolve) {
          this._toolResultResolve(msg.params);
          this._toolResultResolve = null;
        }
      }

      if (msg.method === 'ui/notifications/tool-input') {
        // eslint-disable-next-line no-console
        console.log(`${LOG_PREFIX} tool-input received`);
        if (this._toolInputResolve) {
          this._toolInputResolve(msg.params);
          this._toolInputResolve = null;
        }
      }
    };

    window.addEventListener('message', this._messageHandler, { passive: true });
  }
}

// ---------------------------------------------------------------
// Factory (convenience for one-liner setup)
// ---------------------------------------------------------------

/**
 * Create and connect a bridge in one call.
 *
 * @example
 *   const bridge = await createBridge();
 *   const result = await bridge.toolResult;
 *
 * @returns {Promise<MCPBridge>}
 */
export async function createBridge() {
  const bridge = new MCPBridge();
  await bridge.connect();
  return bridge;
}

export default MCPBridge;
