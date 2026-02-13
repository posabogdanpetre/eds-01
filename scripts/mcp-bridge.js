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
 * ── Standard protocol ──────────────────────────────────────────
 *   ui/initialize                  → bridge.connect()
 *   ui/notifications/initialized   → (automatic after connect)
 *   ui/notifications/tool-result   → bridge.toolResult   (Promise)
 *   ui/notifications/tool-input    → bridge.toolInput    (Promise)
 *   tools/call                     → bridge.callTool(name, args)
 *   ui/message                     → bridge.sendMessage(text)
 *   ui/update-model-context        → bridge.updateModelContext(text)
 *
 * ── Vendor extensions (auto-detected) ──────────────────────────
 *   bridge.host                    → 'chatgpt' | 'claude' | 'unknown'
 *   bridge.chatgpt                 → ChatGPT extensions (or null)
 *     .theme / .locale / .displayMode / .maxHeight / .safeArea
 *     .widgetState / .setWidgetState(state)
 *     .uploadFile(file) / .getFileDownloadUrl({ fileId })
 *     .requestDisplayMode(opts) / .requestModal(opts) / .requestClose()
 *     .openExternal(opts) / .requestCheckout(opts)
 *     .watchContext(callback)      → observe theme/locale changes
 *
 * @example
 *   import { MCPBridge } from './mcp-bridge.js';
 *
 *   const bridge = new MCPBridge();
 *   await bridge.connect();
 *
 *   // Standard protocol
 *   const result = await bridge.toolResult;
 *   renderUI(result.structuredContent);
 *
 *   // ChatGPT extensions (auto-detected)
 *   if (bridge.chatgpt) {
 *     console.log(bridge.chatgpt.theme);   // 'dark'
 *     const stop = bridge.chatgpt.watchContext(ctx => {
 *       document.body.dataset.theme = ctx.theme;
 *     });
 *   }
 */

const PROTOCOL_VERSION = '2026-01-26';
const LOG_PREFIX = '[MCPBridge]';

// ---------------------------------------------------------------
// Vendor Extensions — ChatGPT  (window.openai)
// ---------------------------------------------------------------

/**
 * Thin wrapper around ChatGPT's `window.openai` runtime.
 * Feature-detects every call — safe to use even when a method
 * doesn't exist on the current host version.
 *
 * @private — accessed via `bridge.chatgpt`, never instantiated directly.
 */
class ChatGPTExtensions {
  /** @param {object} api — reference to `window.openai` */
  constructor(api) {
    this._api = api;
    this._watchers = [];
    this._pollId = null;
    this._prev = null;
  }

  // --- Context (read-only) ------------------------------------

  /** Host colour scheme. @returns {'light'|'dark'|null} */
  get theme() { return this._api.theme ?? null; }

  /** User locale (BCP 47). @returns {string|null} */
  get locale() { return this._api.locale ?? null; }

  /** Current display mode. @returns {'inline'|'pip'|'fullscreen'|null} */
  get displayMode() { return this._api.displayMode ?? null; }

  /** Widget max-height in pixels. @returns {number|null} */
  get maxHeight() { return this._api.maxHeight ?? null; }

  /** Safe-area insets { top, bottom, left, right }. @returns {object|null} */
  get safeArea() { return this._api.safeArea ?? null; }

  /** Current view identifier. @returns {string|null} */
  get view() { return this._api.view ?? null; }

  /** Host user-agent string. @returns {string|null} */
  get userAgent() { return this._api.userAgent ?? null; }

  // --- State persistence --------------------------------------

  /** Persisted UI state snapshot. */
  get widgetState() { return this._api.widgetState ?? null; }

  /** Persist a new UI state snapshot (synchronous, host persists async). */
  setWidgetState(state) { this._api.setWidgetState?.(state); }

  // --- File APIs ----------------------------------------------

  /**
   * Upload a file and receive a `fileId`.
   * Supports image/png, image/jpeg, image/webp.
   * @param {File} file
   * @returns {Promise<{ fileId: string }>}
   */
  uploadFile(file) { return this._call('uploadFile', file); }

  /**
   * Get a temporary download URL for a file.
   * @param {{ fileId: string }} opts
   * @returns {Promise<{ downloadUrl: string }>}
   */
  getFileDownloadUrl(opts) { return this._call('getFileDownloadUrl', opts); }

  // --- UI Control ---------------------------------------------

  /**
   * Request a display mode change.
   * @param {{ mode: 'inline'|'pip'|'fullscreen' }} opts
   * @returns {Promise<void>}
   */
  requestDisplayMode(opts) { return this._call('requestDisplayMode', opts); }

