const ARROW_SVG = '<svg viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><path d="M3.5 1.5L8 6l-4.5 4.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function createProductCard(product, bridge) {
  const card = document.createElement('div');
  card.className = 'adobestore-card';

  card.addEventListener('click', (e) => {
    if (e.target.closest('.adobestore-card-shop')) return;
    if (bridge) {
      bridge.sendMessage(`Show me details for Adobe Store product ${product.sku}`);
    }
  });

  const imageContainer = document.createElement('div');
  imageContainer.className = 'adobestore-card-image';
  if (product.imageUrl) {
    const img = document.createElement('img');
    img.src = product.imageUrl;
    img.alt = product.name;
    img.loading = 'lazy';
    imageContainer.appendChild(img);
  }
  card.appendChild(imageContainer);

  const body = document.createElement('div');
  body.className = 'adobestore-card-body';

  const title = document.createElement('h3');
  title.className = 'adobestore-card-title';
  title.textContent = product.name;

  const desc = document.createElement('p');
  desc.className = 'adobestore-card-desc';
  desc.textContent = product.shortDescription || '';

  const footer = document.createElement('div');
  footer.className = 'adobestore-card-footer';

  const price = document.createElement('span');
  price.className = 'adobestore-card-price';
  price.textContent = product.price;

  const shopLink = document.createElement('a');
  shopLink.className = 'adobestore-card-shop';
  shopLink.href = product.productUrl || '#';
  shopLink.target = '_blank';
  shopLink.rel = 'noopener noreferrer';
  shopLink.innerHTML = 'Shop &#8599;';
  shopLink.addEventListener('click', (e) => {
    e.stopPropagation();
    if (bridge && bridge.openLink) {
      e.preventDefault();
      bridge.openLink(product.productUrl);
    }
  });

  footer.appendChild(price);
  footer.appendChild(shopLink);

  body.appendChild(title);
  body.appendChild(desc);
  body.appendChild(footer);
  card.appendChild(body);

  return card;
}

function createCarouselArrows(container, block) {
  const leftArrow = document.createElement('button');
  leftArrow.className = 'adobestore-arrow adobestore-arrow-left';
  leftArrow.setAttribute('aria-label', 'Previous products');
  leftArrow.innerHTML = ARROW_SVG;
  leftArrow.style.transform = 'translateY(-50%) scaleX(-1)';

  const rightArrow = document.createElement('button');
  rightArrow.className = 'adobestore-arrow adobestore-arrow-right';
  rightArrow.setAttribute('aria-label', 'Next products');
  rightArrow.innerHTML = ARROW_SVG;

  const updateArrows = () => {
    const { scrollLeft } = container;
    const maxScroll = container.scrollWidth - container.clientWidth;
    leftArrow.classList.toggle('disabled', scrollLeft <= 0);
    rightArrow.classList.toggle('disabled', scrollLeft >= maxScroll - 1);
  };

  const scrollAmount = 260;

  leftArrow.addEventListener('click', () => {
    container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  });

  rightArrow.addEventListener('click', () => {
    container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  });

  container.addEventListener('scroll', updateArrows);
  setTimeout(updateArrows, 100);

  block.appendChild(leftArrow);
  block.appendChild(rightArrow);
}

export default async function decorate(block, bridge) {
  block.textContent = 'Loading Adobe Store products...';
  block.className = 'adobestore-products';

  if (!bridge) {
    block.innerHTML = '<p class="adobestore-empty">This block requires tool data from an LLM Apps host.</p>';
    return;
  }

  try {
    const result = await bridge.toolResult;
    const data = result?.structuredContent || result;

    block.textContent = '';

    if (!data || !data.products || data.products.length === 0) {
      block.innerHTML = '<p class="adobestore-empty">No products found.</p>';
      return;
    }

    if (data.category && data.category !== 'all') {
      const header = document.createElement('div');
      header.className = 'adobestore-header';
      header.textContent = `${data.category.replace(/-/g, ' ')} — ${data.totalCount} products`;
      block.appendChild(header);
    }

    const container = document.createElement('div');
    container.className = 'adobestore-container';

    data.products.forEach((product) => {
      const card = createProductCard(product, bridge);
      container.appendChild(card);
    });

    block.appendChild(container);
    createCarouselArrows(container, block);
  } catch (error) {
    block.textContent = 'Error loading products';
    // eslint-disable-next-line no-console
    console.error('Error loading Adobe Store products:', error);
  }
}
