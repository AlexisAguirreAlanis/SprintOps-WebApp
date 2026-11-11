// Núcleo de edición: selección, formato en línea y de bloque, inserción, historial y cursor.
// Trabaja sobre el DOM de las páginas (contentEditable); no conoce React.

export const BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, td, th, summary, div.wd-callout, figure, div.wd-live';
export const BODY_SELECTOR = '[data-page-body]';
export const EDITABLE_SELECTOR = '[data-page-body], .wd-chrome';

let saved = null;
let holding = false;
let multi = [];

function paintHold() {
  if (!saved || saved.collapsed || typeof Highlight === 'undefined' || !CSS?.highlights) return;
  try { CSS.highlights.set('wd-hold', new Highlight(saved)); } catch { /* el navegador no pinta highlights */ }
}

export function clearHold() {
  holding = false;
  try { CSS.highlights?.delete('wd-hold'); } catch { /* ignore */ }
}

export function selectionHeld() {
  return holding;
}

/** Conserva la selección mientras el foco pasa a la cinta o a un campo de la barra. */
export function holdSelection(desk) {
  const range = rangeIn(desk);
  if (range) {
    saved = range.cloneRange();
    if (!range.collapsed) {
      holding = true;
      paintHold();
      return;
    }
  }
  holding = false;
  try { CSS.highlights?.delete('wd-hold'); } catch { /* ignore */ }
}

export function selection() {
  return document.getSelection();
}

