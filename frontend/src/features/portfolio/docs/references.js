// Referencias: citas y bibliografía, tabla de contenido, notas, títulos, referencias cruzadas e índices.

import { escapeHtml } from './sanitize';
import { formatPageNumber, uid } from './model';

const authorsOf = (source) => String(source.author || '').split(/;|\sy\s|\s&\s/).map((name) => name.trim()).filter(Boolean).map((name) => {
  const [last, first = ''] = name.includes(',') ? name.split(',').map((part) => part.trim()) : [name.split(' ').slice(-1)[0], name.split(' ').slice(0, -1).join(' ')];
  return { last, first, initials: first.split(/\s+/).filter(Boolean).map((part) => `${part[0]}.`).join(' ') };
});

const it = (text) => (text ? `<em>${escapeHtml(text)}</em>` : '');
const e = escapeHtml;
const tail = (source) => [source.doi ? `https://doi.org/${e(source.doi.replace(/^https?:\/\/doi\.org\//, ''))}` : '', !source.doi && source.url ? e(source.url) : ''].filter(Boolean).join(' ');

export const CITATION_STYLES = {
  apa: {
    label: 'APA 7',
    inline: (s) => `(${authorsOf(s)[0]?.last || e(s.title)}${authorsOf(s).length > 2 ? ' et al.' : authorsOf(s).length === 2 ? ` y ${authorsOf(s)[1].last}` : ''}, ${e(s.year || 's.f.')})`,
    entry: (s) => {
      const authors = authorsOf(s).map((a) => `${e(a.last)}, ${e(a.initials)}`).join(', ');
      const where = s.type === 'article' ? `${it(s.journal)}${s.volume ? `, ${it(s.volume)}` : ''}${s.pages ? `, ${e(s.pages)}` : ''}.` : `${e(s.publisher || '')}${s.publisher ? '.' : ''}`;
      return `${authors || e(s.title)} (${e(s.year || 's.f.')}). ${s.type === 'article' ? e(s.title) : it(s.title)}. ${where} ${tail(s)}`.trim();
    },
    sort: true,
  },
  mla: {
    label: 'MLA 9',
    inline: (s, n, page) => `(${authorsOf(s)[0]?.last || e(s.title)}${page ? ` ${e(page)}` : ''})`,
    entry: (s) => {
      const authors = authorsOf(s);
      const names = authors.length ? `${e(authors[0].last)}, ${e(authors[0].first)}${authors.length > 2 ? ', et al.' : authors.length === 2 ? `, y ${e(authors[1].first)} ${e(authors[1].last)}` : ''}. ` : '';
      return `${names}${s.type === 'article' ? `“${e(s.title)}.” ${it(s.journal)}` : it(s.title)}${s.publisher ? `, ${e(s.publisher)}` : ''}${s.year ? `, ${e(s.year)}` : ''}${s.pages ? `, pp. ${e(s.pages)}` : ''}. ${tail(s)}`.trim();
    },
    sort: true,
  },
  chicago: {
    label: 'Chicago',
    inline: (s, n, page) => `(${authorsOf(s)[0]?.last || e(s.title)} ${e(s.year || 's.f.')}${page ? `, ${e(page)}` : ''})`,
    entry: (s) => {
      const authors = authorsOf(s).map((a, index) => (index === 0 ? `${e(a.last)}, ${e(a.first)}` : `${e(a.first)} ${e(a.last)}`)).join(', ');
      return `${authors || ''}${authors ? '. ' : ''}${e(s.year || 's.f.')}. ${s.type === 'article' ? `“${e(s.title)}.” ${it(s.journal)}${s.volume ? ` ${e(s.volume)}` : ''}${s.pages ? `: ${e(s.pages)}` : ''}` : it(s.title)}.${s.city ? ` ${e(s.city)}:` : ''}${s.publisher ? ` ${e(s.publisher)}.` : ''} ${tail(s)}`.trim();
    },
    sort: true,
  },
  ieee: {
    label: 'IEEE',
    inline: (s, n) => `[${n}]`,
    entry: (s, n) => {
      const authors = authorsOf(s).map((a) => `${e(a.initials)} ${e(a.last)}`).join(', ');
      return `[${n}] ${authors}${authors ? ', ' : ''}${s.type === 'article' ? `“${e(s.title)},” ${it(s.journal)}${s.volume ? `, vol. ${e(s.volume)}` : ''}${s.pages ? `, pp. ${e(s.pages)}` : ''}` : it(s.title)}${s.publisher ? `, ${e(s.publisher)}` : ''}${s.year ? `, ${e(s.year)}` : ''}.${s.doi ? ` doi: ${e(s.doi)}.` : s.url ? ` [En línea]. Disponible: ${e(s.url)}` : ''}`;
    },
    sort: false,
  },
  iso: {
    label: 'ISO 690',
    inline: (s) => `(${(authorsOf(s)[0]?.last || e(s.title)).toUpperCase()}, ${e(s.year || 's.f.')})`,
    entry: (s) => {
      const authors = authorsOf(s).map((a) => `${e(a.last).toUpperCase()}, ${e(a.first)}`).join('; ');
      return `${authors}${authors ? '. ' : ''}${s.type === 'article' ? `${e(s.title)}. ${it(s.journal)}` : it(s.title)}.${s.city ? ` ${e(s.city)}:` : ''}${s.publisher ? ` ${e(s.publisher)},` : ''} ${e(s.year || 's.f.')}.${s.isbn ? ` ISBN ${e(s.isbn)}.` : ''}${s.doi ? ` DOI ${e(s.doi)}.` : ''}${s.url ? ` Disponible en: ${e(s.url)}` : ''}`;
    },
    sort: true,
  },
};

