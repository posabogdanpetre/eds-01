/**
 * Product Showcase Block — uses LLMApps SDK
 *
 * Displays a horizontal carousel of product cards with interactive features
 * that demonstrate bridge.sendMessage() and bridge.updateModelContext().
 *
 * ─── WHY TWO METHODS? ───────────────────────────────────────────────
 *
 *   bridge.sendMessage(text)
 *     Posts a message in the chat AS THE USER. The model sees it and
 *     responds. Use when the user explicitly wants the model to do
 *     something — answer a question, compare items, find alternatives.
 *     The message is VISIBLE in the conversation.
 *
 *   bridge.updateModelContext(text)
 *     Silently tells the model what the user is doing inside the widget.
 *     Nothing appears in the chat, but the model REMEMBERS it for future
 *     responses. Use for tracking user behavior — what they favorited,
 *     what they scrolled past, what they selected — so the model can
 *     give smarter recommendations without the user having to explain.
 *
 * ─── STANDARD PROTOCOL FEATURES ─────────────────────────────────────
 *
 *   bridge.requestDisplayMode('fullscreen')
 *     Standard MCP Apps method to request the host expand/contract the
 *     widget. Works on any compliant host (ChatGPT, Claude, etc.).
 *
 *   bridge.openLink(url)
 *     Standard MCP Apps method to open an external link through the host.
 *     The host may show a confirmation dialog. Works on any compliant host.
 *
 * ─── CHATGPT EXTENSIONS DEMO ────────────────────────────────────────
 *
 *   bridge.chatgpt.widgetState / bridge.chatgpt.setWidgetState(state)
 *     ChatGPT-specific state persistence. Favorites survive widget
 *     re-renders — the host persists a snapshot between renders.
 *     When the widget mounts, we restore favorites from the snapshot.
 *     NOT available in other hosts (gracefully ignored).
 *
 * ─────────────────────────────────────────────────────────────────────
 *
 * @param {HTMLElement} block  - The block DOM element
 * @param {LLMAppsSDK} bridge - The LLM Apps bridge instance
 *
 * Expected structuredContent:
 * {
 *   title?: string,
 *   products: [
 *     { name, description, price?, imageUrl?, category?, rating?, url? }
 *   ]
 * }
 */

// Shared state: tracks which products the user has favorited
const favorites = new Set();

// ─── Fullscreen detail view (ChatGPT extension) ─────────────────────