export function rangeIn(desk) {
  const sel = selection();
  if (!sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  return desk?.contains(range.commonAncestorContainer) ? range : null;
}

export function rememberSelection(desk) {
  const range = rangeIn(desk);
  if (!range) return;
  if (holding && range.collapsed && saved && !saved.collapsed) return;
  saved = range.cloneRange();
}

export function savedRange() {
  return saved;
}

export function hostOf(node) {
  const el = node?.nodeType === 3 ? node.parentElement : node;
  return el?.closest?.(EDITABLE_SELECTOR) || null;
}

export function restoreSelection(desk) {
  const sel = selection();
  if (rangeIn(desk) && hostOf(sel.anchorNode)) {
    clearHold();
    return true;
  }
  if (saved && desk?.contains(saved.startContainer)) {
    const host = hostOf(saved.startContainer);
    host?.focus({ preventScroll: true });
    sel.removeAllRanges();
    sel.addRange(saved);
    if (host && document.activeElement && host.contains(document.activeElement)) clearHold();
    return true;
  }
  const body = desk?.querySelector(BODY_SELECTOR);
  if (!body) return false;
  body.focus({ preventScroll: true });
  placeCaret(body, false);
  return true;
}

export function placeCaret(node, atStart = true) {
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(atStart);
  const sel = selection();
  sel.removeAllRanges();
  sel.addRange(range);
}

export function selectNode(node) {
  const range = document.createRange();
  range.selectNode(node);
  const sel = selection();
  sel.removeAllRanges();
  sel.addRange(range);
}

export function anchorElement() {
  const node = selection()?.anchorNode;
  return node?.nodeType === 3 ? node.parentElement : node;
}

export function currentBlock(desk) {
  const el = anchorElement();
  if (!el || !desk?.contains(el)) return null;
  return el.closest(BLOCK_SELECTOR);
}

export function selectedBlocks(desk) {
  const range = rangeIn(desk) || saved;
  if (!range) return [];
  if (range.collapsed) {
    const el = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;
    const block = el?.closest?.(BLOCK_SELECTOR);
    return block ? [block] : [];
  }
  const blocks = [...desk.querySelectorAll(BLOCK_SELECTOR)].filter((block) => range.intersectsNode(block));
  return blocks.filter((block) => !blocks.some((other) => other !== block && block.contains(other) && other.matches('li, td, th, p, h1, h2, h3, h4, h5, h6')));
}

function focusDesk(desk) {
  const sel = selection();
  const host = hostOf(sel?.anchorNode) || desk?.querySelector(BODY_SELECTOR);
  host?.focus({ preventScroll: true });
}

function toggleScript(desk, mode) {
  const range = rangeIn(desk);
  if (!range) return false;
  const tag = mode === 'subscript' ? 'SUB' : 'SUP';
  const el = anchorElement();
  const wrap = el?.closest?.('sub, sup');
  if (wrap && desk.contains(wrap)) {
    const same = wrap.tagName === tag;
    const inside = range.intersectsNode(wrap);
    if (same && (inside || range.collapsed)) {
      const parent = wrap.parentNode;
      while (wrap.firstChild) parent.insertBefore(wrap.firstChild, wrap);
      wrap.remove();
      rememberSelection(desk);
      return true;
    }
  }
  if (!range.collapsed) {
    const node = document.createElement(tag.toLowerCase());
    try {
      range.surroundContents(node);
    } catch {
      node.appendChild(range.extractContents());
      range.insertNode(node);
    }
    const caret = document.createRange();
    caret.selectNodeContents(node);
    caret.collapse(false);
    selection().removeAllRanges();
    selection().addRange(caret);
    rememberSelection(desk);
    return true;
  }
  document.execCommand('styleWithCSS', false, false);
  if (document.execCommand(mode, false, null)) {
    rememberSelection(desk);
    return true;
  }
  applyInlineStyle(desk, {
    verticalAlign: mode === 'subscript' ? 'sub' : 'super',
    fontSize: '0.75em',
    lineHeight: '1',
  });
  return true;
}

export function exec(desk, name, value = null) {
  restoreSelection(desk);
  focusDesk(desk);
  if (name === 'subscript' || name === 'superscript') {
    const ok = toggleScript(desk, name);
    rememberSelection(desk);
    return ok;
  }
  document.execCommand('styleWithCSS', false, true);
  const ok = document.execCommand(name, false, value);
  rememberSelection(desk);
  return ok;
}

/** Aplica estilos CSS arbitrarios a la selección (multi-bloque). Con cursor colapsado, prepara un span para lo que se escriba. */
export function applyInlineStyle(desk, styles) {
  if (multi.length) {
    multi.forEach((range) => wrapRange(range, styles));
    return;
  }
  restoreSelection(desk);
  const range = rangeIn(desk);
  if (!range) return;
  if (range.collapsed) {
    const span = document.createElement('span');
    Object.assign(span.style, styles);
    span.textContent = '\u200b';
    range.insertNode(span);
    const caret = document.createRange();
    caret.setStart(span.firstChild, 1);
    caret.collapse(true);
    selection().removeAllRanges();
    selection().addRange(caret);
    rememberSelection(desk);
    return;
  }
  document.execCommand('styleWithCSS', false, true);
  document.execCommand('fontName', false, 'wd-mark');
  let marked = [...desk.querySelectorAll('span[style*="wd-mark"], font[face="wd-mark"]')];
  if (!marked.length) {
    wrapRange(range, styles);
    rememberSelection(desk);
    return;
  }
  const keys = Object.keys(styles);
  const spans = marked.map((node) => {
    let span = node;
    if (node.tagName === 'FONT') {
      span = document.createElement('span');
      span.append(...node.childNodes);
      node.replaceWith(span);
    }
    span.style.fontFamily = '';
    Object.assign(span.style, styles);
    span.querySelectorAll('[style]').forEach((child) => keys.forEach((key) => { child.style[key] = ''; }));
    if (!span.getAttribute('style')) span.removeAttribute('style');
    return span;
  });
  if (spans.length) {
    const next = document.createRange();
    next.setStartBefore(spans[0]);
    next.setEndAfter(spans[spans.length - 1]);
    selection().removeAllRanges();
    selection().addRange(next);
  }
  rememberSelection(desk);
}

function wrapRange(range, styles) {
  if (range.collapsed) return;
  const span = document.createElement('span');
  Object.assign(span.style, styles);
  try {
    range.surroundContents(span);
  } catch {
    span.append(range.extractContents());
    range.insertNode(span);
  }
}

function stripInlineFontSize(node) {
  if (!node) return;
  if (node.nodeType === 1) {
    node.style?.removeProperty('font-size');
    if (node.getAttribute?.('style') === '') node.removeAttribute('style');
    [...node.childNodes].forEach(stripInlineFontSize);
  }
}

function onlyFontSizeSpan(span) {
  if (!span?.style?.fontSize) return false;
  const rest = span.style.cssText.replace(/font-size:\s*[^;]+;?/gi, '').trim();
  return !rest;
}

function setRangeFontSize(range, px) {
  if (range.collapsed) return null;
  const common = range.commonAncestorContainer;
  const host = common.nodeType === 3 ? common.parentElement : common;
  const wrapper = host?.closest?.('span');
  if (wrapper && onlyFontSizeSpan(wrapper) && rangeInsideNode(range, wrapper)) {
    wrapper.style.fontSize = `${px}px`;
    return wrapper;
  }
  const span = document.createElement('span');
  span.style.fontSize = `${px}px`;
  try {
    range.surroundContents(span);
  } catch {
    const frag = range.extractContents();
    stripInlineFontSize(frag);
    span.appendChild(frag);
    range.insertNode(span);
  }
  return span;
}

function commitRangeSelection(desk, range) {
  selection().removeAllRanges();
  selection().addRange(range);
  saved = range.cloneRange();
  holding = false;
  clearHold();
  rememberSelection(desk);
}

function wordRangeAt(range) {
  const node = range.startContainer;
  if (node.nodeType !== 3 || !node.textContent?.trim()) return null;
  const text = node.textContent;
  let start = range.startOffset;
  let end = range.startOffset;
  const isWord = (ch) => /[^\s\u00a0]/.test(ch);
  while (start > 0 && isWord(text[start - 1])) start -= 1;
  while (end < text.length && isWord(text[end])) end += 1;
  if (start >= end) return null;
  const out = range.cloneRange();
  out.setStart(node, start);
  out.setEnd(node, end);
  return out;
}

function readFontPx(el, desk) {
  if (!el || !desk?.contains(el)) return 16;
  let node = el;
  while (node && node !== desk) {
    const inline = node.style?.fontSize;
    if (inline && /^\d+(\.\d+)?px$/i.test(String(inline).trim())) return Math.round(parseFloat(inline));
    node = node.parentElement;
  }
  return Math.round(parseFloat(window.getComputedStyle(el).fontSize)) || 16;
}

function styledSpanAt(el, desk) {
  let node = el;
  while (node && node !== desk && desk?.contains(node)) {
    if (node.nodeType === 1 && node.tagName === 'SPAN' && node.style.fontSize) return node;
    node = node.parentElement;
  }
  return null;
}

function rangeInsideNode(range, node) {
  if (!range || !node) return false;
  try {
    return node.contains(range.startContainer) && node.contains(range.endContainer);
  } catch {
    return false;
  }
}

function activeRange(desk) {
  const live = rangeIn(desk);
  if (live) return live;
  if (!saved) return null;
  try {
    if (!desk?.contains(saved.startContainer)) return null;
    const clone = saved.cloneRange();
    selection().removeAllRanges();
    selection().addRange(clone);
    return clone;
  } catch {
    return null;
  }
}

export function bumpFontSize(desk, direction, stepPx = 2) {
  if (!desk) return false;
  restoreSelection(desk);
  focusDesk(desk);

  let range = activeRange(desk);
  if (!range) return false;

  if (range.collapsed) {
    const word = wordRangeAt(range);
    if (word) {
      range = word;
      selection().removeAllRanges();
      selection().addRange(range);
    }
  }

  const delta = (Number(direction) > 0 ? 1 : -1) * (Math.abs(Number(stepPx)) || 2);
  const el = anchorElement();
  if (!el || !desk.contains(el)) return false;

  const styled = styledSpanAt(el, desk);
  const current = styled
    ? Math.round(parseFloat(styled.style.fontSize))
    : readFontPx(el, desk);
  const next = Math.max(1, Math.min(400, current + delta));
  if (next === current) return false;

  let target = null;
  if (!range.collapsed) {
    target = setRangeFontSize(range, next);
    const after = document.createRange();
    after.selectNodeContents(target || range.commonAncestorContainer);
    if (target) after.collapse(false);
    else {
      after.setStart(range.startContainer, range.startOffset);
      after.setEnd(range.endContainer, range.endOffset);
    }
    commitRangeSelection(desk, after);
    return true;
  }

  if (styled && onlyFontSizeSpan(styled)) {
    styled.style.fontSize = `${next}px`;
    target = styled;
  } else {
    const word = wordRangeAt(range);
    if (word) {
      target = setRangeFontSize(word, next);
    } else {
      applyInlineStyle(desk, { fontSize: `${next}px` });
      target = styledSpanAt(anchorElement(), desk);
    }
  }

  if (target) {
    const after = document.createRange();
    after.selectNodeContents(target);
    after.collapse(false);
    commitRangeSelection(desk, after);
    return true;
  }

  rememberSelection(desk);
  return true;
}

export function setMultiRanges(ranges) {
  multi = ranges;
}

export function multiRanges() {
  return multi;
}

export function applyBlockStyle(desk, styles) {
  restoreSelection(desk);
  const blocks = selectedBlocks(desk);
  blocks.forEach((block) => Object.assign(block.style, styles));
  return blocks;
}

export function toggleBlockClass(desk, className, force) {
  const blocks = selectedBlocks(desk);
  blocks.forEach((block) => block.classList.toggle(className, force));
  return blocks;
}

export function setBlockTag(desk, tag, className = '') {
  restoreSelection(desk);
  document.execCommand('formatBlock', false, `<${tag}>`);
  const blocks = selectedBlocks(desk);
  blocks.forEach((block) => {
    [...block.classList].filter((name) => name.startsWith('wd-style-')).forEach((name) => block.classList.remove(name));
    if (className) block.classList.add(className);
  });
  rememberSelection(desk);
  return blocks;
}

/** Recorre los nodos de texto de un rango, partiendo los de los extremos para que queden completos dentro. */
export function textNodesInRange(range) {
  if (!range || range.collapsed) return [];
  const { startContainer, startOffset, endContainer, endOffset } = range;
  const root = range.commonAncestorContainer.nodeType === 3 ? range.commonAncestorContainer.parentNode : range.commonAncestorContainer;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node = walker.currentNode.nodeType === 3 ? walker.currentNode : walker.nextNode();
  while (node) {
    if (range.intersectsNode(node)) nodes.push(node);
    node = walker.nextNode();
  }
  return nodes.map((text) => {
    let target = text;
    if (target === endContainer && endOffset < target.length) target.splitText(endOffset);
    if (target === startContainer && startOffset > 0) target = target.splitText(startOffset);
    return target;
  });
}

export function transformCase(desk, mode) {
  restoreSelection(desk);
  const range = rangeIn(desk);
  const nodes = textNodesInRange(range);
  if (!nodes.length) return;
  let sentenceStart = true;
  nodes.forEach((node) => {
    const text = node.data;
    if (mode === 'upper') node.data = text.toLocaleUpperCase();
    else if (mode === 'lower') node.data = text.toLocaleLowerCase();
    else if (mode === 'title') node.data = text.toLocaleLowerCase().replace(/(^|[\s(¿¡"'-])(\p{L})/gu, (_, lead, letter) => lead + letter.toLocaleUpperCase());
    else if (mode === 'toggle') node.data = [...text].map((ch) => (ch === ch.toLocaleUpperCase() ? ch.toLocaleLowerCase() : ch.toLocaleUpperCase())).join('');
    else if (mode === 'sentence') {
      node.data = [...text.toLocaleLowerCase()].map((ch) => {
        if (sentenceStart && /\p{L}/u.test(ch)) { sentenceStart = false; return ch.toLocaleUpperCase(); }
        if (/[.!?]/.test(ch)) sentenceStart = true;
        return ch;
      }).join('');
    }
  });
  const next = document.createRange();
  next.setStart(nodes[0], 0);
  next.setEnd(nodes[nodes.length - 1], nodes[nodes.length - 1].length);
  selection().removeAllRanges();
  selection().addRange(next);
  rememberSelection(desk);
}

export function insertHtml(desk, html) {
  restoreSelection(desk);
  if (!hostOf(selection()?.anchorNode)) {
    const body = desk.querySelector(BODY_SELECTOR);
    body?.focus();
    if (body) placeCaret(body, false);
  }
  document.execCommand('insertHTML', false, html);
  rememberSelection(desk);
}

/** Inserta un bloque después del bloque actual (útil para widgets no editables). */
export function insertBlockHtml(desk, html) {
  restoreSelection(desk);
  const block = currentBlock(desk);
  const top = block?.closest(`${BODY_SELECTOR} > *`) || null;
  const body = top?.parentElement || desk.querySelector(BODY_SELECTOR);
  if (!body) return null;
  const holder = document.createElement('div');
  holder.innerHTML = html;
  const nodes = [...holder.childNodes];
  const empty = top && top.tagName === 'P' && !top.textContent.trim() && !top.querySelector('img, svg, iframe');
  if (top) {
    top.after(...nodes);
    if (empty) top.remove();
  } else body.append(...nodes);
  const last = nodes[nodes.length - 1];
  if (last && !last.nextElementSibling) {
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    last.after(p);
  }
  const after = last?.nextElementSibling;
  if (after) placeCaret(after, true);
  rememberSelection(desk);
  return nodes;
}

export function computedFormat(el) {
  if (!el) return {};
  const style = window.getComputedStyle(el);
  return {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    textDecoration: style.textDecorationLine,
    color: style.color,
    backgroundColor: style.backgroundColor,
    letterSpacing: style.letterSpacing,
    textAlign: style.textAlign,
    lineHeight: style.lineHeight,
  };
}

export function caretPosition(desk) {
  const range = rangeIn(desk);
  if (!range) return null;
  const body = hostOf(range.startContainer)?.closest(BODY_SELECTOR);
  if (!body) return null;
  const measure = document.createRange();
  measure.setStart(body, 0);
  measure.setEnd(range.startContainer, range.startOffset);
  return { pageId: body.dataset.pageId, offset: measure.toString().length, length: range.toString().length };
}

export function restoreCaretPosition(desk, position) {
  if (!position) return;
  const body = desk.querySelector(`${BODY_SELECTOR}[data-page-id="${position.pageId}"]`) || desk.querySelector(BODY_SELECTOR);
  if (!body) return;
  const point = (target) => {
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    let left = target;
    let node = walker.nextNode();
    while (node) {
      if (left <= node.length) return [node, left];
      left -= node.length;
      node = walker.nextNode();
    }
    return null;
  };
  const start = point(position.offset);
  const range = document.createRange();
  if (start) {
    range.setStart(start[0], start[1]);
    const end = position.length ? point(position.offset + position.length) : null;
    if (end) range.setEnd(end[0], end[1]);
    else range.collapse(true);
  } else {
    range.selectNodeContents(body);
    range.collapse(false);
  }
  body.focus({ preventScroll: true });
  selection().removeAllRanges();
  selection().addRange(range);
  rememberSelection(desk);
}

export function createHistory(limit = 150) {
  let stack = [];
  let index = -1;
  return {
    push(entry) {
      const current = stack[index];
      if (current && current.key === entry.key) {
        stack[index] = { ...entry, caret: current.caret };
        return;
      }
      stack = stack.slice(0, index + 1);
      stack.push(entry);
      if (stack.length > limit) stack.shift();
      index = stack.length - 1;
    },
    undo() {
      if (index <= 0) return null;
      index -= 1;
      return stack[index];
    },
    redo() {
      if (index >= stack.length - 1) return null;
      index += 1;
      return stack[index];
    },
    canUndo: () => index > 0,
    canRedo: () => index < stack.length - 1,
    reset(entry) {
      stack = entry ? [entry] : [];
      index = stack.length - 1;
    },
  };
}

export function sortBlocks(desk, direction = 'asc', numeric = false) {
  const blocks = selectedBlocks(desk).filter((block) => block.parentElement === selectedBlocks(desk)[0]?.parentElement);
  if (blocks.length < 2) return false;
  const anchor = blocks[0].previousSibling;
  const parent = blocks[0].parentElement;
  const collator = new Intl.Collator('es', { numeric, sensitivity: 'base' });
  const sorted = [...blocks].sort((a, b) => collator.compare(a.textContent.trim(), b.textContent.trim()) * (direction === 'asc' ? 1 : -1));
  sorted.forEach((block) => block.remove());
  if (anchor) anchor.after(...sorted);
  else parent.prepend(...sorted);
  return true;
}

export function wordsOf(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean);
}