  /**
   * Open a host-controlled modal, optionally targeting another
   * registered template URI.
   * @param {{ template?: string, params?: object }} [opts]
   * @returns {Promise<void>}
   */
  requestModal(opts) { return this._call('requestModal', opts); }

  /** Close this widget. */
  requestClose() { this._api.requestClose?.(); }

  /**
   * Open Instant Checkout (when enabled).
   * @param {object} opts — checkout payload
   * @returns {Promise<void>}
   */
  requestCheckout(opts) { return this._call('requestCheckout', opts); }

  /**
   * Open a vetted external link in the user's browser.
   * @param {{ href: string }} opts
   */
  openExternal(opts) { this._api.openExternal?.(opts); }

  /**
   * Set the "Open in <App>" URL shown in fullscreen mode.
   * @param {{ href: string }} opts
   */
  setOpenInAppUrl(opts) { this._api.setOpenInAppUrl?.(opts); }

  /**
   * Report dynamic widget height to avoid scroll clipping.
   * @param {number|object} heightOrOpts
   */
  notifyIntrinsicHeight(heightOrOpts) {
    this._api.notifyIntrinsicHeight?.(heightOrOpts);
  }

  // --- Context observation ------------------------------------

  /**
   * Watch for changes in host context (theme, locale, displayMode, maxHeight).
   * Polls at the given interval and fires `callback(snapshot)` on change.
   *
   * @param {function} callback — receives { theme, locale, displayMode, maxHeight }
   * @param {number} [interval=500] — polling interval in ms
   * @returns {function} unsubscribe — call it to stop watching
   *
   * @example
   *   const stop = bridge.chatgpt.watchContext(ctx => {
   *     document.body.dataset.theme = ctx.theme;
   *   });
   *   // later: stop();
   */
  watchContext(callback, interval = 500) {
    this._watchers.push(callback);
    if (!this._pollId) {
      this._prev = JSON.stringify(this._snap());
      this._pollId = setInterval(() => {
        const snap = this._snap();
        const json = JSON.stringify(snap);
        if (json !== this._prev) {
          this._prev = json;
          this._watchers.forEach((fn) => fn(snap));
        }
      }, interval);
    }
    return () => {
      this._watchers = this._watchers.filter((fn) => fn !== callback);
      if (!this._watchers.length) {
        clearInterval(this._pollId);
        this._pollId = null;
      }
    };
  }

  // --- Internal -----------------------------------------------

  /** @private */
  _call(method, ...args) {
    const fn = this._api[method];
    if (!fn) {
      return Promise.reject(new Error(`chatgpt.${method} is not available`));
    }
    return fn.apply(this._api, args);
  }

  /** @private */
  _snap() {
    return {
      theme: this.theme,
      locale: this.locale,
      displayMode: this.displayMode,
      maxHeight: this.maxHeight,
    };
  }

  /** @private */
  destroy() {
    clearInterval(this._pollId);
    this._pollId = null;
    this._watchers = [];
  }
}

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

    // Vendor extensions (lazy-initialised on first access)
    this._chatgpt = undefined;
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

  /**
   * Detected host name.
   * @returns {'chatgpt'|'claude'|'unknown'|null}
   */
  get host() {
    if (typeof window === 'undefined') return null;
    if (window.openai) return 'chatgpt';
    try {
      if (window.location.origin.includes('claudemcpcontent.com')) return 'claude';
    } catch { /* cross-origin access may throw */ }
    return 'unknown';
  }

  /**
   * ChatGPT vendor extensions (via `window.openai`).
   * Returns `null` when not running inside ChatGPT.
   *
   * @returns {ChatGPTExtensions|null}
   */
  get chatgpt() {
    if (this._chatgpt === undefined) {
      const api = typeof window !== 'undefined' ? window.openai : null;
      this._chatgpt = api ? new ChatGPTExtensions(api) : null;
    }
    return this._chatgpt;
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
      console.log(`${LOG_PREFIX} Connected (host: ${this.host})`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`${LOG_PREFIX} Handshake failed:`, err);
    }

    return this;
  }

  /** Stop listening and clean up (including vendor extensions). */
  destroy() {
    this._destroyed = true;
    this._connected = false;
    if (this._messageHandler && typeof window !== 'undefined') {
      window.removeEventListener('message', this._messageHandler);
      this._messageHandler = null;
    }
    this._pendingRequests.forEach(({ reject }) => reject(new Error('Bridge destroyed')));
    this._pendingRequests.clear();
    if (this._chatgpt && this._chatgpt.destroy) this._chatgpt.destroy();
  }

  // ---------------------------------------------------------------
  // Actions — sending to host (standard protocol)
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
   * @returns {Promise<Object>} Host response
   */
  async sendMessage(text) {
    return this.request('ui/message', {
      role: 'user',
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