function showDetailView(product, block, bridge) {
  // Remember we're in detail mode
  block.dataset.detail = 'true';

  const overlay = document.createElement('div');
  overlay.className = 'showcase-detail';

  // Back button → return to inline carousel (standard protocol)
  const backBtn = document.createElement('button');
  backBtn.className = 'showcase-detail-back';
  backBtn.textContent = '← Back to products';
  backBtn.addEventListener('click', async () => {
    overlay.remove();
    delete block.dataset.detail;
    if (bridge.isConnected) {
      try { await bridge.requestDisplayMode('inline'); }
      catch { /* host may not support it */ }
    }
  });
  overlay.appendChild(backBtn);

  const content = document.createElement('div');
  content.className = 'showcase-detail-content';

  // Large image
  if (product.imageUrl) {
    const img = document.createElement('img');
    img.className = 'showcase-detail-image';
    img.src = product.imageUrl;
    img.alt = product.name || 'Product';
    content.appendChild(img);
  }

  const info = document.createElement('div');
  info.className = 'showcase-detail-info';

  if (product.category) {
    const cat = document.createElement('span');
    cat.className = 'showcase-badge';
    cat.textContent = product.category;
    info.appendChild(cat);
  }

  const title = document.createElement('h2');
  title.textContent = product.name;
  info.appendChild(title);

  if (product.rating) {
    const rating = document.createElement('div');
    rating.className = 'showcase-rating';
    const stars = '★'.repeat(Math.round(product.rating))
      + '☆'.repeat(5 - Math.round(product.rating));
    rating.innerHTML = `<span class="showcase-stars">${stars}</span> <span class="showcase-rating-value">${product.rating}</span>`;
    info.appendChild(rating);
  }

  if (product.price != null) {
    const price = document.createElement('p');
    price.className = 'showcase-detail-price';
    price.textContent = typeof product.price === 'number'
      ? `$${product.price.toLocaleString()}`
      : product.price;
    info.appendChild(price);
  }

  if (product.description) {
    const desc = document.createElement('p');
    desc.className = 'showcase-detail-desc';
    desc.textContent = product.description;
    info.appendChild(desc);
  }

  // Action buttons in detail view
  const actions = document.createElement('div');
  actions.className = 'showcase-detail-actions';

  const tellMore = document.createElement('button');
  tellMore.className = 'showcase-cta';
  tellMore.textContent = 'Tell me more';
  tellMore.addEventListener('click', () => {
    if (bridge.isConnected) {
      bridge.sendMessage(`Tell me more about "${product.name}".`);
    }
  });
  actions.appendChild(tellMore);

  const findSimilar = document.createElement('button');
  findSimilar.className = 'showcase-cta showcase-cta-secondary';
  findSimilar.textContent = 'Find similar';
  findSimilar.addEventListener('click', () => {
    if (bridge.isConnected) {
      bridge.sendMessage(
        `Find me products similar to "${product.name}" in the ${product.price != null ? `$${product.price}` : 'same'} price range.`,
      );
    }
  });
  actions.appendChild(findSimilar);

  // ★ Standard protocol: openLink — opens the product page via the host
  if (product.url) {
    const viewLink = document.createElement('a');
    viewLink.className = 'showcase-cta showcase-cta-link';
    viewLink.textContent = 'View product ↗';
    viewLink.href = product.url;
    viewLink.target = '_blank';
    viewLink.rel = 'noopener noreferrer';
    viewLink.addEventListener('click', (e) => {
      if (bridge.isConnected) {
        e.preventDefault();
        bridge.openLink(product.url);
      }
    });
    actions.appendChild(viewLink);
  }

  info.appendChild(actions);
  content.appendChild(info);
  overlay.appendChild(content);
  block.appendChild(overlay);
}

// ─── Card creation ───────────────────────────────────────────────────

