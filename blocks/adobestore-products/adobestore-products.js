function createProductCard(product, bridge) {
  const card = document.createElement('div');
  card.className = 'adobestore-card';

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

  const price = document.createElement('div');
  price.className = 'adobestore-card-price';
  price.textContent = product.price;

  const actions = document.createElement('div');
  actions.className = 'adobestore-card-actions';

  const detailsBtn = document.createElement('button');
  detailsBtn.className = 'adobestore-btn adobestore-btn-details';
  detailsBtn.textContent = 'Tell me more';
  detailsBtn.addEventListener('click', () => {
    if (bridge) {
      bridge.sendMessage(`Show me details for Adobe Store product ${product.sku}`);
    }
  });

  const buyLink = document.createElement('a');
  buyLink.className = 'adobestore-btn adobestore-btn-buy';
  buyLink.textContent = 'Buy';
  buyLink.href = product.productUrl || '#';
  buyLink.target = '_blank';
  buyLink.rel = 'noopener noreferrer';
  buyLink.addEventListener('click', (e) => {
    if (bridge && bridge.openLink) {
      e.preventDefault();
      bridge.openLink(product.productUrl);
    }
  });

  actions.appendChild(detailsBtn);
  actions.appendChild(buyLink);

  body.appendChild(title);
  body.appendChild(desc);
  body.appendChild(price);
  body.appendChild(actions);
  card.appendChild(body);

  return card;
}

function createCarouselArrows(container, block) {
  const leftArrow = document.createElement('button');
  leftArrow.className = 'adobestore-arrow adobestore-arrow-left';
  leftArrow.setAttribute('aria-label', 'Previous products');
  leftArrow.textContent = '\u2039';

  const rightArrow = document.createElement('button');
  rightArrow.className = 'adobestore-arrow adobestore-arrow-right';
  rightArrow.setAttribute('aria-label', 'Next products');
  rightArrow.textContent = '\u203A';

  const updateArrows = () => {
    const { scrollLeft } = container;
    const maxScroll = container.scrollWidth - container.clientWidth;
    leftArrow.classList.toggle('disabled', scrollLeft <= 0);
    rightArrow.classList.toggle('disabled', scrollLeft >= maxScroll - 1);
  };

  const scrollAmount = 320;

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
