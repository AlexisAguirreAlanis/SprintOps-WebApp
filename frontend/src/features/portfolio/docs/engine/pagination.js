// Paginación automática: mueve bloques entre páginas según el alto disponible.
// Respeta saltos de página/sección, "mantener con el siguiente", divide párrafos y tablas largas
// y vuelve a unir los trozos cuando hay espacio.

import { uid } from '../model';

const BREAK = 'hr.wd-break';

const isBreakBefore = (el) => el.style?.breakBefore === 'page' || el.dataset?.breakBefore === 'page';
const overflowing = (body) => body.scrollHeight > body.clientHeight + 2 || body.scrollWidth > body.clientWidth + 2;

function firstOverflowIndex(body) {
  const limitY = body.clientHeight + 1;
  const limitX = body.clientWidth - 1;
  const children = [...body.children];
  return children.findIndex((child) => child.offsetTop + child.offsetHeight > limitY || child.offsetLeft >= limitX);
}

function textNodes(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node = walker.nextNode();
  while (node) {
    if (node.length) nodes.push(node);
    node = walker.nextNode();
  }
  return nodes;
}

/** Punto (nodo, offset) donde empieza la primera línea que no cabe por encima de limitY (coordenadas de pantalla). */
function splitPoint(block, limitY) {
  const nodes = textNodes(block);
  const offsets = [];
  let total = 0;
  nodes.forEach((node) => { offsets.push(total); total += node.length; });
  if (total < 2) return null;
  const locate = (index) => {
    let at = nodes.length - 1;
    while (at > 0 && offsets[at] > index) at -= 1;
    return [nodes[at], index - offsets[at]];
  };
  const range = document.createRange();
  const rectAt = (index) => {
    const [node, offset] = locate(index);
    range.setStart(node, offset);
    range.setEnd(node, Math.min(node.length, offset + 1));
    return range.getBoundingClientRect();
  };
  let lo = 0;
  let hi = total - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const rect = rectAt(mid);
    if (rect.height && rect.bottom > limitY) {
      found = mid;
      hi = mid - 1;
    } else lo = mid + 1;
  }
  if (found <= 0) return null;
  const top = rectAt(found).top;
  let start = found;
  for (let guard = 0; start > 0 && guard < 400; guard += 1) {
    const rect = rectAt(start - 1);
    if (rect.height && rect.top < top - 2) break;
    start -= 1;
  }
  if (start <= 0) return null;
  return locate(start);
}

function splitParagraph(block, limitY) {
  const point = splitPoint(block, limitY);
  if (!point) return null;
  const range = document.createRange();
  range.setStart(point[0], point[1]);
  range.setEnd(block, block.childNodes.length);
  const rest = block.cloneNode(false);
  rest.removeAttribute('id');
  rest.append(range.extractContents());
  if (!rest.textContent.trim()) return null;
  const id = block.dataset.cont || uid('c');
  block.dataset.cont = id;
  rest.dataset.cont = id;
  return rest;
}

function splitTable(table, limitY) {
  const rows = [...table.rows];
  const index = rows.findIndex((row) => row.getBoundingClientRect().bottom > limitY);
  const header = table.dataset.repeatHeader === 'true' ? 1 : 0;
  if (index <= header) return null;
  const rest = table.cloneNode(false);
  const tbody = document.createElement('tbody');
  rest.append(tbody);
  if (header) tbody.append(rows[0].cloneNode(true));
  rows.slice(index).forEach((row) => tbody.append(row));
  const id = table.dataset.cont || uid('t');
  table.dataset.cont = id;
  rest.dataset.cont = id;
  return rest;
}

function mergeInto(prev, next) {
  if (prev.tagName === 'TABLE') {
    const body = prev.tBodies[0] || prev;
    const rows = [...next.rows];
    rows.slice(next.dataset.repeatHeader === 'true' ? 1 : 0).forEach((row) => body.append(row));
  } else {
    if (prev.lastChild?.nodeName === 'BR') prev.lastChild.remove();
    prev.append(...next.childNodes);
  }
  next.remove();
}

function moveToNext(bodies, index, nodes, addPage) {
  if (!nodes.length) return false;
  const next = bodies[index + 1];
  if (next) {
    next.prepend(...nodes);
    return true;
  }
  const holder = document.createElement('div');
  holder.append(...nodes);
  addPage(holder.innerHTML);
  return 'wait';
}

