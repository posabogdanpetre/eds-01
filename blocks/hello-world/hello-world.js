export default async function decorate(block, bridge) {
  block.textContent = 'Content loading...';

  if (!bridge) {
    block.innerHTML = '<p style="padding:16px;color:#888;">This block requires tool data from an LLM Apps host.</p>';
    return;
  }

  try {
    const result = await bridge.toolResult;
    const data = result?.structuredContent || result;
    // eslint-disable-next-line no-console
    console.log('Data loaded', data);
    block.textContent = `key1: ${data.key1}\nkey2: ${data.key2}`;
  } catch (error) {
    block.textContent = 'Error loading data';
    // eslint-disable-next-line no-console
    console.error('Hello world error:', error);
  }
}
