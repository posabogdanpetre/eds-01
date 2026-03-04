/*
 * AEM Embed WebComponent — powered by LLMApps SDK
 *
 * Loads AEM EDS content into any MCP Apps host (ChatGPT, Claude, etc.)
 * and passes an MCPBridge instance to each block for tool data and interaction.
 *
 * Block contract:  export default function decorate(block, bridge) { ... }
 *   - bridge.toolResult              → Promise<params> (one-shot, first tool result)
 *   - bridge.callTool(name, args)    → call another MCP tool from the UI
 *   - bridge.sendMessage(text)       → post a follow-up message
 *   - bridge.updateModelContext(text) → silently update model context
 *   - bridge.openLink(url)           → open external link via host
 *   - bridge.requestDisplayMode(mode)→ request inline/fullscreen/pip
 *   - bridge.hostContext             → theme, locale, displayMode, styles, ...
 *   - bridge.hostCapabilities        → openLinks, serverTools, logging, ...
 *   - bridge.isEmbedded              → true if inside a host iframe
 */

import { LLMApp } from './llmapps-sdk.js';

// eslint-disable-next-line import/prefer-default-export
export class AEMEmbed extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.initialized = false;

    window.hlx = window.hlx || {};
    window.hlx.suppressLoadPage = true;
    [window.hlx.codeBasePath] = new URL(import.meta.url).pathname.split('/scripts/');

    // Create the bridge instance — shared by all blocks in this embed
    this._bridge = new LLMApp({
      appInfo: { name: 'AEMEmbed', version: '1.0.0' },
      appCapabilities: {
        availableDisplayModes: ['inline', 'fullscreen'],
      },
    });
  }

  // ---------------------------------------------------------------
  // Block loading — passes the bridge to block decorate()
  // ---------------------------------------------------------------

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
        // eslint-disable-next-line no-await-in-loop
        await decorateBlock.default(block, this._bridge);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('[AEM Embed] Error loading block:', blockName, e);
    }
  }

  // ---------------------------------------------------------------
  // Content handlers
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
        const bridgeReady = this._bridge.connect();

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
        const regex = /.\/media/g;
        htmlText = htmlText.replace(regex, `${origin}/media`);

        this.initialized = true;

        // Wait for bridge before loading blocks
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