export const SOURCE_FIELDS = [
  { name: 'type', label: 'Tipo de fuente', type: 'select', options: [['book', 'Libro'], ['article', 'Artículo de revista'], ['web', 'Sitio web'], ['report', 'Informe'], ['thesis', 'Tesis']] },
  { name: 'author', label: 'Autor(es)', placeholder: 'Apellido, Nombre; Apellido, Nombre', full: true },
  { name: 'title', label: 'Título', full: true },
  { name: 'year', label: 'Año' },
  { name: 'publisher', label: 'Editorial' },
  { name: 'journal', label: 'Revista', show: (values) => values.type === 'article' },
  { name: 'volume', label: 'Volumen', show: (values) => values.type === 'article' },
  { name: 'pages', label: 'Páginas' },
  { name: 'city', label: 'Ciudad' },
  { name: 'doi', label: 'DOI' },
  { name: 'isbn', label: 'ISBN' },
  { name: 'url', label: 'URL', type: 'url', full: true },
];

/** Numera (IEEE) y vuelve a formatear todas las citas según el estilo. */
export function updateCitations(root, doc) {
  const style = CITATION_STYLES[doc.citationStyle] || CITATION_STYLES.apa;
  const order = [];
  root.querySelectorAll('.wd-cite[data-source]').forEach((el) => {
    const ids = el.dataset.source.split(',');
    ids.forEach((id) => { if (!order.includes(id)) order.push(id); });
    const parts = ids.map((id) => {
      const source = doc.sources.find((item) => item.id === id);
      return source ? style.inline(source, order.indexOf(id) + 1, el.dataset.page) : '(Fuente eliminada)';
    });
    const text = doc.citationStyle === 'ieee' ? parts.join('') : parts.length > 1 ? `(${parts.map((part) => part.replace(/^\(|\)$/g, '')).join('; ')})` : parts[0];
    const holder = document.createElement('span');
    holder.innerHTML = text;
    if (el.textContent !== holder.textContent) el.innerHTML = text;
  });
  return order;
}

export function bibliographyHtml(doc, order, title = 'Bibliografía') {
  const style = CITATION_STYLES[doc.citationStyle] || CITATION_STYLES.apa;
  const used = order.length ? order.map((id) => doc.sources.find((source) => source.id === id)).filter(Boolean) : doc.sources;
  const list = style.sort ? [...used].sort((a, b) => (authorsOf(a)[0]?.last || a.title || '').localeCompare(authorsOf(b)[0]?.last || b.title || '', 'es')) : used;
  const entries = list.map((source, index) => `<p class="wd-bib-entry">${style.entry(source, index + 1)}</p>`).join('') || '<p>No hay fuentes citadas.</p>';
  return `<section class="wd-bibliography" contenteditable="false" data-title="${e(title)}"><h2>${e(title)}</h2>${entries}</section>`;
}

const pageNumber = (el, doc) => {
  const page = el.closest('[data-page-index]');
  return formatPageNumber(doc.pageNumberStart + Number(page?.dataset.pageIndex || 0), doc.pageNumberFormat);
};

export function ensureId(el, prefix = 'h') {
  if (!el.id) el.id = uid(prefix);
  return el.id;
}

