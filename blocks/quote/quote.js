export default function decorate(block) {
  const [quoteRow, attributionRow] = [...block.children];

  // Build the <blockquote> element
  const blockquote = document.createElement('blockquote');

  // Quote text (first row)
  if (quoteRow) {
    const quoteText = quoteRow.querySelector('div');
    if (quoteText) {
      // Wrap in <p> if not already wrapped
      if (!quoteText.querySelector('p')) {
        const p = document.createElement('p');
        p.textContent = quoteText.textContent;
        blockquote.append(p);
      } else {
        blockquote.append(...quoteText.children);
      }
    }
  }

  // Attribution / author (second row, optional)
  if (attributionRow) {
    const attributionText = attributionRow.querySelector('div');
    if (attributionText) {
      const cite = document.createElement('cite');
      cite.textContent = attributionText.textContent.trim();
      blockquote.append(cite);
    }
  }

  block.replaceChildren(blockquote);
}
