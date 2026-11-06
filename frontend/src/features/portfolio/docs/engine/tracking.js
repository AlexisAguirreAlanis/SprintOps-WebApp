// Control de cambios: inserciones (<ins>), eliminaciones (<del>) y cambios de formato (span.wd-fmtchg).
// Cada marca lleva autor y fecha para poder aceptarla, rechazarla o recorrerla.

import { escapeHtml } from '../sanitize';

const MARKS = 'ins.wd-ins, del.wd-del, span.wd-fmtchg';

function stamp(el, user) {
  el.dataset.author = user?.name || user?.username || 'Usuario';
  el.dataset.authorId = String(user?.id ?? '');
  el.dataset.time = new Date().toISOString();
  return el;
}

function ownIns(node, user) {
  const el = node?.nodeType === 3 ? node.parentElement : node;
  const ins = el?.closest?.('ins.wd-ins');
  return ins && ins.dataset.authorId === String(user?.id ?? '') ? ins : null;
}

function placeAfter(node) {
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  const sel = document.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function placeBefore(node) {
  const range = document.createRange();
  range.setStartBefore(node);
  range.collapse(true);
  const sel = document.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

export function trackInsertText(text, user) {
  const sel = document.getSelection();
  if (!sel.rangeCount) return false;
  let range = sel.getRangeAt(0);
  if (!range.collapsed) {
    trackDelete('deleteContentBackward', user);
    range = sel.getRangeAt(0);
  }
  if (ownIns(range.startContainer, user)) return false;
  const ins = stamp(document.createElement('ins'), user);
  ins.className = 'wd-ins';
  ins.textContent = text;
  range.insertNode(ins);
  const caret = document.createRange();
  caret.setStart(ins.firstChild, ins.firstChild.length);
  caret.collapse(true);
  sel.removeAllRanges();
  sel.addRange(caret);
  return true;
}

export function trackInsertHtml(html, user) {
  const sel = document.getSelection();
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) trackDelete('deleteContentBackward', user);
  const ins = stamp(document.createElement('ins'), user);
  ins.className = 'wd-ins';
  ins.innerHTML = html;
  sel.getRangeAt(0).insertNode(ins);
  placeAfter(ins);
}

export function trackDelete(inputType, user) {
  const sel = document.getSelection();
  if (!sel.rangeCount) return false;
  const backward = !/Forward/.test(inputType);
  if (sel.isCollapsed) sel.modify('extend', backward ? 'backward' : 'forward', /Word/.test(inputType) ? 'word' : 'character');
  const range = sel.getRangeAt(0);
  if (range.collapsed) return true;
  const startEl = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;
  const own = ownIns(range.startContainer, user);
  if (own && own.contains(range.endContainer)) {
    range.deleteContents();
    if (!own.textContent) own.remove();
    return true;
  }
  if (startEl.closest('del.wd-del')) {
    const del = startEl.closest('del.wd-del');
    if (backward) placeBefore(del);
    else placeAfter(del);
    return true;
  }
  const fragment = range.extractContents();
  fragment.querySelectorAll?.('ins.wd-ins').forEach((ins) => {
    if (ins.dataset.authorId === String(user?.id ?? '')) ins.remove();
  });
  const blocks = fragment.querySelectorAll?.('p, h1, h2, h3, h4, h5, h6, li');
  const del = stamp(document.createElement('del'), user);
  del.className = 'wd-del';
  if (blocks?.length) {
    del.textContent = fragment.textContent;
  } else del.append(fragment);
  if (!del.textContent) return true;
  range.insertNode(del);
  if (backward) placeBefore(del);
  else placeAfter(del);
  return true;
}

/** Envuelve la selección en una marca de cambio de formato que guarda el HTML original para poder rechazarla. */
export function trackFormat(apply, user) {
  const sel = document.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) {
    apply();
    return;
  }
  const original = sel.getRangeAt(0).cloneContents();
  const holder = document.createElement('div');
  holder.append(original);
  apply();
  const range = sel.rangeCount ? sel.getRangeAt(0) : null;
  if (!range || range.collapsed) return;
  const span = stamp(document.createElement('span'), user);
  span.className = 'wd-fmtchg';
  span.dataset.original = holder.innerHTML;
  try {
    range.surroundContents(span);
  } catch {
    span.append(range.extractContents());
    range.insertNode(span);
  }
}

export function allChanges(desk) {
  return [...desk.querySelectorAll(MARKS)];
}

export function changeAt(node) {
  const el = node?.nodeType === 3 ? node.parentElement : node;
  return el?.closest?.(MARKS) || null;
}

export function acceptChange(mark) {
  if (!mark?.isConnected) return;
  if (mark.matches('del.wd-del')) mark.remove();
  else mark.replaceWith(...mark.childNodes);
}

export function rejectChange(mark) {
  if (!mark?.isConnected) return;
  if (mark.matches('ins.wd-ins')) mark.remove();
  else if (mark.matches('span.wd-fmtchg')) {
    const holder = document.createElement('template');
    holder.innerHTML = mark.dataset.original || mark.innerHTML;
    mark.replaceWith(holder.content);
  } else mark.replaceWith(...mark.childNodes);
}