export function tocHtml(root, doc, { levels = 3, pages = true, manual = false, title = 'Contenido', leader = 'dots' } = {}) {
  const selector = Array.from({ length: levels }, (_, index) => `[data-page-body] h${index + 1}`).join(', ');
  const headings = [...root.querySelectorAll(selector)].filter((heading) => !heading.closest('.wd-toc, .wd-bibliography, .wd-cover') && heading.textContent.trim());
  const items = headings.map((heading) => {
    const level = Number(heading.tagName[1]);
    const id = ensureId(heading);
    return `<p class="wd-toc-item is-l${level}" data-target="${id}"><a href="#${id}">${e(heading.textContent.trim())}</a>${pages ? `<span class="wd-toc-leader is-${leader}"></span><span class="wd-toc-page">${pageNumber(heading, doc)}</span>` : ''}</p>`;
  }).join('') || '<p class="wd-muted">Agrega encabezados (Encabezado 1-3) para generar el índice.</p>';
  return `<nav class="wd-toc" contenteditable="${manual ? 'true' : 'false'}" data-levels="${levels}" data-pages="${pages}" data-manual="${manual}" data-leader="${leader}"><p class="wd-toc-title">${e(title)}</p>${items}</nav>`;
}

export function updateTocs(root, doc) {
  root.querySelectorAll('nav.wd-toc').forEach((nav) => {
    if (nav.dataset.manual === 'true') return;
    const holder = document.createElement('div');
    holder.innerHTML = tocHtml(root, doc, { levels: Number(nav.dataset.levels || 3), pages: nav.dataset.pages !== 'false', title: nav.querySelector('.wd-toc-title')?.textContent || 'Contenido', leader: nav.dataset.leader || 'dots' });
    nav.innerHTML = holder.firstElementChild.innerHTML;
  });
}

const NOTE_FORMATS = {
  arabic: (n) => String(n),
  roman: (n) => formatPageNumber(n, 'roman'),
  alpha: (n) => formatPageNumber(n, 'alpha'),
  symbol: (n) => ['*', '†', '‡', '§', '‖', '¶'][(n - 1) % 6].repeat(Math.ceil(n / 6)),
};

export function noteRefHtml(id, kind) {
  return `<sup class="wd-note-ref" contenteditable="false" data-note="${id}" data-kind="${kind}">?</sup>`;
}

/** Numera las llamadas de nota en orden de aparición y devuelve qué notas van en cada página. */
export function numberNotes(root, doc) {
  const settings = doc.noteSettings || {};
  const counters = { foot: settings.footStart || 1, end: settings.endStart || 1 };
  const byPage = {};
  const endnotes = [];
  root.querySelectorAll('sup.wd-note-ref[data-note]').forEach((ref) => {
    const kind = ref.dataset.kind === 'end' ? 'end' : 'foot';
    const format = NOTE_FORMATS[(kind === 'foot' ? settings.footFormat : settings.endFormat) || (kind === 'foot' ? 'arabic' : 'roman')] || NOTE_FORMATS.arabic;
    const label = format(counters[kind]);
    counters[kind] += 1;
    if (ref.textContent !== label) ref.textContent = label;
    const note = { id: ref.dataset.note, label };
    if (kind === 'foot') {
      const pageId = ref.closest('[data-page-body]')?.dataset.pageId;
      byPage[pageId] = [...(byPage[pageId] || []), note];
    } else endnotes.push(note);
  });
  return { byPage, endnotes };
}

export function captionHtml(label, text = '') {
  return `<p class="wd-caption" data-caption="${e(label)}" id="${uid('cap')}"><span class="wd-caption-label" contenteditable="false">${e(label)} <span class="wd-caption-num">1</span></span>: ${e(text) || 'Descripción'}</p>`;
}

export function updateCaptions(root) {
  const counters = {};
  root.querySelectorAll('p.wd-caption[data-caption]').forEach((caption) => {
    const label = caption.dataset.caption;
    counters[label] = (counters[label] || 0) + 1;
    const num = caption.querySelector('.wd-caption-num');
    if (num && num.textContent !== String(counters[label])) num.textContent = String(counters[label]);
  });
  root.querySelectorAll('a.wd-xref[data-target]').forEach((ref) => {
    const target = root.querySelector(`#${CSS.escape(ref.dataset.target)}`);
    if (!target) { ref.classList.add('is-missing'); return; }
    ref.classList.remove('is-missing');
    const show = ref.dataset.show || 'text';
    let text = target.textContent.trim();
    if (target.matches('p.wd-caption')) text = show === 'number' ? target.querySelector('.wd-caption-label')?.textContent.trim() : text;
    if (show === 'page') text = `página ${target.closest('[data-page-index]') ? Number(target.closest('[data-page-index]').dataset.pageIndex) + 1 : '?'}`;
    if (target.matches('.wd-bookmark')) text = show === 'page' ? text : target.dataset.bookmark;
    if (ref.textContent !== text) ref.textContent = text;
  });
}

