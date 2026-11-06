// Búsqueda y reemplazo en todas las páginas: texto, frases, palabras completas, regex y por formato.

const HIGHLIGHT = 'wd-find';
const CURRENT = 'wd-find-current';
const hasHighlights = () => typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight !== 'undefined';

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildPattern({ query, matchCase, wholeWord, regex }) {
  if (!query) return null;
  try {
    const source = regex ? query : escapeRegex(query);
    return new RegExp(wholeWord ? `(?<![\\p{L}\\p{N}_])${source}(?![\\p{L}\\p{N}_])` : source, `g${matchCase ? '' : 'i'}u`);
  } catch {
    return null;
  }
}

const FORMAT_TESTS = {
  bold: (style) => Number(style.fontWeight) >= 600,
  italic: (style) => style.fontStyle === 'italic',
  underline: (style) => style.textDecorationLine.includes('underline'),
  highlight: (style) => style.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(style.backgroundColor),
  heading: (_, el) => Boolean(el.closest('h1, h2, h3, h4, h5, h6')),
  colored: (style) => style.color !== 'rgb(30, 41, 59)' && style.color !== 'rgb(0, 0, 0)',
  link: (_, el) => Boolean(el.closest('a')),
  comment: (_, el) => Boolean(el.closest('mark.wd-cmark')),
};

/** Devuelve rangos de coincidencias. Cada página se recorre como un texto continuo para encontrar frases que cruzan nodos. */
export function findAll(desk, options) {
  const pattern = buildPattern(options);
  const format = options.format && FORMAT_TESTS[options.format];
  if (!pattern && !format) return [];
  const results = [];
  desk.querySelectorAll('[data-page-body]').forEach((body) => {
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let text = '';
    let node = walker.nextNode();
    while (node) {
      nodes.push({ node, start: text.length });
      text += node.data;
      node = walker.nextNode();
    }
    const locate = (index) => {
      let at = nodes.length - 1;
      while (at > 0 && nodes[at].start > index) at -= 1;
      return [nodes[at].node, index - nodes[at].start];
    };
    const push = (from, to) => {
      if (to <= from) return;
      const range = document.createRange();
      const [startNode, startOffset] = locate(from);
      const [endNode, endOffset] = locate(to - 1);
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset + 1);
      if (format) {
        const el = startNode.parentElement;
        if (!format(window.getComputedStyle(el), el)) return;
      }
      results.push(range);
    };
    if (pattern) {
      pattern.lastIndex = 0;
      let match = pattern.exec(text);
      while (match) {
        if (!match[0]) pattern.lastIndex += 1;
        else push(match.index, match.index + match[0].length);
        match = pattern.exec(text);
      }
    } else {
      nodes.forEach(({ node: textNode, start }) => {
        if (textNode.data.trim()) push(start, start + textNode.data.length);
      });
    }
  });
  return results;
}

export function paintMatches(ranges, currentIndex) {
  if (!hasHighlights()) return;
  CSS.highlights.set(HIGHLIGHT, new Highlight(...ranges));
  const current = ranges[currentIndex];
  if (current) CSS.highlights.set(CURRENT, new Highlight(current));
  else CSS.highlights.delete(CURRENT);
}

export function clearMatches() {
  if (!hasHighlights()) return;
  CSS.highlights.delete(HIGHLIGHT);
  CSS.highlights.delete(CURRENT);
}

export function revealRange(range, select = true) {
  if (!range) return;
  const el = range.startContainer.parentElement;
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  if (select) {
    const sel = document.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

export function replaceRange(range, replacement, pattern) {
  const original = range.toString();
  const text = pattern ? original.replace(new RegExp(pattern.source, pattern.flags.replace('g', '')), replacement) : replacement;
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  return node;
}

export function replaceAll(desk, options, replacement) {
  const ranges = findAll(desk, options);
  const pattern = options.regex ? buildPattern(options) : null;
  for (let index = ranges.length - 1; index >= 0; index -= 1) replaceRange(ranges[index], replacement, pattern);
  return ranges.length;
}

/** Rangos de texto con el mismo formato visual que el elemento dado. */
export function similarFormatRanges(desk, el) {
  if (!el) return [];
  const ref = window.getComputedStyle(el);
  const key = (style) => [style.fontFamily, style.fontSize, style.fontWeight, style.fontStyle, style.color, style.backgroundColor, style.textDecorationLine].join('|');
  const wanted = key(ref);
  const ranges = [];
  desk.querySelectorAll('[data-page-body]').forEach((body) => {
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.data.trim() && key(window.getComputedStyle(node.parentElement)) === wanted) {
        const range = document.createRange();
        range.selectNodeContents(node);
        ranges.push(range);
      }
      node = walker.nextNode();
    }
  });
  return ranges;
}
