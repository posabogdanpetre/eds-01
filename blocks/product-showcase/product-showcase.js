/**
 * Product Showcase Block — uses MCPBridge SDK
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
 * ─────────────────────────────────────────────────────────────────────
 *
 * @param {HTMLElement} block  - The block DOM element
 * @param {MCPBridge}   bridge - The MCP Apps bridge instance
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

  try {
    const result = await bridge.toolResult;
    const payload = result?.structuredContent || result;
    const products = payload?.products;

    if (!products || !Array.isArray(products) || products.length === 0) {
      block.innerHTML = '<p class="showcase-empty">No products available.</p>';
      return;
    }

    renderProducts(block, products, payload.title, bridge);

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
      bridge.updateModelContext(
        `Product showcase displayed ${products.length} products: ${summary}.`,
      );
    }
  } catch (error) {
    block.textContent = 'Error loading products.';
    // eslint-disable-next-line no-console
    console.error('Product showcase error:', error);
  }
}