export function changeLabel(mark) {
  const kind = mark.matches('ins') ? 'Insertó' : mark.matches('del') ? 'Eliminó' : 'Cambió formato';
  return { kind, author: mark.dataset.author || 'Usuario', time: mark.dataset.time, text: mark.textContent.slice(0, 120) };
}

// ---- Comparación de documentos (diff por palabras dentro de bloques alineados) ----

function lcsPairs(a, b, eq = (x, y) => x === y) {
  const n = a.length;
  const m = b.length;
  if (n * m > 4_000_000) return null;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) { ops.push(['=', a[i], b[j]]); i += 1; j += 1; } else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push(['-', a[i]]); i += 1; } else { ops.push(['+', b[j]]); j += 1; }
  }
  while (i < n) { ops.push(['-', a[i]]); i += 1; }
  while (j < m) { ops.push(['+', b[j]]); j += 1; }
  return ops;
}

function blocksOf(html) {
  const root = document.createElement('div');
  root.innerHTML = html;
  return [...root.children].map((el) => ({ html: el.outerHTML, text: el.textContent.trim(), tag: el.tagName.toLowerCase() }));
}

function wordDiff(before, after, author) {
  const a = before.split(/(\s+)/);
  const b = after.split(/(\s+)/);
  const ops = lcsPairs(a, b) || [['-', before], ['+', after]];
  const meta = `data-author="${escapeHtml(author)}" data-time="${new Date().toISOString()}"`;
  return ops.map(([op, x]) => {
    if (op === '=') return escapeHtml(x);
    if (op === '-') return `<del class="wd-del" ${meta}>${escapeHtml(x)}</del>`;
    return `<ins class="wd-ins" ${meta}>${escapeHtml(x)}</ins>`;
  }).join('');
}

/** Devuelve HTML con las diferencias de `revised` respecto a `original` marcadas como cambios. */
export function compareHtml(original, revised, author = 'Comparación') {
  const a = blocksOf(original);
  const b = blocksOf(revised);
  const ops = lcsPairs(a, b, (x, y) => x.text === y.text) || [...a.map((x) => ['-', x]), ...b.map((y) => ['+', y])];
  const out = [];
  const meta = `data-author="${escapeHtml(author)}" data-time="${new Date().toISOString()}"`;
  for (let index = 0; index < ops.length; index += 1) {
    const [op, x, y] = ops[index];
    const next = ops[index + 1];
    if (op === '=') out.push(y.html);
    else if (op === '-' && next?.[0] === '+' && x.tag === next[1].tag) {
      out.push(`<${x.tag}>${wordDiff(x.text, next[1].text, author)}</${x.tag}>`);
      index += 1;
    } else if (op === '-') out.push(`<${x.tag === 'li' ? 'p' : x.tag}><del class="wd-del" ${meta}>${escapeHtml(x.text)}</del></${x.tag === 'li' ? 'p' : x.tag}>`);
    else out.push(`<ins class="wd-ins wd-ins-block" ${meta}>${x.html}</ins>`);
  }
  return out.join('');
}

/** Fusión a tres vías por bloques: aplica los cambios de ambos lados y reporta conflictos. */
export function merge3(base, mine, theirs) {
  const b = blocksOf(base).map((x) => x.html);
  const m = blocksOf(mine).map((x) => x.html);
  const t = blocksOf(theirs).map((x) => x.html);
  const hunks = (other) => {
    const ops = lcsPairs(b, other);
    if (!ops) return null;
    const list = [];
    let bi = 0;
    let current = null;
    ops.forEach(([op, x]) => {
      if (op === '=') {
        if (current) { list.push(current); current = null; }
        bi += 1;
      } else {
        if (!current) current = { start: bi, end: bi, lines: [] };
        if (op === '-') { bi += 1; current.end = bi; } else current.lines.push(x);
      }
    });
    if (current) list.push(current);
    return list;
  };
  const hm = hunks(m);
  const ht = hunks(t);
  if (!hm || !ht) return { merged: mine, conflicts: 1 };
  const all = [...hm.map((h) => ({ ...h, side: 'm' })), ...ht.map((h) => ({ ...h, side: 't' }))].sort((x, y) => x.start - y.start || (x.side === 'm' ? -1 : 1));
  const out = [];
  let cursor = 0;
  let conflicts = 0;
  for (let index = 0; index < all.length; index += 1) {
    const hunk = all[index];
    const other = all[index + 1];
    out.push(...b.slice(cursor, hunk.start));
    if (other && other.side !== hunk.side && other.start < Math.max(hunk.end, hunk.start + 1) && !(other.start === hunk.end && hunk.end === hunk.start)) {
      const same = hunk.lines.join('') === other.lines.join('') && hunk.end === other.end;
      if (!same) conflicts += 1;
      const mineHunk = hunk.side === 'm' ? hunk : other;
      out.push(...mineHunk.lines);
      cursor = Math.max(hunk.end, other.end);
      index += 1;
    } else {
      out.push(...hunk.lines);
      cursor = hunk.end;
    }
  }
  out.push(...b.slice(cursor));
  return { merged: out.join(''), conflicts };
}
