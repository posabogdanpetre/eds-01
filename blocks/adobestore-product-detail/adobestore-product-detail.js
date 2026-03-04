function createDetailView(product, bridge) {
  const container = document.createElement('div');
  container.className = 'adobestore-detail';

  // Image section
  const imageSection = document.createElement('div');
  imageSection.className = 'adobestore-detail-image-section';

  if (product.imageUrl) {
    const img = document.createElement('img');
    img.src = product.imageUrl;
    img.alt = product.name;
    img.className = 'adobestore-detail-image';
    imageSection.appendChild(img);
  }
  container.appendChild(imageSection);

  // Info section
  const info = document.createElement('div');
  info.className = 'adobestore-detail-info';

  const sku = document.createElement('span');
  sku.className = 'adobestore-detail-sku';
  sku.textContent = product.sku || '';
  info.appendChild(sku);

  const title = document.createElement('h1');
  title.className = 'adobestore-detail-title';
  title.textContent = product.name;
  info.appendChild(title);

  const price = document.createElement('div');
  price.className = 'adobestore-detail-price';
  price.textContent = product.price;
  info.appendChild(price);

  if (product.shortDescription) {
    const shortDesc = document.createElement('p');
    shortDesc.className = 'adobestore-detail-short-desc';
    shortDesc.textContent = product.shortDescription;
    info.appendChild(shortDesc);
  }

  // Options (sizes, colors)
  if (product.options && product.options.length > 0) {
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'adobestore-detail-options';

    product.options.forEach((opt) => {
      const optGroup = document.createElement('div');
      optGroup.className = 'adobestore-detail-opt-group';

      const optLabel = document.createElement('span');
      optLabel.className = 'adobestore-detail-opt-label';
      optLabel.textContent = opt.label;
      optGroup.appendChild(optLabel);

      const optValues = document.createElement('div');
      optValues.className = 'adobestore-detail-opt-values';
      (opt.values || []).forEach((val) => {
        const chip = document.createElement('span');
        chip.className = 'adobestore-detail-opt-chip';
        chip.textContent = val;
        optValues.appendChild(chip);
      });
      optGroup.appendChild(optValues);
      optionsContainer.appendChild(optGroup);
    });

    info.appendChild(optionsContainer);
  }

  const divider = document.createElement('hr');
  divider.className = 'adobestore-detail-divider';
  info.appendChild(divider);

  if (product.description) {
    const fullDesc = document.createElement('p');
    fullDesc.className = 'adobestore-detail-desc';
    fullDesc.textContent = product.description;
    info.appendChild(fullDesc);
  }

  const buyLink = document.createElement('a');
  buyLink.className = 'adobestore-detail-buy';
  buyLink.innerHTML = 'Shop on Adobe Store &#8599;';
  buyLink.href = product.productUrl || '#';
  buyLink.target = '_blank';
  buyLink.rel = 'noopener noreferrer';
  buyLink.addEventListener('click', (e) => {
    if (bridge && bridge.openLink) {
      e.preventDefault();
      bridge.openLink(product.productUrl);
    }
  });
  info.appendChild(buyLink);

  container.appendChild(info);
  return container;
}

export default async function decorate(block, bridge) {
  block.textContent = 'Loading product details...';
  block.className = 'adobestore-product-detail';

  if (!bridge) {
    block.innerHTML = '<p class="adobestore-detail-empty">This block requires tool data from an LLM Apps host.</p>';
    return;
  }

  try {
    console.log('[ProductDetail] waiting for toolResult...');
    const result = await bridge.toolResult;
    console.log('[ProductDetail] toolResult received:', JSON.stringify(result).slice(0, 500));
    const data = result?.structuredContent || result;
    console.log('[ProductDetail] data.product:', data?.product ? 'exists' : 'MISSING');

    block.textContent = '';

    if (!data || !data.product) {
      block.innerHTML = '<p class="adobestore-detail-empty">Product not found.</p>';
      console.log('[ProductDetail] No product in data, keys:', Object.keys(data || {}));
      return;
    }

    const detailView = createDetailView(data.product, bridge);
    block.appendChild(detailView);
    console.log('[ProductDetail] rendered successfully');
  } catch (error) {
    block.textContent = 'Error loading product details';
    console.error('[ProductDetail] Error:', error);
  }
}
