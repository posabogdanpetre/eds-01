/**
 * Product Showcase Block — uses MCPBridge SDK
 *
 * Displays a horizontal carousel of product cards.
 * Receives data and interacts with the host via the bridge.
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

function createProductCard(product, bridge) {
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

  // CTA — uses bridge.sendMessage() to ask the model for more info
  const cta = document.createElement('button');
  cta.className = 'showcase-cta';
  cta.textContent = 'Tell me more';
  cta.addEventListener('click', () => {
    if (bridge.isConnected) {
      bridge.sendMessage(`Tell me more about "${product.name}".`);
    } else if (product.url) {
      window.open(product.url, '_blank');
    }
  });
  body.appendChild(cta);

  card.appendChild(body);
  return card;
}

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

  products.forEach((product) => {
    container.appendChild(createProductCard(product, bridge));
  });

  block.appendChild(container);

  if (products.length > 2) {
    createCarouselArrows(container, block);
  }
}

export default async function decorate(block, bridge) {
  block.textContent = 'Loading products...';
  block.className = 'product-showcase';

  // Wait for the tool result (one per widget lifecycle — ChatGPT
  // destroys and recreates the iframe on each new tool invocation)
  try {
    const result = await bridge.toolResult;
    const payload = result?.structuredContent || result;
    const products = payload?.products;

    if (!products || !Array.isArray(products) || products.length === 0) {
      block.innerHTML = '<p class="showcase-empty">No products available.</p>';
      return;
    }

    renderProducts(block, products, payload.title, bridge);

    // Tell the model what we rendered
    if (bridge.isConnected) {
      bridge.updateModelContext(
        `Product showcase displayed ${products.length} products: ${products.map((p) => p.name).join(', ')}.`,
      );
    }
  } catch (error) {
    block.textContent = 'Error loading products.';
    // eslint-disable-next-line no-console
    console.error('Product showcase error:', error);
  }
}
