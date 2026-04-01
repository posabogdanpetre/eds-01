export default function decorate(block) {
  const name = block.querySelector('div > div')?.textContent?.trim() || 'World';

  block.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'hello-world-wrapper';

  const heading = document.createElement('h2');
  heading.className = 'hello-world-heading';
  heading.textContent = `Hello, ${name}!`;

  const text = document.createElement('p');
  text.className = 'hello-world-text';
  text.textContent = 'Welcome to AEM Edge Delivery Services.';

  wrapper.append(heading, text);
  block.append(wrapper);
}
