function formatCurrency(amount) {
  return `$${amount.toLocaleString()}`;
}

function createCarCard(vehicle, bridge) {
  const card = document.createElement('div');
  card.className = 'automotive-card';

  // Image container with vehicle image
  const imageContainer = document.createElement('div');
  imageContainer.className = 'automotive-card-image';

  const img = document.createElement('img');
  img.src = `${vehicle.imageUrl}?width=760&format=webply&optimize=medium`;
  img.srcset = `${vehicle.imageUrl}?width=380&format=webply&optimize=medium 1x, ${vehicle.imageUrl}?width=760&format=webply&optimize=medium 2x, ${vehicle.imageUrl}?width=1140&format=webply&optimize=medium 3x`;
  img.sizes = '(max-width: 768px) 300px, 380px';
  img.alt = vehicle.model;
  img.loading = 'lazy';

  img.addEventListener('load', () => {
    img.classList.add('loaded');
  });

  // Year badge
  const yearBadge = document.createElement('span');
  yearBadge.className = 'automotive-year-badge';
  yearBadge.textContent = vehicle.year;

  imageContainer.appendChild(img);
  imageContainer.appendChild(yearBadge);
  card.appendChild(imageContainer);

  // Card body
  const body = document.createElement('div');
  body.className = 'automotive-card-body';

  const modelName = document.createElement('h3');
  modelName.className = 'automotive-model-name';
  modelName.textContent = vehicle.model;

  const leasePrice = document.createElement('p');
  leasePrice.className = 'automotive-lease-price';
  leasePrice.innerHTML = `Lease for <strong>${formatCurrency(vehicle.leasePrice)}/month.</strong>`;

  const terms = document.createElement('p');
  terms.className = 'automotive-terms';
  terms.textContent = `${vehicle.leaseTerm} months with ${formatCurrency(vehicle.dueAtSigning)} due at signing, `
    + `plus loyalty credit up to ${formatCurrency(vehicle.loyaltyCredit)} for qualified buyers. `
    + `Now through ${vehicle.offerExpiry}.`;

  // CTA button - Explore link (uses bridge.openLink for standard protocol)
  const button = document.createElement('button');
  button.className = 'automotive-cta-button';
  button.textContent = `Explore ${vehicle.shortName || vehicle.model.split(' ')[0]}`;
  button.addEventListener('click', () => {
    if (bridge && vehicle.exploreUrl) {
      bridge.openLink(vehicle.exploreUrl);
    }
  });

  body.appendChild(modelName);
  body.appendChild(leasePrice);
  body.appendChild(terms);
  body.appendChild(button);
  card.appendChild(body);

  return card;
}

function createCarouselArrows(container, block) {
  const leftArrow = document.createElement('button');
  leftArrow.className = 'automotive-carousel-arrow automotive-carousel-arrow-left';
  leftArrow.setAttribute('aria-label', 'Previous vehicles');
  leftArrow.textContent = '\u2039';

  const rightArrow = document.createElement('button');
  rightArrow.className = 'automotive-carousel-arrow automotive-carousel-arrow-right';
  rightArrow.setAttribute('aria-label', 'Next vehicles');
  rightArrow.textContent = '\u203A';

  const updateArrows = () => {
    const { scrollLeft } = container;
    const maxScroll = container.scrollWidth - container.clientWidth;

    leftArrow.classList.toggle('disabled', scrollLeft <= 0);
    rightArrow.classList.toggle('disabled', scrollLeft >= maxScroll - 1);
  };

  const scrollAmount = 400;

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
  block.textContent = 'Loading car models...';
  block.className = 'automotive-car-models';

  if (!bridge) {
    block.innerHTML = '<p style="padding:16px;color:#888;">This block requires tool data from an LLM Apps host.</p>';
    return;
  }

  // Theme support via bridge context changes
  bridge.onContextChange((ctx) => {
    if (ctx.theme) block.setAttribute('data-theme', ctx.theme);
  });

  // Set initial theme from host context
  const initialTheme = bridge.hostContext?.theme;
  block.setAttribute('data-theme', initialTheme || 'light');

  try {
    const result = await bridge.toolResult;
    const data = result?.structuredContent || result;

    block.textContent = '';

    const modelsData = data?.models;

    if (!modelsData || !Array.isArray(modelsData) || modelsData.length === 0) {
      block.innerHTML = '<p class="automotive-no-models">No car models available at this time.</p>';
      return;
    }

    const container = document.createElement('div');
    container.className = 'automotive-container';

    modelsData.forEach((vehicle) => {
      const card = createCarCard(vehicle, bridge);
      container.appendChild(card);
    });

    block.appendChild(container);
    createCarouselArrows(container, block);
  } catch (error) {
    block.textContent = 'Error loading car models';
    // eslint-disable-next-line no-console
    console.error('Error loading car models:', error);
  }
}