export function tableOfFiguresHtml(root, doc, label = 'Figura') {
  const items = [...root.querySelectorAll(`p.wd-caption[data-caption="${CSS.escape(label)}"]`)].map((caption) => `<p class="wd-toc-item is-l1"><a href="#${ensureId(caption, 'cap')}">${e(caption.textContent.trim())}</a><span class="wd-toc-leader is-dots"></span><span class="wd-toc-page">${pageNumber(caption, doc)}</span></p>`).join('') || `<p class="wd-muted">No hay títulos de tipo ${e(label)}.</p>`;
  return `<nav class="wd-tof" contenteditable="false" data-label="${e(label)}"><p class="wd-toc-title">Índice de ${e(label.toLowerCase())}s</p>${items}</nav>`;
}

export function indexHtml(root, doc) {
  const entries = {};
  root.querySelectorAll('[data-page-body] .wd-idx[data-entry]').forEach((mark) => {
    const key = mark.dataset.entry.trim();
    const sub = (mark.dataset.sub || '').trim();
    const page = pageNumber(mark, doc);
    entries[key] = entries[key] || { pages: new Set(), subs: {} };
    if (sub) (entries[key].subs[sub] = entries[key].subs[sub] || new Set()).add(page);
    else entries[key].pages.add(page);
  });
  const keys = Object.keys(entries).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  let letter = '';
  const body = keys.map((key) => {
    const first = key[0].toUpperCase();
    const head = first !== letter ? `<p class="wd-index-letter">${e(first)}</p>` : '';
    letter = first;
    const subs = Object.entries(entries[key].subs).sort(([a], [b]) => a.localeCompare(b, 'es')).map(([sub, pages]) => `<p class="wd-index-sub">${e(sub)}, ${[...pages].join(', ')}</p>`).join('');
    return `${head}<p class="wd-index-entry">${e(key)}${entries[key].pages.size ? `, ${[...entries[key].pages].join(', ')}` : ''}</p>${subs}`;
  }).join('') || '<p class="wd-muted">Marca entradas con Referencias › Marcar entrada.</p>';
  return `<section class="wd-index" contenteditable="false"><h2>Índice alfabético</h2><div class="wd-index-cols">${body}</div></section>`;
}

export function authoritiesHtml(root, doc) {
  const groups = {};
  root.querySelectorAll('[data-page-body] .wd-auth[data-cite]').forEach((mark) => {
    const category = mark.dataset.category || 'Otras autoridades';
    groups[category] = groups[category] || {};
    (groups[category][mark.dataset.cite] = groups[category][mark.dataset.cite] || new Set()).add(pageNumber(mark, doc));
  });
  const body = Object.entries(groups).map(([category, cites]) => `<h3>${e(category)}</h3>${Object.entries(cites).sort(([a], [b]) => a.localeCompare(b, 'es')).map(([cite, pages]) => `<p class="wd-toc-item is-l1"><span>${e(cite)}</span><span class="wd-toc-leader is-dots"></span><span class="wd-toc-page">${[...pages].join(', ')}</span></p>`).join('')}`).join('') || '<p class="wd-muted">Marca citas con Referencias › Marcar cita.</p>';
  return `<section class="wd-authorities" contenteditable="false"><h2>Tabla de autoridades</h2>${body}</section>`;
}

/** Actualiza todo lo que depende de la paginación: índices, citas, títulos, referencias cruzadas. */
export function updateAllReferences(root, doc) {
  const order = updateCitations(root, doc);
  updateCaptions(root);
  updateTocs(root, doc);
  root.querySelectorAll('section.wd-bibliography').forEach((section) => {
    const holder = document.createElement('div');
    holder.innerHTML = bibliographyHtml(doc, order, section.dataset.title || 'Bibliografía');
    if (section.innerHTML !== holder.firstElementChild.innerHTML) section.innerHTML = holder.firstElementChild.innerHTML;
  });
  root.querySelectorAll('nav.wd-tof').forEach((nav) => {
    const holder = document.createElement('div');
    holder.innerHTML = tableOfFiguresHtml(root, doc, nav.dataset.label);
    nav.innerHTML = holder.firstElementChild.innerHTML;
  });
  root.querySelectorAll('section.wd-index').forEach((section) => {
    const holder = document.createElement('div');
    holder.innerHTML = indexHtml(root, doc);
    section.innerHTML = holder.firstElementChild.innerHTML;
  });
  root.querySelectorAll('section.wd-authorities').forEach((section) => {
    const holder = document.createElement('div');
    holder.innerHTML = authoritiesHtml(root, doc);
    section.innerHTML = holder.firstElementChild.innerHTML;
  });
  return order;
}