function createProductCard(product, index, bridge) {
  const card = document.createElement('div');
  card.className = 'showcase-card';

  // Image
  if (product.imageUrl) {
    const imageContainer = document.createElement('div');
    imageContainer.className = 'showcase-card-image';

    const img = document.createElement('img');
    img.src = product.imageUrl;
    img.alt = product.name || 'Product';
    img.loading = 'lazy';
    imageContainer.appendChild(img);

    // ★ Standard protocol: click image → fullscreen detail view
    //   requestDisplayMode asks the host to expand the widget container.
    //   Works on any MCP Apps compliant host (ChatGPT, Claude, etc.).
    const expandIcon = document.createElement('span');
    expandIcon.className = 'showcase-expand';
    expandIcon.textContent = '⛶';
    expandIcon.setAttribute('aria-label', 'View fullscreen');
    imageContainer.appendChild(expandIcon);

    imageContainer.style.cursor = 'pointer';
    imageContainer.addEventListener('click', async (e) => {
      // Don't trigger if they clicked the favorite button
      if (e.target.closest('.showcase-fav')) return;
      const parentBlock = imageContainer.closest('.product-showcase');
      if (bridge.isConnected) {
        try { await bridge.requestDisplayMode('fullscreen'); }
        catch { /* host may not support it */ }
      }
      showDetailView(product, parentBlock, bridge);
    });

    if (product.category) {
      const badge = document.createElement('span');
      badge.className = 'showcase-badge';
      badge.textContent = product.category;
      imageContainer.appendChild(badge);
    }

    // ★ FAVORITE button (heart toggle)
    //   → updateModelContext: silently tells the model what the user likes
    const favBtn = document.createElement('button');
    favBtn.className = 'showcase-fav';
    favBtn.setAttribute('aria-label', 'Favorite');
    favBtn.textContent = '♡';
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isFav = favorites.has(product.name);
      if (isFav) {
        favorites.delete(product.name);
        favBtn.textContent = '♡';
        favBtn.classList.remove('active');
      } else {
        favorites.add(product.name);
        favBtn.textContent = '♥';
        favBtn.classList.add('active');
      }

      // updateModelContext — the model now knows the user's preferences
      // without anything appearing in the chat. Next time the user asks
      // "what do you recommend?" the model already knows their taste.
      if (bridge.isConnected) {
        const favList = [...favorites];
        bridge.updateModelContext(
          favList.length > 0
            ? `User's favorite products: ${favList.join(', ')}.`
            : 'User cleared all favorites.',
        );
      }

      // ★ ChatGPT extension: persist favorites to widgetState
      //   This survives widget re-renders — when the user scrolls away
      //   and comes back, ChatGPT restores this snapshot automatically.
      //   Gracefully ignored on other hosts (bridge.chatgpt is null).
      if (bridge.chatgpt) {
        bridge.chatgpt.setWidgetState({ favorites: [...favorites] });
      }

      // Update the compare button visibility
      updateCompareButton(card.closest('.product-showcase'));
    });
    imageContainer.appendChild(favBtn);

    card.appendChild(imageContainer);
  }

  // Body
  const body = document.createElement('div');
  body.className = 'showcase-card-body';

  const name = document.createElement('h3');
  name.className = 'showcase-product-name';
  name.textContent = product.name;
  body.appendChild(name);

  if (product.rating) {
    const rating = document.createElement('div');
    rating.className = 'showcase-rating';
    const stars = '★'.repeat(Math.round(product.rating))
      + '☆'.repeat(5 - Math.round(product.rating));
    rating.innerHTML = `<span class="showcase-stars">${stars}</span> <span class="showcase-rating-value">${product.rating}</span>`;
    body.appendChild(rating);
  }

  if (product.description) {
    const desc = document.createElement('p');
    desc.className = 'showcase-description';
    desc.textContent = product.description;
    body.appendChild(desc);
  }

  if (product.price != null) {
    const price = document.createElement('p');
    price.className = 'showcase-price';
    price.textContent = typeof product.price === 'number'
      ? `$${product.price.toLocaleString()}`
      : product.price;
    body.appendChild(price);
  }

  // Action buttons row
  const actions = document.createElement('div');
  actions.className = 'showcase-actions';

  // ★ "TELL ME MORE" button
  //   → sendMessage: posts a visible message in the chat asking the model
  //     to explain this product. The user sees the question and the model's
  //     answer in the conversation.
  const tellMore = document.createElement('button');
  tellMore.className = 'showcase-cta';
  tellMore.textContent = 'Tell me more';
  tellMore.addEventListener('click', () => {
    // eslint-disable-next-line no-console
    console.log('[ProductShowcase] Tell me more clicked, isConnected:', bridge.isConnected);
    if (bridge.isConnected) {
      bridge.sendMessage(`Tell me more about "${product.name}".`);
    } else {
      // eslint-disable-next-line no-console
      console.warn('[ProductShowcase] Bridge not connected — sendMessage skipped');
    }
  });
  actions.appendChild(tellMore);

  // ★ "FIND SIMILAR" button
  //   → sendMessage: asks the model to find alternatives. The user
  //     explicitly wants a response, so sendMessage is the right choice.
  const findSimilar = document.createElement('button');
  findSimilar.className = 'showcase-cta showcase-cta-secondary';
  findSimilar.textContent = 'Find similar';
  findSimilar.addEventListener('click', () => {
    // eslint-disable-next-line no-console
    console.log('[ProductShowcase] Find similar clicked, isConnected:', bridge.isConnected);
    if (bridge.isConnected) {
      bridge.sendMessage(
        `Find me products similar to "${product.name}" in the ${product.price != null ? `$${product.price}` : 'same'} price range.`,
      );
    } else {
      // eslint-disable-next-line no-console
      console.warn('[ProductShowcase] Bridge not connected — sendMessage skipped');
    }
  });
  actions.appendChild(findSimilar);

  // ★ "VIEW PRODUCT" link
  //   → Standard protocol: openLink opens a vetted link through the host.
  //     The host may show a confirmation dialog before navigating.
  //     On non-connected hosts, falls back to a regular <a> link.
  if (product.url) {
    const viewLink = document.createElement('a');
    viewLink.className = 'showcase-cta showcase-cta-link';
    viewLink.textContent = 'View ↗';
    viewLink.href = product.url;
    viewLink.target = '_blank';
    viewLink.rel = 'noopener noreferrer';
    viewLink.addEventListener('click', (e) => {
      if (bridge.isConnected) {
        e.preventDefault();
        bridge.openLink(product.url);
      }
      // else: default <a> behavior — opens in new tab
    });
    actions.appendChild(viewLink);
  }

  body.appendChild(actions);
  card.appendChild(body);
  return card;
}

