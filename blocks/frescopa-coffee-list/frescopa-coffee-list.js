function createCoffeeCard(coffee) {
  const card = document.createElement('div');
  card.className = 'coffee-card';

  // Product image
  const imageContainer = document.createElement('div');
  imageContainer.className = 'coffee-card-image';

  const img = document.createElement('img');
  img.src = coffee.imageUrl;
  img.alt = coffee.name;
  img.loading = 'lazy';

  imageContainer.appendChild(img);
  card.appendChild(imageContainer);

  // Product body
  const body = document.createElement('div');
  body.className = 'coffee-card-body';

  const title = document.createElement('h3');
  title.className = 'coffee-title';
  title.textContent = coffee.name;

  const description = document.createElement('p');
  description.className = 'coffee-description';
  description.textContent = coffee.description;

  const price = document.createElement('div');
  price.className = 'coffee-price';
  price.textContent = coffee.price;

  body.appendChild(title);
  body.appendChild(description);
  body.appendChild(price);
  card.appendChild(body);

  return card;
}

function createCarouselArrows(container, block) {
  const leftArrow = document.createElement('button');
  leftArrow.className = 'carousel-arrow carousel-arrow-left';
  leftArrow.setAttribute('aria-label', 'Previous coffees');
  leftArrow.textContent = '\u2039';

  const rightArrow = document.createElement('button');
  rightArrow.className = 'carousel-arrow carousel-arrow-right';
  rightArrow.setAttribute('aria-label', 'Next coffees');
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
  block.textContent = 'Loading Frescopa coffees...';
  block.className = 'frescopa-coffee-list';

  try {
    const result = await bridge.toolResult;
    const data = result?.structuredContent || result;

    block.textContent = '';

    if (!data || !data.coffee || !Array.isArray(data.coffee) || data.coffee.length === 0) {
      block.innerHTML = '<p class="no-coffee">No coffee available at this time.</p>';
      return;
    }

    const container = document.createElement('div');
    container.className = 'coffee-container';

    data.coffee.forEach((coffee) => {
      const card = createCoffeeCard(coffee);
      container.appendChild(card);
    });

    block.appendChild(container);
    createCarouselArrows(container, block);
  } catch (error) {
    block.textContent = 'Error loading coffees';
    // eslint-disable-next-line no-console
    console.error('Error loading Frescopa coffees:', error);
  }
}