function step(bodies, { addPage, removePage, pageStart }) {
  for (let index = 0; index < bodies.length; index += 1) {
    const body = bodies[index];
    const children = [...body.children];
    const next = bodies[index + 1];

    const breakAt = children.findIndex((child, at) => (child.matches(BREAK) && !child.dataset.filler && child.dataset.section !== 'continuous' && at < children.length - 1) || (at > 0 && isBreakBefore(child)));
    if (breakAt >= 0) {
      const from = children[breakAt].matches(BREAK) ? breakAt + 1 : breakAt;
      return moveToNext(bodies, index, children.slice(from), addPage);
    }

    const last = children[children.length - 1];
    if (last?.matches(BREAK) && next && /^(even|odd)$/.test(last.dataset.section || '')) {
      const pageNumber = pageStart + index + 1;
      const wantsEven = last.dataset.section === 'even';
      const parityOk = (pageNumber % 2 === 0) === wantsEven;
      const filler = next.firstElementChild?.dataset.filler ? next.firstElementChild : null;
      if (!parityOk && !filler) {
        const hr = document.createElement('hr');
        hr.className = 'wd-break';
        hr.dataset.filler = '1';
        next.prepend(hr);
        return true;
      }
      if (parityOk && filler) {
        filler.remove();
        return true;
      }
    }

    if (overflowing(body) && children.length) {
      let at = firstOverflowIndex(body);
      if (at < 0) at = children.length - 1;
      const target = children[at];
      const scale = body.getBoundingClientRect().height / (body.offsetHeight || 1) || 1;
      const limitY = body.getBoundingClientRect().top + body.clientHeight * scale;
      const tooTall = target.offsetHeight > body.clientHeight * 0.95;
      const canSplit = target.dataset.keepLines !== 'true' && (target.tagName === 'P' || target.tagName === 'TABLE');
      if (canSplit && (tooTall || at === children.length - 1 || target.dataset.keepNext !== 'true')) {
        const rest = target.tagName === 'TABLE' ? splitTable(target, limitY) : splitParagraph(target, limitY);
        if (rest) return moveToNext(bodies, index, [rest, ...children.slice(at + 1)], addPage);
      }
      if (at === 0) {
        if (children.length > 1) return moveToNext(bodies, index, children.slice(1), addPage);
        continue;
      }
      while (at > 1 && children[at - 1].dataset.keepNext === 'true') at -= 1;
      return moveToNext(bodies, index, children.slice(at), addPage);
    }

    if (next && !overflowing(body) && !last?.matches(BREAK)) {
      const candidate = next.firstElementChild;
      if (!candidate) {
        if (!next.textContent.trim() && bodies.length > 1) {
          removePage(next.dataset.pageId);
          return 'wait';
        }
        continue;
      }
      if (candidate.dataset.filler || isBreakBefore(candidate)) continue;
      const spare = body.clientHeight - (last ? last.offsetTop + last.offsetHeight : 0);
      if (last && candidate.dataset.cont && last.dataset.cont === candidate.dataset.cont) {
        if (spare < 44) continue;
        mergeInto(last, candidate);
        return true;
      }
      if (spare < 18) continue;
      body.append(candidate);
      if (overflowing(body)) {
        next.prepend(candidate);
        continue;
      }
      if (!next.firstElementChild && !next.textContent.trim()) {
        removePage(next.dataset.pageId);
        return 'wait';
      }
      return true;
    }
  }
  return false;
}

export function reflow(desk, options) {
  if (!desk) return;
  for (let guard = 0; guard < 800; guard += 1) {
    const bodies = [...desk.querySelectorAll('[data-page-body]')];
    const result = step(bodies, options);
    if (!result || result === 'wait') return;
  }
}

const SUBSTANCE = 'img, table, svg, iframe, figure, video, canvas, ul, ol, pre, hr:not(.wd-break)';

function visibleText(node) {
  const raw = node?.startContainer ? node.toString() : (node?.textContent || '');
  return raw.replace(/\u00a0/g, ' ').trim();
}

function hasSubstance(el) {
  return Boolean(el?.matches?.(SUBSTANCE) || el?.querySelector?.(SUBSTANCE));
}

function isBlankPage(body) {
  return ![...body.children].some((el) => {
    if (el.matches('hr.wd-break, br')) return false;
    if (hasSubstance(el)) return true;
    return visibleText(el).length > 0;
  });
}

