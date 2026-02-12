/*
 * AEM Embed WebComponent — MCP Apps Standard Bridge
 * Include content from one AEM EDS page in any MCP Apps host (ChatGPT, Claude, etc.)
 *
 * Protocol: JSON-RPC 2.0 over postMessage (ui/* methods)
 * Spec: https://modelcontextprotocol.github.io/ext-apps
 * Ref:  https://developers.openai.com/apps-sdk/reference
 *
 * No proprietary APIs (window.openai), no CDN SDK dependencies.
 */

// eslint-disable-next-line import/prefer-default-export
export class AEMEmbed extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.initialized = false;

    window.hlx = window.hlx || {};
    window.hlx.suppressLoadPage = true;
    [window.hlx.codeBasePath] = new URL(import.meta.url).pathname.split('/scripts/');

    // ---------------------------------------------------------------
    // MCP Apps bridge state
    // ---------------------------------------------------------------
    this._rpcId = 0;
    this._pendingRequests = new Map();
    this._themeCallbacks = [];

    // Whether we are running inside a host iframe (ChatGPT, etc.)
    this._isEmbedded = window.parent !== window;

    // Promise that resolves when ui/notifications/tool-result arrives
    this._toolResultResolve = null;
    this._toolResultPromise = new Promise((resolve) => {
      this._toolResultResolve = resolve;
    });

    // Start listening for host messages immediately
    if (this._isEmbedded) {
      this._setupMessageListener();
    }
  }

  // ---------------------------------------------------------------
  // JSON-RPC helpers
  // ---------------------------------------------------------------

  /** Send a JSON-RPC notification (no response expected). */
  _rpcNotify(method, params) {
    window.parent.postMessage({ jsonrpc: '2.0', method, params }, '*');
  }

  /** Send a JSON-RPC request and return a Promise for the response. */
  _rpcRequest(method, params) {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line no-plusplus
      const id = ++this._rpcId;
      this._pendingRequests.set(id, { resolve, reject });
      window.parent.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
    });
  }

  // ---------------------------------------------------------------
  // postMessage listener — handles all host → widget messages
  // ---------------------------------------------------------------

  _setupMessageListener() {
    window.addEventListener('message', (event) => {
      // Only accept messages from the host (parent frame)
      if (event.source !== window.parent) return;

      const msg = event.data;
      if (!msg || msg.jsonrpc !== '2.0') return;

      // --- Handle JSON-RPC responses (to our rpcRequest calls) ---
      if (typeof msg.id === 'number') {
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

      // --- Handle JSON-RPC notifications from the host ---
      if (typeof msg.method !== 'string') return;

      if (msg.method === 'ui/notifications/tool-result') {
        // eslint-disable-next-line no-console
        console.log('[AEM Embed] Received tool-result');
        if (this._toolResultResolve) {
          this._toolResultResolve(msg.params);
          this._toolResultResolve = null;
        }
      }

      if (msg.method === 'ui/notifications/tool-input') {
        // eslint-disable-next-line no-console
        console.log('[AEM Embed] Received tool-input', msg.params);
      }
    }, { passive: true });
  }

  // ---------------------------------------------------------------
  // MCP Apps bridge handshake (ui/initialize)
  // ---------------------------------------------------------------

  async _initializeBridge() {
    if (!this._isEmbedded) {
      // eslint-disable-next-line no-console
      console.log('[AEM Embed] Not in iframe — bridge skipped');
      return;
    }

    try {
      await this._rpcRequest('ui/initialize', {
        appInfo: { name: 'AEMEmbed', version: '2.0.0' },
        appCapabilities: {},
        protocolVersion: '2026-01-26',
      });
      this._rpcNotify('ui/notifications/initialized', {});
      // eslint-disable-next-line no-console
      console.log('[AEM Embed] MCP Apps bridge initialized');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[AEM Embed] Bridge init failed:', err);
    }
  }

  // ---------------------------------------------------------------
  // Block loading — passes tool data & theme to block decorate()
  // ---------------------------------------------------------------

  // eslint-disable-next-line class-methods-use-this
  async loadBlock(body, block, blockName, origin) {
    const blockCss = `${origin}${window.hlx.codeBasePath}/blocks/${blockName}/${blockName}.css`;
    if (!body.querySelector(`link[href="${blockCss}"]`)) {
      const link = document.createElement('link');
      link.setAttribute('rel', 'stylesheet');
      link.setAttribute('href', blockCss);

      const cssLoaded = new Promise((resolve) => {
        link.onload = resolve;
        link.onerror = resolve;
      });

      body.appendChild(link);
      // eslint-disable-next-line no-await-in-loop
      await cssLoaded;
    }

    try {
      const blockScriptUrl = `${origin}${window.hlx.codeBasePath}/blocks/${blockName}/${blockName}.js`;
      // eslint-disable-next-line no-await-in-loop
      const decorateBlock = await import(blockScriptUrl);
      if (decorateBlock.default) {
        // --- onDataLoaded: resolves with ui/notifications/tool-result params ---
        const onDataLoaded = this._isEmbedded
          ? this._toolResultPromise
          : Promise.resolve({ structuredContent: {} }); // Fallback for standalone testing

        // --- onThemeChanged: query param override or default ---
        const onThemeChanged = (callback) => {
          const urlParams = new URLSearchParams(window.location.search);
          const themeParam = urlParams.get('theme');

          // Apply initial theme
          callback(themeParam || 'light');

          // Track callback for future theme updates
          if (!themeParam) {
            this._themeCallbacks.push(callback);
          }
        };

        // eslint-disable-next-line no-await-in-loop
        await decorateBlock.default(block, onDataLoaded, onThemeChanged);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('[AEM Embed] Error loading block:', blockName, e);
    }
  }

  // ---------------------------------------------------------------
  // Content handlers (header, footer, main)
  // ---------------------------------------------------------------

  async handleHeader(htmlText, body, origin) {
    await this.pseudoDecorateMain(htmlText, body, origin);

    const main = body.querySelector('main');
    const header = document.createElement('header');
    body.append(header);
    const { buildBlock } = await import(`${origin}${window.hlx.codeBasePath}/scripts/aem.js`);
    const block = buildBlock('header', '');
    header.append(block);

    const cell = block.firstElementChild.firstElementChild;
    const nav = document.createElement('nav');
    cell.append(nav);
    while (main.firstElementChild) nav.append(main.firstElementChild);
    main.remove();

    await this.loadBlock(body, block, 'header', origin);

    block.dataset.blockStatus = 'loaded';

    body.style.height = 'var(--nav-height)';
    body.classList.add('appear');
  }

  async handleFooter(htmlText, body, origin) {
    await this.pseudoDecorateMain(htmlText, body, origin);

    const main = body.querySelector('main');
    const footer = document.createElement('footer');
    body.append(footer);
    const { buildBlock } = await import(`${origin}${window.hlx.codeBasePath}/scripts/aem.js`);
    const block = buildBlock('footer', '');
    footer.append(block);

    const cell = block.firstElementChild.firstElementChild;
    const nav = document.createElement('nav');
    cell.append(nav);
    while (main.firstElementChild) nav.append(main.firstElementChild);
    main.remove();

    await this.loadBlock(body, block, 'footer', origin);

    block.dataset.blockStatus = 'loaded';
    body.classList.add('appear');
  }

  async pseudoDecorateMain(htmlText, body, origin) {
    const main = document.createElement('main');
    body.append(main);
    main.innerHTML = htmlText;

    const { decorateMain } = await import(`${origin}${window.hlx.codeBasePath}/scripts/scripts.js`);
    if (decorateMain) {
      await decorateMain(main, true);
    }

    // Query all the blocks in the aem content
    const blockElements = main.querySelectorAll('.block');

    if (blockElements.length > 0) {
      const blocks = Array.from(blockElements).map((block) => block.classList.item(0));

      for (let i = 0; i < blockElements.length; i += 1) {
        const blockName = blocks[i];
        const block = blockElements[i];
        // eslint-disable-next-line no-await-in-loop
        await this.loadBlock(body, block, blockName, origin);
      }
    }

    const sections = main.querySelectorAll('.section');
    sections.forEach((s) => {
      s.dataset.sectionStatus = 'loaded';
      s.style = '';
    });
  }

  async handleMain(htmlText, body, origin) {
    await this.pseudoDecorateMain(htmlText, body, origin);
    body.classList.add('appear');
  }

  // ---------------------------------------------------------------
  // Web Component lifecycle
  // ---------------------------------------------------------------

  async connectedCallback() {
    if (!this.initialized) {
      try {
        const urlAttribute = this.attributes.getNamedItem('url');
        if (!urlAttribute) {
          throw new Error('aem-embed missing url attribute');
        }

        const type = this.getAttribute('type') || 'main';

        const body = document.createElement('body');
        body.style = 'display: none';
        this.shadowRoot.append(body);

        const url = urlAttribute.value;
        const plainUrl = url.endsWith('/') ? `${url}index.plain.html` : `${url}.plain.html`;
        const { href, origin } = new URL(plainUrl);

        // Start bridge handshake in parallel with content fetch
        const bridgeReady = this._initializeBridge();

        // Load fragment
        const resp = await fetch(href);
        if (!resp.ok) {
          throw new Error(`Unable to fetch ${href}`);
        }

        const styles = document.createElement('link');
        styles.setAttribute('rel', 'stylesheet');
        styles.setAttribute('href', `${origin}${window.hlx.codeBasePath}/styles/styles.css`);
        styles.onload = () => { body.style = ''; };
        styles.onerror = () => { body.style = ''; };
        this.shadowRoot.appendChild(styles);

        let htmlText = await resp.text();
        // Fix relative image urls
        const regex = /.\/media/g;
        htmlText = htmlText.replace(regex, `${origin}/media`);

        this.initialized = true;

        // Wait for bridge handshake to complete before loading blocks
        await bridgeReady;

        if (type === 'main') await this.handleMain(htmlText, body, origin);
        if (type === 'header') await this.handleHeader(htmlText, body, origin);
        if (type === 'footer') await this.handleFooter(htmlText, body, origin);

        const fonts = document.createElement('link');
        fonts.setAttribute('rel', 'stylesheet');
        fonts.setAttribute('href', `${origin}${window.hlx.codeBasePath}/styles/fonts.css`);
        this.shadowRoot.appendChild(fonts);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.log(err || '[AEM Embed] An error occured while loading the content');
      }
    }
  }

  // eslint-disable-next-line class-methods-use-this
  async importScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.type = 'module';
      script.onload = resolve;
      script.onerror = reject;

      document.body.appendChild(script);
    });
  }
}

customElements.define('aem-embed', AEMEmbed);
