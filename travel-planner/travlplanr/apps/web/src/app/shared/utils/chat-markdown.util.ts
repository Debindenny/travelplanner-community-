/**
 * Render the small markdown subset our chat models actually emit
 * (bold/italic/inline code, dash & numbered lists, links, paragraphs) as
 * HTML for [innerHTML] chat bubbles.
 *
 * Input is HTML-escaped before any tags are added, so model output can
 * never inject markup; Angular's [innerHTML] sanitizer is a second net.
 */
export function formatChatHtml(raw: string): string {
  const cleaned = raw.replace(/<customer_name>([^<]*)<\/customer_name>/gi, '$1');
  const escaped = cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const inline = (text: string): string =>
    text
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>')
      // Only http(s) URLs become links; anything else stays literal text.
      .replace(
        /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
      );

  // Models often inline whole numbered lists into one paragraph
  // ("... details: 1. **Dates**: ... 2. **Travelers**: ..."); break those
  // onto their own lines first so the list pass below can pick them up.
  const withListBreaks = escaped
    .replace(/(\S[.:!?])\s+(\d+\.\s+)/g, '$1\n$2')
    .replace(/(\S)\s+(-\s+\*\*)/g, '$1\n- **');

  const lines = withListBreaks.split('\n');
  const out: string[] = [];
  let listTag: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (listTag) {
      out.push(`</${listTag}>`);
      listTag = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const bullet = trimmed.match(/^[-•]\s+(.*)$/);
    const numbered = trimmed.match(/^\d+\.\s+(.*)$/);
    if (bullet || numbered) {
      const wanted = bullet ? 'ul' : 'ol';
      if (listTag !== wanted) {
        closeList();
        out.push(`<${wanted}>`);
        listTag = wanted;
      }
      out.push(`<li>${inline((bullet ?? numbered)![1])}</li>`);
      continue;
    }
    closeList();
    if (trimmed) out.push(`<p>${inline(trimmed)}</p>`);
  }
  closeList();
  return out.join('');
}