function isEmptyBlock(el) {
  if (!el || el.nodeType !== 1) return false;
  if (el.matches('hr.wd-break, br')) return true;
  if (hasSubstance(el)) return false;
  return !visibleText(el);
}

function placeCaretIn(body, el, atStart) {
  if (!body) return;
  body.focus({ preventScroll: true });
  const range = document.createRange();
  range.selectNodeContents(el || body);
  range.collapse(atStart);
  const sel = document.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function removeBlankPages(bodies, index) {
  const prev = bodies[index - 1];
  const current = bodies[index];
  let end = index;
  const holdsFollowing = [...current.children].some((el) => el.matches('hr.wd-break') && !el.dataset.filler);
  if (holdsFollowing) {
    while (end + 1 < bodies.length && isBlankPage(bodies[end + 1])) end += 1;
  }
  const followingHasContent = end + 1 < bodies.length && !isBlankPage(bodies[end + 1]);
  const prevBreak = prev.lastElementChild?.matches?.('hr.wd-break') ? prev.lastElementChild : null;
  if (followingHasContent) {
    if (!prevBreak) {
      const hr = document.createElement('hr');
      hr.className = 'wd-break';
      prev.append(hr);
    }
  } else if (prevBreak) prevBreak.remove();
  placeCaretIn(prev, null, false);
  const removeIds = [];
  for (let at = index; at <= end; at += 1) {
    bodies[at].replaceChildren();
    removeIds.push(bodies[at].dataset.pageId);
  }
  return { removeIds };
}

/**
 * Retroceso o Supr sobre la primera línea de una página que no es la primera.
 * Si la página solo tiene esa línea vacía, se quita el salto y la página.
 * Si hay más contenido, solo se quita la línea vacía.
 * Con el cursor al inicio de una línea con texto, el salto se elimina y la página se une a la anterior.
 */
export function absorbPageBoundary(desk, key) {
  if (!desk || (key !== 'Backspace' && key !== 'Delete')) return null;
  const sel = document.getSelection();
  if (!sel?.rangeCount) return null;
  const range = sel.getRangeAt(0);
  const host = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
  const body = host?.closest?.('[data-page-body]');
  if (!body || !desk.contains(body)) return null;
  const bodies = [...desk.querySelectorAll('[data-page-body]')];
  const index = bodies.indexOf(body);
  if (index <= 0 || !body.contains(range.endContainer)) return null;

  if (isBlankPage(body) && !visibleText(sel.getRangeAt(0))) {
    return removeBlankPages(bodies, index);
  }
  if (!sel.isCollapsed) return null;

  const first = [...body.children].find((el) => !el.matches('hr.wd-break'));
  if (!first) return removeBlankPages(bodies, index);
  if (first !== range.startContainer && !first.contains(range.startContainer)) return null;
  const before = document.createRange();
  before.setStart(first, 0);
  before.setEnd(range.startContainer, range.startOffset);
  if (visibleText(before)) return null;

  if (isEmptyBlock(first)) {
    first.remove();
    if (isBlankPage(body)) return removeBlankPages(bodies, index);
    const next = [...body.children].find((el) => !el.matches('hr.wd-break')) || body;
    placeCaretIn(body, next, true);
    return { removeIds: [] };
  }

  if (key !== 'Backspace') return null;
  const prev = bodies[index - 1];
  const breakEl = prev.lastElementChild?.matches?.('hr.wd-break') ? prev.lastElementChild : null;
  if (!breakEl) return null;
  const moved = [...body.childNodes];
  const anchor = moved.find((node) => node.nodeType === 1 && !node.matches?.('hr.wd-break')) || null;
  breakEl.replaceWith(...moved);
  placeCaretIn(prev, anchor, true);
  return { removeIds: [body.dataset.pageId] };
}

/** Une los trozos de párrafos/tablas divididos por la paginación (para exportar como flujo continuo). */
export function joinContinuations(html) {
  const root = document.createElement('div');
  root.innerHTML = html;
  let node = root.firstElementChild;
  while (node) {
    const next = node.nextElementSibling;
    if (next && node.dataset.cont && next.dataset.cont === node.dataset.cont) {
      mergeInto(node, next);
      continue;
    }
    node.removeAttribute('data-cont');
    node = next;
  }
  root.querySelectorAll('hr.wd-break[data-filler]').forEach((hr) => hr.remove());
  return root.innerHTML;
}