// ─── Compare favorites bar ──────────────────────────────────────────

function updateCompareButton(block) {
  if (!block) return;
  let bar = block.querySelector('.showcase-compare-bar');

  if (favorites.size < 2) {
    if (bar) bar.classList.remove('visible');
    return;
  }

  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'showcase-compare-bar';
    block.appendChild(bar);
  }

  bar.innerHTML = '';

  const label = document.createElement('span');
  label.className = 'showcase-compare-label';
  label.textContent = `${favorites.size} favorited`;
  bar.appendChild(label);

  // ★ "COMPARE" button
  //   → sendMessage: the user wants the model to compare their favorites
  //     side by side. This triggers a visible response in the chat.
  const compareBtn = document.createElement('button');
  compareBtn.className = 'showcase-cta';
  compareBtn.textContent = 'Compare favorites';
  compareBtn.addEventListener('click', () => {
    const bridge = bar._bridge;
    if (bridge?.isConnected) {
      bridge.sendMessage(
        `Compare these products for me: ${[...favorites].join(' vs ')}. Which one is the best value?`,
      );
    }
  });
  bar.appendChild(compareBtn);

  bar._bridge = bar._bridge; // preserve reference
  bar.classList.add('visible');
}

// ─── Carousel arrows ────────────────────────────────────────────────

function createCarouselArrows(container, block) {
  const leftArrow = document.createElement('button');
  leftArrow.className = 'showcase-arrow showcase-arrow-left';
  leftArrow.setAttribute('aria-label', 'Previous');
  leftArrow.textContent = '‹';

  const rightArrow = document.createElement('button');
  rightArrow.className = 'showcase-arrow showcase-arrow-right';
  rightArrow.setAttribute('aria-label', 'Next');
  rightArrow.textContent = '›';

  const updateArrows = () => {
    const { scrollLeft } = container;
    const maxScroll = container.scrollWidth - container.clientWidth;
    leftArrow.classList.toggle('disabled', scrollLeft <= 0);
    rightArrow.classList.toggle('disabled', scrollLeft >= maxScroll - 1);
  };

  leftArrow.addEventListener('click', () => {
    container.scrollBy({ left: -380, behavior: 'smooth' });
  });

  rightArrow.addEventListener('click', () => {
    container.scrollBy({ left: 380, behavior: 'smooth' });
  });

  container.addEventListener('scroll', updateArrows);
  setTimeout(updateArrows, 100);

  block.appendChild(leftArrow);
  block.appendChild(rightArrow);
}

// ─── Render ─────────────────────────────────────────────────────────

