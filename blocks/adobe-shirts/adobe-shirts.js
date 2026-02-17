function createShirtCard(shirt) {
  const card = document.createElement('div');
  card.className = 'shirt-card';

  // Product image
  const imageContainer = document.createElement('div');
  imageContainer.className = 'shirt-card-image';

  const img = document.createElement('img');
  img.src = shirt.imageUrl;
  img.alt = shirt.name;
  img.loading = 'lazy';

  imageContainer.appendChild(img);
  card.appendChild(imageContainer);

  // Product body
  const body = document.createElement('div');
  body.className = 'shirt-card-body';

  const title = document.createElement('h3');
  title.className = 'shirt-title';
  title.textContent = shirt.name;

  const price = document.createElement('div');
  price.className = 'shirt-price';
  price.textContent = shirt.price;

  const description = document.createElement('p');
  description.className = 'shirt-description';
  description.textContent = shirt.description;

  const color = document.createElement('div');
  color.className = 'shirt-color';
  color.textContent = `Color: ${shirt.color}`;

  body.appendChild(title);
  body.appendChild(price);
  body.appendChild(description);
  body.appendChild(color);
  card.appendChild(body);

  return card;
}

function createCarouselArrows(container, block) {
  const leftArrow = document.createElement('button');
  leftArrow.className = 'carousel-arrow carousel-arrow-left';
  leftArrow.setAttribute('aria-label', 'Previous shirts');
  leftArrow.textContent = '\u2039';

  const rightArrow = document.createElement('button');
  rightArrow.className = 'carousel-arrow carousel-arrow-right';
  rightArrow.setAttribute('aria-label', 'Next shirts');
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
  block.textContent = 'Loading Adobe shirts...';
  block.className = 'adobe-shirts';

  try {
    const result = await bridge.toolResult;
    const data = result?.structuredContent || result;

    block.textContent = '';

    if (!data || !data.shirts || !Array.isArray(data.shirts) || data.shirts.length === 0) {
      block.innerHTML = '<p class="no-shirts">No shirts available at this time.</p>';
      return;
    }

    const container = document.createElement('div');
    container.className = 'shirts-container';

    data.shirts.forEach((shirt) => {
      const card = createShirtCard(shirt);
      container.appendChild(card);
    });

    block.appendChild(container);
    createCarouselArrows(container, block);
  } catch (error) {
    block.textContent = 'Error loading shirts';
    // eslint-disable-next-line no-console
    console.error('Error loading Adobe shirts:', error);
  }
}
