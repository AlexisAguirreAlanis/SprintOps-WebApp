// Render diferido de contenido enriquecido: Mermaid, LaTeX (KaTeX), campos automáticos y decoraciones de comentarios.

import { escapeHtml } from '../sanitize';
import { formatPageNumber } from '../model';

let mermaidPromise = null;
let katexPromise = null;
let mermaidSerial = 0;

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', flowchart: { htmlLabels: false }, fontFamily: 'ui-sans-serif, system-ui, sans-serif' });
      return mermaid;
    });
  }
  return mermaidPromise;
}

export function loadKatex() {
  if (!katexPromise) {
    katexPromise = Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([mod]) => mod.default || mod);
  }
  return katexPromise;
}

export async function renderMermaid(code) {
  const mermaid = await loadMermaid();
  mermaidSerial += 1;
  const { svg } = await mermaid.render(`wd-mermaid-${Date.now()}-${mermaidSerial}`, code);
  return svg;
}

export async function renderTex(tex, displayMode = true) {
  const katex = await loadKatex();
  return katex.renderToString(tex, { throwOnError: false, displayMode, output: 'html' });
}

export async function hydrateRich(root) {
  const mermaidNodes = [...root.querySelectorAll('figure.wd-mermaid')].filter((el) => !el.querySelector('svg') || el.dataset.dirty);
  for (const el of mermaidNodes) {
    try {
      el.innerHTML = await renderMermaid(el.dataset.code || 'graph LR; A-->B');
      delete el.dataset.dirty;
    } catch (err) {
      el.innerHTML = `<pre class="wd-mermaid-error">${escapeHtml(err?.message || 'Diagrama Mermaid inválido')}</pre>`;
    }
  }
  const tex = [...root.querySelectorAll('.wd-eq')].filter((el) => !el.querySelector('.katex') || el.dataset.dirty);
  if (tex.length) {
    await loadKatex();
    for (const el of tex) {
      el.innerHTML = await renderTex(el.dataset.tex || '', el.tagName !== 'SPAN');
      delete el.dataset.dirty;
    }
  }
}

/** Rellena los campos automáticos de encabezados/pies y del cuerpo. */
export function hydrateFields(root, context) {
  root.querySelectorAll('.wd-field[data-field]').forEach((el) => {
    const page = el.closest('[data-page-index]');
    const index = Number(page?.dataset.pageIndex || 0);
    const value = {
      page: formatPageNumber(context.pageStart + index, context.pageFormat),
      pages: String(context.pageCount + context.pageStart - 1),
      date: new Intl.DateTimeFormat(context.language || 'es', { dateStyle: el.dataset.format || 'long' }).format(new Date()),
      time: new Intl.DateTimeFormat(context.language || 'es', { timeStyle: 'short' }).format(new Date()),
      title: context.title || 'Documento',
      author: context.author || '',
      words: String(context.words ?? ''),
      updated: context.updatedAt ? new Intl.DateTimeFormat(context.language || 'es', { dateStyle: 'medium' }).format(new Date(context.updatedAt)) : '',
    }[el.dataset.field];
    if (value !== undefined && el.textContent !== value) el.textContent = value;
  });
}

export function fieldHtml(field, label) {
  return `<span class="wd-field" contenteditable="false" data-field="${field}">${escapeHtml(label || field)}</span>&nbsp;`;
}

/** Envuelve cada cita de comentario en <mark> para resaltarla. No forma parte del contenido guardado. */
export function decorateComments(root, comments, activeId) {
  root.querySelectorAll('mark.wd-cmark').forEach((mark) => mark.replaceWith(...mark.childNodes));
  root.querySelectorAll('[data-page-body]').forEach((body) => body.normalize());
  const anchored = new Set();
  comments.filter((comment) => !comment.resolved && comment.quote).forEach((comment) => {
    const bodies = [...root.querySelectorAll('[data-page-body]')];
    for (const body of bodies) {
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let text = '';
      let node = walker.nextNode();
      while (node) {
        nodes.push({ node, start: text.length });
        text += node.data;
        node = walker.nextNode();
      }
      let from = -1;
      let count = 0;
      let search = text.indexOf(comment.quote);
      while (search >= 0) {
        if (count === (comment.occurrence || 0)) { from = search; break; }
        count += 1;
        search = text.indexOf(comment.quote, search + 1);
      }
      if (from < 0) continue;
      const to = from + comment.quote.length;
      nodes.filter(({ node: textNode, start }) => start < to && start + textNode.length > from).forEach(({ node: textNode, start }) => {
        let target = textNode;
        const localEnd = Math.min(target.length, to - start);
        const localStart = Math.max(0, from - start);
        if (localEnd < target.length) target.splitText(localEnd);
        if (localStart > 0) target = target.splitText(localStart);
        const mark = document.createElement('mark');
        mark.className = `wd-cmark${comment.id === activeId ? ' is-active' : ''}`;
        mark.dataset.commentId = comment.id;
        target.replaceWith(mark);
        mark.append(target);
      });
      anchored.add(comment.id);
      break;
    }
  });
  return anchored;
}

export function stripDecorations(html) {
  if (!/wd-cmark|wd-collab|wd-merge-preview/.test(html)) return html;
  const root = document.createElement('div');
  root.innerHTML = html;
  root.querySelectorAll('mark.wd-cmark').forEach((mark) => mark.replaceWith(...mark.childNodes));
  root.querySelectorAll('.wd-collab').forEach((el) => el.classList.remove('wd-collab'));
  root.querySelectorAll('[data-collab]').forEach((el) => el.removeAttribute('data-collab'));
  root.querySelectorAll('.wd-merge[data-preview]').forEach((el) => {
    el.textContent = `«${el.dataset.field}»`;
    el.removeAttribute('data-preview');
  });
  root.normalize();
  return root.innerHTML;
}