function renderProducts(block, products, title, bridge) {
  block.textContent = '';

  // Optional title
  if (title) {
    const heading = document.createElement('h2');
    heading.className = 'showcase-heading';
    heading.textContent = title;
    block.appendChild(heading);
  }

  // Carousel
  const container = document.createElement('div');
  container.className = 'showcase-container';

  products.forEach((product, i) => {
    container.appendChild(createProductCard(product, i, bridge));
  });

  block.appendChild(container);

  if (products.length > 2) {
    createCarouselArrows(container, block);
  }

  // ★ SCROLL TRACKING
  //   → updateModelContext: when the user scrolls to the end of the
  //     carousel, silently tell the model they've seen everything.
  //     The model can then proactively suggest: "Want me to find more?"
  let scrollTracked = false;
  container.addEventListener('scroll', () => {
    if (scrollTracked) return;
    const maxScroll = container.scrollWidth - container.clientWidth;
    if (container.scrollLeft >= maxScroll - 10) {
      scrollTracked = true;
      if (bridge.isConnected) {
        bridge.updateModelContext(
          `User scrolled through all ${products.length} products in the carousel.`,
        );
      }
    }
  });
}

// ─── Entry point ────────────────────────────────────────────────────

export default async function decorate(block, bridge) {
  block.textContent = 'Loading products...';
  block.className = 'product-showcase';

  if (!bridge) {
    block.innerHTML = '<p style="padding:16px;color:#888;">This block requires tool data from an LLM Apps host.</p>';
    return;
  }

  try {
    // ★ ChatGPT extension: restore favorites from persisted widgetState.
    //   When ChatGPT re-renders the widget (e.g. user scrolls away and back),
    //   it restores the snapshot we saved with setWidgetState().
    //   On other hosts bridge.chatgpt is null — this block is simply skipped.
    const savedState = bridge.chatgpt?.widgetState;
    if (savedState?.favorites?.length) {
      savedState.favorites.forEach((name) => favorites.add(name));
      // eslint-disable-next-line no-console
      console.log(`[ProductShowcase] Restored ${favorites.size} favorites from ChatGPT widgetState`);
    }

    const result = await bridge.toolResult;
    const payload = result?.structuredContent || result;
    const products = payload?.products;

    if (!products || !Array.isArray(products) || products.length === 0) {
      block.innerHTML = '<p class="showcase-empty">No products available.</p>';
      return;
    }

    renderProducts(block, products, payload.title, bridge);

    // ★ ChatGPT extension: apply restored favorites to the rendered cards.
    //   After rendering, walk the cards and toggle the heart buttons for
    //   any products that were previously favorited.
    if (favorites.size > 0) {
      block.querySelectorAll('.showcase-card').forEach((card) => {
        const nameEl = card.querySelector('.showcase-product-name');
        if (nameEl && favorites.has(nameEl.textContent)) {
          const favBtn = card.querySelector('.showcase-fav');
          if (favBtn) {
            favBtn.textContent = '♥';
            favBtn.classList.add('active');
          }
        }
      });
      updateCompareButton(block);
    }

    // Store bridge ref for the compare bar
    const bar = block.querySelector('.showcase-compare-bar');
    if (bar) bar._bridge = bridge;

    // ★ updateModelContext — tell the model what was rendered.
    //   This is silent. The user doesn't see it. But if they later ask
    //   "what was the cheapest one?" the model already has the full list.
    if (bridge.isConnected) {
      const summary = products
        .map((p) => `${p.name}${p.price != null ? ` ($${p.price})` : ''}`)
        .join(', ');
      const favNote = favorites.size > 0
        ? ` User previously favorited: ${[...favorites].join(', ')}.`
        : '';
      bridge.updateModelContext(
        `Product showcase displayed ${products.length} products: ${summary}.${favNote}`,
      );
    }
  } catch (error) {
    block.textContent = 'Error loading products.';
    // eslint-disable-next-line no-console
    console.error('Product showcase error:', error);
  }
}
