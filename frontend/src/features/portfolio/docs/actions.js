// Acciones del editor. Cada botón de la cinta, atajo o menú termina aquí.
// Recibe un contexto (ctx) con acceso al documento, al DOM y a los diálogos; no depende de React.

import { createElement as h, useEffect as useEffectShim, useState as useStateShim } from 'react';
import DOMPurify from 'dompurify';
import { portfolioRepository } from '../../../data/repositories/portfolioRepository';
import { issuesRepository } from '../../../data/repositories/issuesRepository';
import { createId, parseDocument, serializeDocument, templateDocument } from '../portfolioDocument';
import { HEADER_SPACE, PAGE_SIZES, pageMetrics, plainText, uid } from './model';
import { cleanPastedHtml, escapeHtml, sanitizeHtml, textToHtml } from './sanitize';
import {
  anchorElement, applyBlockStyle, applyInlineStyle, caretPosition, computedFormat, currentBlock, exec, insertBlockHtml, insertHtml,
  placeCaret, rangeIn, rememberSelection, restoreSelection, savedRange, selectedBlocks, setBlockTag, setMultiRanges, sortBlocks, wordsOf,
} from './engine/core';
import { findAll, paintMatches, revealRange, similarFormatRanges } from './engine/find';
import { acceptChange, allChanges, changeAt, compareHtml, merge3, rejectChange, trackInsertHtml } from './engine/tracking';
import * as T from './engine/tables';
import {
  alignObjects, compressImage, cropImage, distributeObjects, flip, groupObjects, imageOf, objectHtml, readAdjust, readFileAsDataUrl, readSpec,
  removeBackground, rotateBy, setDistance, setWrap, setZ, ungroupObjects, updateObject, writeAdjust, WORDART_STYLES, applyTransform, applyAdjustments,
} from './engine/objects';
import { defaultShapeSpec, SHAPES } from './render/shapes';
import { CHART_TYPES, csvToData, dataToCsv, defaultChartSpec } from './render/charts';
import { defaultDiagramSpec, diagramAspect } from './render/diagrams';
import { COVERS, SLASH_COMMANDS, progressHtml } from './render/blocks';
import { fieldHtml, renderMermaid, renderTex } from './render/rich';
import { calendarHtml, hydrateLiveBlocks, hydrateRefs, liveBlockHtml, LIVE_BLOCKS, projectReport, refHtml, issueUrl } from './sprintops';
import {
  SOURCE_FIELDS, authoritiesHtml, bibliographyHtml, captionHtml, indexHtml, noteRefHtml, tableOfFiguresHtml, tocHtml, updateAllReferences, updateCitations,
} from './references';
import { readImageFile, searchCommons } from '../editorMedia';
import { importFile as importAnyFile } from './io/importers';
import { exportDocument, exportHtml, standaloneHtml } from './io/exporters';
import { INK_TOOLS, idealPoints, inkToSvg, recognize, smooth, strokeBounds } from './draw/ink';
import { FONTS, SIZES } from './ribbon/HomeTab';

const AUTOCORRECT = {
  '(c)': '©', '(r)': '®', '(tm)': '™', '->': '→', '<-': '←', '=>': '⇒', '--': '—', '...': '…', '1/2': '½', '1/4': '¼', '3/4': '¾',
  teh: 'the', adn: 'and', aveces: 'a veces', atravez: 'a través', haber: 'haber', sinembargo: 'sin embargo', osea: 'o sea', enserio: 'en serio', porfavor: 'por favor', nose: 'no sé',
};

const LANG_HINTS = {
  es: ['de', 'la', 'que', 'el', 'en', 'los', 'del', 'las', 'por', 'una', 'para', 'con', 'es', 'se', 'su'],
  en: ['the', 'and', 'of', 'to', 'in', 'is', 'that', 'for', 'it', 'with', 'as', 'was', 'on', 'are', 'this'],
  pt: ['de', 'que', 'não', 'uma', 'os', 'do', 'da', 'em', 'para', 'com', 'é', 'por', 'mais', 'as', 'dos'],
  fr: ['le', 'de', 'la', 'et', 'les', 'des', 'est', 'un', 'une', 'du', 'que', 'pour', 'dans', 'pas', 'qui'],
  de: ['der', 'die', 'und', 'das', 'ist', 'nicht', 'ein', 'zu', 'den', 'mit', 'von', 'sie', 'auf', 'für', 'dem'],
  it: ['il', 'di', 'che', 'la', 'e', 'per', 'un', 'una', 'non', 'sono', 'del', 'della', 'gli', 'con', 'le'],
};

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const sep = (text.split('\n')[0].match(/\t/g)?.length || 0) > (text.split('\n')[0].match(/,/g)?.length || 0) ? '\t' : (text.split('\n')[0].includes(';') && !text.split('\n')[0].includes(',') ? ';' : ',');
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell.trim()); cell = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
};

const toCsv = (fields, rows) => [fields, ...rows].map((row) => row.map((cell) => (/[",\n]/.test(cell || '') ? `"${String(cell).replace(/"/g, '""')}"` : cell ?? '')).join(',')).join('\n');

const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    const match = /\{[\s\S]*\}/.exec(text || '');
    try {
      return match ? JSON.parse(match[0]) : null;
    } catch {
      return null;
    }
  }
};

const cm = (px) => Math.round((px / 96) * 2.54 * 100) / 100;
const px = (centimeters) => Math.round((Number(centimeters) / 2.54) * 96);

function clearDropCap(node) {
  node.querySelectorAll('.wd-dropcap-letter').forEach((span) => span.replaceWith(document.createTextNode(span.textContent || '')));
  node.normalize();
  node.classList.remove('wd-dropcap');
  delete node.dataset.dropcap;
  node.style.removeProperty('--wd-drop-lines');
  node.style.removeProperty('--wd-drop-color');
}

function wrapDropCap(node) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  let text = walker.nextNode();
  while (text && ![...text.data].some((char) => char.trim())) text = walker.nextNode();
  if (!text) return false;
  const chars = [...text.data];
  const index = chars.findIndex((char) => char.trim());
  const span = document.createElement('span');
  span.className = 'wd-dropcap-letter';
  span.textContent = chars[index];
  const before = chars.slice(0, index).join('');
  const after = chars.slice(index + 1).join('');
  if (before) text.parentNode.insertBefore(document.createTextNode(before), text);
  text.parentNode.insertBefore(span, text);
  if (after) text.data = after;
  else text.remove();
  return true;
}

/** Convierte letras capitales antiguas en un carácter real, seleccionable y del color que ya tenía. */
export function materializeDropCaps(root) {
  root?.querySelectorAll('p.wd-dropcap').forEach((node) => {
    if (node.querySelector('.wd-dropcap-letter')) {
      node.style.removeProperty('--wd-drop-color');
      return;
    }
    const mode = node.dataset.dropcap === 'margin' ? 'margin' : 'dropped';
    const lines = node.style.getPropertyValue('--wd-drop-lines');
    clearDropCap(node);
    if (!wrapDropCap(node)) return;
    node.classList.add('wd-dropcap');
    node.dataset.dropcap = mode;
    if (lines) node.style.setProperty('--wd-drop-lines', lines);
    else node.style.setProperty('--wd-drop-lines', '3');
  });
}

export function createActions(ctx) {
  const D = () => ctx.desk();
  const doc = () => ctx.doc();
  const { toast } = ctx;
  const editable = () => {
    if (ctx.editable()) return true;
    toast.info('El documento está en modo de solo lectura.');
    return false;
  };
  const insert = (html) => {
    insertHtml(D(), html);
    ctx.change();
  };
  const block = (html) => {
    const nodes = insertBlockHtml(D(), html);
    ctx.change();
    return nodes;
  };
  const bodyWidth = () => D().querySelector('[data-page-body]')?.clientWidth || 600;
  const selectionText = () => (rangeIn(D()) || savedRange())?.toString() || '';
  const selectionHtml = () => {
    const range = rangeIn(D()) || savedRange();
    if (!range || range.collapsed) return '';
    const holder = document.createElement('div');
    holder.append(range.cloneContents());
    return holder.innerHTML;
  };
  const docText = () => plainText(ctx.readModel().pages.map((page) => page.html).join('\n'));
  const needProject = async () => {
    const data = ctx.project() || await ctx.refreshProject(false);
    if (!data) {
      toast.info('Vincula el documento a un proyecto (Compartir › Proyecto) para usar datos de SprintOps.');
      return null;
    }
    return data;
  };
  const choose = (title, items, { render, width = 'max-w-lg', empty = 'Sin elementos' } = {}) => ctx.dialog(title, ({ close }) => h(Picker, { items, close, render, empty }), width);
  const pickedObject = () => ctx.object();
  const ensureObject = () => {
    const el = pickedObject();
    if (!el) toast.info('Selecciona un objeto primero.');
    return el;
  };

  const actions = {};

  // ---------- Portapapeles ----------
  actions.copy = () => { restoreSelection(D()); document.execCommand('copy'); };
  actions.cut = () => { if (!editable()) return; restoreSelection(D()); document.execCommand('cut'); ctx.change(); };
  actions.onCopy = () => {};
  actions.pasteFromEvent = async (data) => {
    const files = [...(data?.files || [])];
    if (files.length) {
      for (const file of files) await actions.insertFile(file);
      return;
    }
    const html = data?.getData('text/html');
    const text = data?.getData('text/plain');
    if (html) {
      const clean = cleanPastedHtml(html, 'keep');
      if (ctx.tracking()) { trackInsertHtml(clean, ctx.user); ctx.change(); } else insert(clean);
    } else if (text) {
      if (ctx.tracking()) { trackInsertHtml(escapeHtml(text).replace(/\n/g, '<br>'), ctx.user); ctx.change(); } else {
        restoreSelection(D());
        if (text.includes('\n\n')) insertHtml(D(), textToHtml(text));
        else document.execCommand('insertText', false, text);
        ctx.change();
      }
    }
  };
  const readClipboard = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes('text/html')) return { html: await (await item.getType('text/html')).text(), text: item.types.includes('text/plain') ? await (await item.getType('text/plain')).text() : '' };
        const image = item.types.find((type) => type.startsWith('image/'));
        if (image) return { file: new File([await item.getType(image)], 'imagen.png', { type: image }) };
      }
    } catch {
      /* el navegador no permite clipboard.read */
    }
    try {
      return { text: await navigator.clipboard.readText() };
    } catch {
      toast.info('Tu navegador no permite leer el portapapeles desde un botón. Usa ⌘V / Ctrl+V.');
      return null;
    }
  };
  actions.paste = async () => {
    if (!editable()) return;
    const clip = await readClipboard();
    if (!clip) return;
    restoreSelection(D());
    if (clip.file) return actions.insertFile(clip.file);
    actions.pasteFromEvent({ files: [], getData: (type) => (type === 'text/html' ? clip.html || '' : clip.text || '') });
  };
  actions.pastePlain = async () => {
    if (!editable()) return;
    const clip = await readClipboard();
    if (!clip) return;
    const text = clip.text || plainText(clip.html || '');
    restoreSelection(D());
    document.execCommand('insertText', false, text);
    ctx.change();
  };
  actions.pasteSpecial = async () => {
    if (!editable()) return;
    const clip = await readClipboard();
    if (!clip) return;
    const values = await ctx.ask({
      title: 'Pegado especial',
      fields: [{ name: 'mode', label: 'Pegar como', type: 'select', value: 'keep', options: [['keep', 'Mantener formato de origen (Word, Google Docs, web)'], ['merge', 'Combinar formato (negritas, listas, tablas)'], ['plain', 'Solo texto'], ['markdown', 'Markdown convertido'], ['table', 'Tabla (desde texto separado por tabulaciones)']] }],
      submitLabel: 'Pegar',
    });
    if (!values) return;
    restoreSelection(D());
    const text = clip.text || plainText(clip.html || '');
    if (values.mode === 'plain') document.execCommand('insertText', false, text);
    else if (values.mode === 'markdown') {
      const { markdownToHtml } = await import('./io/importers');
      insertHtml(D(), await markdownToHtml(text));
    } else if (values.mode === 'table') {
      const rows = text.trim().split(/\r?\n/).map((line) => line.split('\t'));
      insertBlockHtml(D(), `<table class="wd-tbl-grid"><tbody>${rows.map((row, index) => `<tr>${row.map((cell) => `<${index ? 'td' : 'th'}>${escapeHtml(cell) || '<br>'}</${index ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</tbody></table>`);
    } else insertHtml(D(), clip.html ? cleanPastedHtml(clip.html, values.mode) : textToHtml(text));
    ctx.change();
  };
  actions.copyFormat = (sticky = false) => {
    restoreSelection(D());
    const el = anchorElement();
    if (!el) return;
    const format = computedFormat(el);
    ctx.setPainter({ styles: { fontFamily: format.fontFamily, fontSize: format.fontSize, fontWeight: format.fontWeight, fontStyle: format.fontStyle, textDecorationLine: format.textDecoration, color: format.color, backgroundColor: format.backgroundColor === 'rgba(0, 0, 0, 0)' ? 'transparent' : format.backgroundColor, letterSpacing: format.letterSpacing }, sticky });
    toast.success(sticky ? 'Formato copiado. Selecciona texto para aplicarlo (Esc para terminar).' : 'Formato copiado. Selecciona texto y pulsa Pegar formato.');
  };
  actions.pasteFormat = () => {
    const painter = ctx.painter();
    if (!painter || !editable()) return toast.info('Primero copia un formato.');
    applyInlineStyle(D(), painter.styles);
    if (!painter.sticky) ctx.setPainter(null);
    ctx.change();
  };
  actions.undo = () => ctx.applySnapshot(ctx.history.undo());
  actions.redo = () => ctx.applySnapshot(ctx.history.redo());

  // ---------- Fuente ----------
  actions.growFont = (direction) => {
    if (!editable()) return;
    restoreSelection(D());
    const current = Math.round(parseFloat(window.getComputedStyle(anchorElement() || D()).fontSize)) || 16;
    const next = direction > 0 ? SIZES.find((size) => size > current) || current + 4 : [...SIZES].reverse().find((size) => size < current) || Math.max(6, current - 2);
    applyInlineStyle(D(), { fontSize: `${next}px` });
    ctx.change();
  };
  actions.clearFormat = () => {
    if (!editable()) return;
    exec(D(), 'removeFormat');
    selectedBlocks(D()).forEach((node) => {
      node.removeAttribute('style');
      node.querySelectorAll('[style]').forEach((child) => { if (!child.closest('figure, .wd-live')) child.removeAttribute('style'); });
    });
    ctx.change();
  };
  actions.fontDialog = async () => {
    if (!editable()) return;
    const values = await ctx.ask({
      title: 'Fuente',
      fields: [
        { name: 'family', label: 'Fuente', type: 'select', value: '', options: [['', '(sin cambio)'], ...FONTS] },
        { name: 'size', label: 'Tamaño (px)', type: 'number', value: '', min: 6, max: 200 },
        { name: 'weight', label: 'Estilo', type: 'select', value: '', options: [['', '(sin cambio)'], ['400', 'Normal'], ['600', 'Seminegrita'], ['700', 'Negrita'], ['900', 'Extra negrita'], ['italic', 'Cursiva']] },
        { name: 'color', label: 'Color', type: 'color', value: '#1e293b' },
        { name: 'useColor', label: 'Aplicar color', type: 'checkbox', value: false },
        { name: 'spacing', label: 'Espaciado entre caracteres (px)', type: 'number', value: 0, min: -5, max: 30, step: 0.5 },
        { name: 'scale', label: 'Escala horizontal (%)', type: 'number', value: 100, min: 30, max: 300 },
        { name: 'position', label: 'Posición vertical (px, + sube)', type: 'number', value: 0, min: -30, max: 30 },
        { name: 'ligatures', label: 'Ligaduras', type: 'select', value: 'normal', options: [['normal', 'Estándar'], ['none', 'Ninguna'], ['common-ligatures discretionary-ligatures', 'Todas'], ['discretionary-ligatures', 'Discrecionales']] },
        { name: 'caps', label: 'Mayúsculas', type: 'select', value: 'normal', options: [['normal', 'Normal'], ['small-caps', 'Versalitas'], ['all-small-caps', 'Todo versalitas']] },
        { name: 'kerning', label: 'Interletraje para fuentes', type: 'checkbox', value: true },
        { name: 'hidden', label: 'Texto oculto', type: 'checkbox', value: false },
      ],
    });
    if (!values) return;
    const styles = {
      letterSpacing: values.spacing ? `${values.spacing}px` : '',
      fontVariantLigatures: values.ligatures,
      fontVariantCaps: values.caps,
      fontKerning: values.kerning ? 'normal' : 'none',
    };
    if (values.family) styles.fontFamily = values.family;
    if (values.size) styles.fontSize = `${values.size}px`;
    if (values.weight === 'italic') styles.fontStyle = 'italic';
    else if (values.weight) styles.fontWeight = values.weight;
    if (values.useColor) styles.color = values.color;
    if (Number(values.scale) !== 100) Object.assign(styles, { display: 'inline-block', transform: `scaleX(${values.scale / 100})`, transformOrigin: 'left' });
    if (values.position) Object.assign(styles, { position: 'relative', top: `${-values.position}px` });
    if (values.hidden) styles.display = 'none';
    applyInlineStyle(D(), styles);
    ctx.change();
  };
  actions.defaultFont = async () => {
    const current = doc().defaultFont;
    const values = await ctx.ask({ title: 'Fuente predeterminada', fields: [{ name: 'family', label: 'Fuente', type: 'select', value: current.family, options: [['', 'La del tema'], ...FONTS] }, { name: 'size', label: 'Tamaño (px)', type: 'number', value: current.size || 16, min: 8, max: 40 }, { name: 'all', label: 'Usar también en documentos nuevos', type: 'checkbox', value: false }] });
    if (!values) return;
    ctx.patchDoc({ defaultFont: { family: values.family, size: Number(values.size) || 16 } });
    if (values.all) ctx.storage.set('defaultFont', { family: values.family, size: Number(values.size) || 16 });
  };

  // ---------- Párrafo ----------
  const listOf = (kind) => anchorElement()?.closest?.(kind.toLowerCase());
  actions.listStyle = (kind, type) => {
    if (!editable()) return;
    restoreSelection(D());
    if (!listOf(kind)) exec(D(), kind === 'OL' ? 'insertOrderedList' : 'insertUnorderedList');
    const list = listOf(kind);
    if (list) list.style.listStyleType = type;
    ctx.change();
  };
  actions.customList = async (kind) => {
    if (!editable()) return;
    const values = await ctx.ask(kind === 'UL'
      ? { title: 'Viñeta personalizada', fields: [{ name: 'symbol', label: 'Símbolo o emoji', value: '➜' }, { name: 'color', label: 'Color', type: 'color', value: '#2f6f5e' }] }
      : { title: 'Numeración personalizada', fields: [{ name: 'format', label: 'Formato', type: 'select', value: 'decimal', options: [['decimal', '1, 2, 3'], ['lower-alpha', 'a, b, c'], ['upper-alpha', 'A, B, C'], ['lower-roman', 'i, ii, iii'], ['upper-roman', 'I, II, III']] }, { name: 'prefix', label: 'Texto antes', value: '' }, { name: 'suffix', label: 'Texto después', value: '.' }, { name: 'start', label: 'Empezar en', type: 'number', value: 1 }] });
    if (!values) return;
    restoreSelection(D());
    if (!listOf(kind)) exec(D(), kind === 'OL' ? 'insertOrderedList' : 'insertUnorderedList');
    const list = listOf(kind);
    if (!list) return;
    if (kind === 'UL') {
      list.style.listStyleType = `"${values.symbol.replace(/"/g, '')}  "`;
      list.style.setProperty('--wd-marker', values.color);
      list.classList.add('wd-list-colored');
    } else {
      list.style.listStyleType = values.format;
      list.setAttribute('start', String(values.start || 1));
      list.dataset.prefix = values.prefix;
      list.dataset.suffix = values.suffix;
      list.style.setProperty('--wd-fmt', values.format);
      list.classList.add('wd-list-custom');
      [...list.children].forEach((li) => { li.dataset.prefix = values.prefix; li.dataset.suffix = values.suffix; });
    }
    ctx.change();
  };
  actions.restartNumbering = () => { const list = listOf('OL'); if (list) { list.setAttribute('start', '1'); ctx.change(); } };
  actions.continueNumbering = () => {
    const list = listOf('OL');
    if (!list) return;
    const all = [...D().querySelectorAll('[data-page-body] ol')];
    const prev = all[all.indexOf(list) - 1];
    if (!prev) return;
    list.setAttribute('start', String(Number(prev.getAttribute('start') || 1) + prev.children.length));
    ctx.change();
  };
  actions.setNumbering = async () => {
    const list = listOf('OL');
    if (!list) return toast.info('Coloca el cursor en una lista numerada.');
    const values = await ctx.ask({ title: 'Establecer valor de numeración', fields: [{ name: 'start', label: 'Valor inicial', type: 'number', value: Number(list.getAttribute('start') || 1), min: 0 }] });
    if (values) { list.setAttribute('start', String(values.start)); ctx.change(); }
  };
  actions.multilevel = (style) => {
    if (!editable()) return;
    restoreSelection(D());
    const kind = style === 'bullets' ? 'UL' : 'OL';
    if (!listOf(kind)) exec(D(), kind === 'OL' ? 'insertOrderedList' : 'insertUnorderedList');
    let list = listOf(kind);
    while (list?.parentElement?.closest('ol, ul')) list = list.parentElement.closest('ol, ul');
    if (list) {
      list.classList.remove('wd-ml-legal', 'wd-ml-outline', 'wd-ml-bullets');
      list.classList.add(`wd-ml-${style}`);
    }
    ctx.change();
  };
  actions.indent = (direction) => {
    if (!editable()) return;
    restoreSelection(D());
    if (anchorElement()?.closest('li')) exec(D(), direction > 0 ? 'indent' : 'outdent');
    else selectedBlocks(D()).forEach((node) => { node.style.marginLeft = `${Math.max(0, (parseFloat(node.style.marginLeft) || 0) + direction * 36)}px`; });
    ctx.change();
  };
  actions.sort = (direction, numeric) => {
    if (!editable()) return;
    if (!sortBlocks(D(), direction, numeric)) toast.info('Selecciona dos o más párrafos o elementos de lista.');
    else ctx.change();
  };
  actions.toggleBlockClass = (className) => { selectedBlocks(D()).forEach((node) => node.classList.toggle(className)); ctx.change(); };
  actions.paragraphDialog = async () => {
    if (!editable()) return;
    restoreSelection(D());
    const first = selectedBlocks(D())[0];
    if (!first) return;
    const style = window.getComputedStyle(first);
    const indent = parseFloat(first.style.textIndent) || 0;
    const values = await ctx.ask({
      title: 'Párrafo',
      width: 'max-w-2xl',
      fields: [
        { name: 'align', label: 'Alineación', type: 'select', value: style.textAlign === 'start' ? 'left' : style.textAlign, options: [['left', 'Izquierda'], ['center', 'Centrada'], ['right', 'Derecha'], ['justify', 'Justificada']] },
        { name: 'outline', label: 'Nivel de esquema', type: 'select', value: first.tagName, options: [['P', 'Texto independiente'], ['H1', 'Nivel 1'], ['H2', 'Nivel 2'], ['H3', 'Nivel 3'], ['H4', 'Nivel 4']] },
        { name: 'left', label: 'Sangría izquierda (cm)', type: 'number', step: 0.1, value: cm(parseFloat(first.style.marginLeft) || 0) },
        { name: 'right', label: 'Sangría derecha (cm)', type: 'number', step: 0.1, value: cm(parseFloat(first.style.marginRight) || 0) },
        { name: 'special', label: 'Especial', type: 'select', value: indent > 0 ? 'first' : indent < 0 ? 'hanging' : 'none', options: [['none', 'Ninguna'], ['first', 'Primera línea'], ['hanging', 'Francesa']] },
        { name: 'by', label: 'En (cm)', type: 'number', step: 0.1, value: cm(Math.abs(indent)) || 1.25 },
        { name: 'before', label: 'Espaciado anterior (pt)', type: 'number', value: Math.round(parseFloat(style.marginTop) * 0.75) },
        { name: 'after', label: 'Espaciado posterior (pt)', type: 'number', value: Math.round(parseFloat(style.marginBottom) * 0.75) },
        { name: 'line', label: 'Interlineado', type: 'select', value: first.style.lineHeight || '', options: [['', 'Del estilo'], ['1', 'Sencillo'], ['1.15', '1.15'], ['1.5', '1.5 líneas'], ['2', 'Doble'], ['exact', 'Exacto…'], ['multiple', 'Múltiple…']] },
        { name: 'lineValue', label: 'Valor del interlineado (pt o múltiplo)', type: 'number', step: 0.1, value: 1.3, show: (v) => v.line === 'exact' || v.line === 'multiple' },
        { name: 'tab', label: 'Tabulación predeterminada (cm)', type: 'number', step: 0.25, value: 1.25 },
        { name: 'widows', label: 'Control de líneas viudas y huérfanas', type: 'checkbox', value: style.widows !== '1' },
        { name: 'keepNext', label: 'Conservar con el siguiente', type: 'checkbox', value: first.dataset.keepNext === 'true' },
        { name: 'keepLines', label: 'Conservar líneas juntas', type: 'checkbox', value: first.dataset.keepLines === 'true' },
        { name: 'breakBefore', label: 'Salto de página anterior', type: 'checkbox', value: first.dataset.breakBefore === 'page' },
        { name: 'nonum', label: 'Suprimir números de línea', type: 'checkbox', value: first.classList.contains('wd-no-linenum') },
      ],
    });
    if (!values) return;
    let blocks = selectedBlocks(D());
    if (values.outline !== first.tagName) blocks = setBlockTag(D(), values.outline);
    blocks.forEach((node) => {
      Object.assign(node.style, {
        textAlign: values.align,
        marginLeft: values.left ? `${px(values.left)}px` : '',
        marginRight: values.right ? `${px(values.right)}px` : '',
        textIndent: values.special === 'first' ? `${px(values.by)}px` : values.special === 'hanging' ? `-${px(values.by)}px` : '',
        paddingLeft: values.special === 'hanging' ? `${px(values.by)}px` : '',
        marginTop: `${Math.round(values.before / 0.75)}px`,
        marginBottom: `${Math.round(values.after / 0.75)}px`,
        lineHeight: values.line === 'exact' ? `${values.lineValue}pt` : values.line === 'multiple' ? String(values.lineValue) : values.line,
        tabSize: `${px(values.tab)}px`,
        widows: values.widows ? '2' : '1',
        orphans: values.widows ? '2' : '1',
        breakInside: values.keepLines ? 'avoid' : '',
      });
      node.dataset.keepNext = String(values.keepNext);
      node.dataset.keepLines = String(values.keepLines);
      if (values.breakBefore) node.dataset.breakBefore = 'page'; else delete node.dataset.breakBefore;
      node.classList.toggle('wd-no-linenum', values.nonum);
    });
    ctx.change();
  };
  actions.bordersDialog = async () => {
    if (!editable()) return;
    const values = await ctx.ask({
      title: 'Bordes y sombreado',
      fields: [
        { name: 'sides', label: 'Bordes', type: 'select', value: 'box', options: [['box', 'Cuadro'], ['top', 'Superior'], ['bottom', 'Inferior'], ['left', 'Izquierdo'], ['topbottom', 'Superior e inferior'], ['none', 'Ninguno']] },
        { name: 'style', label: 'Estilo', type: 'select', value: 'solid', options: [['solid', 'Continuo'], ['dashed', 'Discontinuo'], ['dotted', 'Punteado'], ['double', 'Doble']] },
        { name: 'width', label: 'Grosor (px)', type: 'number', value: 1.5, step: 0.5, min: 0.5, max: 10 },
        { name: 'color', label: 'Color', type: 'color', value: '#2f6f5e' },
        { name: 'shade', label: 'Sombreado', type: 'color', value: '#eef6f2' },
        { name: 'useShade', label: 'Aplicar sombreado', type: 'checkbox', value: false },
        { name: 'radius', label: 'Esquinas redondeadas (px)', type: 'number', value: 0 },
      ],
    });
    if (!values) return;
    const line = `${values.width}px ${values.style} ${values.color}`;
    applyBlockStyle(D(), {
      border: values.sides === 'box' ? line : 'none',
      borderTop: ['top', 'topbottom', 'box'].includes(values.sides) ? line : '',
      borderBottom: ['bottom', 'topbottom', 'box'].includes(values.sides) ? line : '',
      borderLeft: ['left', 'box'].includes(values.sides) ? line : '',
      padding: values.sides === 'none' ? '' : '6px 10px',
      backgroundColor: values.useShade ? values.shade : '',
      borderRadius: values.radius ? `${values.radius}px` : '',
    });
    ctx.change();
  };

  // ---------- Estilos ----------
  actions.createStyle = async () => {
    if (!editable()) return;
    restoreSelection(D());
    const node = currentBlock(D());
    if (!node) return;
    const values = await ctx.ask({ title: 'Crear estilo desde la selección', fields: [{ name: 'name', label: 'Nombre del estilo', value: 'Mi estilo' }, { name: 'tag', label: 'Tipo de párrafo', type: 'select', value: node.tagName, options: [['P', 'Párrafo'], ['H1', 'Encabezado 1'], ['H2', 'Encabezado 2'], ['H3', 'Encabezado 3'], ['BLOCKQUOTE', 'Cita']] }] });
    if (!values?.name) return;
    const inner = node.querySelector('span[style]') || node;
    const s = window.getComputedStyle(inner);
    const b = window.getComputedStyle(node);
    const css = `font-family:${s.fontFamily};font-size:${s.fontSize};font-weight:${s.fontWeight};font-style:${s.fontStyle};color:${s.color};text-align:${b.textAlign};line-height:${b.lineHeight};margin-top:${b.marginTop};margin-bottom:${b.marginBottom};letter-spacing:${s.letterSpacing}`;
    const style = { id: uid('st').replace(/[^a-z0-9_]/gi, ''), name: values.name, tag: values.tag, css };
    ctx.patchDoc({ customStyles: [...doc().customStyles, style] });
    setBlockTag(D(), values.tag, `wd-cs-${style.id}`);
    ctx.change();
  };
  actions.editStyle = async () => {
    const styles = doc().customStyles;
    if (!styles.length) return toast.info('Aún no hay estilos personalizados. Crea uno desde la selección.');
    const values = await ctx.ask({ title: 'Modificar estilo', fields: [{ name: 'id', label: 'Estilo', type: 'select', value: styles[0].id, options: styles.map((style) => [style.id, style.name]) }, { name: 'name', label: 'Nuevo nombre (opcional)', value: '' }, { name: 'css', label: 'Reglas CSS (propiedad:valor;)', type: 'textarea', value: styles[0].css, help: 'Ejemplo: font-size:18px;color:#2f6f5e;font-weight:700' }] });
    if (!values) return;
    ctx.patchDoc({ customStyles: styles.map((style) => (style.id === values.id ? { ...style, name: values.name || style.name, css: values.css } : style)) });
  };
  actions.manageStyles = () => ctx.dialog('Administrar estilos', ({ close }) => h(StyleManager, { styles: doc().customStyles, onChange: (customStyles) => ctx.patchDoc({ customStyles }), close }));
  actions.setDefaultStyles = () => {
    const current = doc();
    ctx.storage.set('defaultDocStyle', { theme: current.theme, styleSet: current.styleSet, defaultFont: current.defaultFont, customStyles: current.customStyles });
    toast.success('Formato guardado como predeterminado para documentos nuevos.');
  };
  actions.normalizeFormatting = () => {
    if (!editable()) return;
    D().querySelectorAll('[data-page-body] [style]').forEach((el) => {
      if (el.closest('figure, .wd-live, table')) return;
      ['font-family', 'font-size', 'color'].forEach((prop) => el.style.removeProperty(prop));
      if (!el.getAttribute('style')) el.removeAttribute('style');
    });
    D().querySelectorAll('[data-page-body] font').forEach((font) => font.replaceWith(...font.childNodes));
    ctx.change();
    toast.success('Se quitó el formato directo: el documento usa fuentes y colores del tema.');
  };

  // ---------- Edición: buscar, ir a, seleccionar ----------
  actions.find = (options = {}) => {
    ctx.openLeft('search');
    ctx.setFind((current) => ({ ...current, showReplace: Boolean(options?.replace) || current.showReplace, advanced: Boolean(options?.advanced) || current.advanced, query: selectionText().slice(0, 80) || current.query }));
  };
  actions.runFind = (find, step = 0) => {
    const ranges = findAll(D(), find);
    const index = ranges.length ? ((find.index + step) % ranges.length + ranges.length) % ranges.length : -1;
    paintMatches(ranges, index);
    if (step && ranges[index]) revealRange(ranges[index]);
    return { ranges, index };
  };
  actions.goto = async () => {
    const root = D();
    const headings = [...root.querySelectorAll('[data-page-body] h1, [data-page-body] h2, [data-page-body] h3')].filter((node) => node.textContent.trim());
    const bookmarks = [...root.querySelectorAll('.wd-bookmark[data-bookmark]')];
    const values = await ctx.ask({
      title: 'Ir a',
      fields: [
        { name: 'kind', label: 'Ir a', type: 'select', value: 'page', options: [['page', 'Página'], ['heading', 'Encabezado'], ['bookmark', 'Marcador'], ['comment', 'Comentario'], ['note', 'Nota'], ['table', 'Tabla'], ['image', 'Imagen']] },
        { name: 'page', label: 'Número de página', type: 'number', value: 1, min: 1, show: (v) => v.kind === 'page' },
        { name: 'heading', label: 'Encabezado', type: 'select', value: headings[0]?.id || '', options: headings.map((node) => { if (!node.id) node.id = createId(); return [node.id, node.textContent.trim().slice(0, 60)]; }), show: (v) => v.kind === 'heading' },
        { name: 'bookmark', label: 'Marcador', type: 'select', value: bookmarks[0]?.id || '', options: bookmarks.map((node) => [node.id, node.dataset.bookmark]), show: (v) => v.kind === 'bookmark' },
        { name: 'nth', label: 'Número (1 = primero)', type: 'number', value: 1, min: 1, show: (v) => ['comment', 'note', 'table', 'image'].includes(v.kind) },
      ],
      submitLabel: 'Ir',
    });
    if (!values) return;
    let target = null;
    if (values.kind === 'page') target = root.querySelectorAll('.wd-page')[Number(values.page) - 1];
    if (values.kind === 'heading') target = root.querySelector(`#${CSS.escape(values.heading)}`);
    if (values.kind === 'bookmark') target = root.querySelector(`#${CSS.escape(values.bookmark)}`);
    const selector = { comment: 'mark.wd-cmark', note: 'sup.wd-note-ref', table: '[data-page-body] table', image: '[data-page-body] img, figure.wd-obj' }[values.kind];
    if (selector) target = root.querySelectorAll(selector)[Number(values.nth) - 1];
    if (!target) return toast.info('No se encontró ese elemento.');
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const body = target.closest('[data-page-body]') || target.querySelector?.('[data-page-body]');
    if (body && target !== body) { body.focus({ preventScroll: true }); placeCaret(target.matches('.wd-page') ? body : target, true); }
  };
  actions.selectAll = () => {
    const bodies = D().querySelectorAll('[data-page-body]');
    if (!bodies.length) return;
    const range = document.createRange();
    range.setStart(bodies[0], 0);
    range.setEnd(bodies[bodies.length - 1], bodies[bodies.length - 1].childNodes.length);
    const s = document.getSelection();
    s.removeAllRanges();
    s.addRange(range);
    rememberSelection(D());
  };
  actions.selectObjects = () => {
    const list = [...D().querySelectorAll('[data-page-body] figure.wd-obj, [data-page-body] > p img')];
    if (!list.length) return toast.info('No hay objetos en el documento.');
    list.forEach((el, index) => ctx.selectObject(el, index > 0));
    toast.success(`${list.length} objetos seleccionados.`);
  };
  actions.selectSimilar = () => {
    restoreSelection(D());
    const ranges = similarFormatRanges(D(), anchorElement());
    setMultiRanges(ranges);
    paintMatches(ranges, -1);
    toast.success(`${ranges.length} fragmentos con formato similar. El siguiente formato de fuente que apliques cambiará todos.`);
  };
  actions.selectionPane = () => ctx.dialog('Panel de selección', ({ close }) => h(SelectionPane, { desk: D(), close, onSelect: (el) => { ctx.selectObject(el); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, onChange: () => ctx.change({ noReflow: true }) }));

  // ---------- Tab, autocorrección, menús en línea ----------
  actions.handleTab = (shift) => {
    if (!ctx.editable()) return false;
    const el = anchorElement();
    const tableCell = el?.closest?.('td, th');
    if (tableCell && D().contains(tableCell)) {
      const cells = [...tableCell.closest('table').querySelectorAll('td, th')];
      let next = cells[cells.indexOf(tableCell) + (shift ? -1 : 1)];
      if (!next && !shift) { next = T.addRow(tableCell, true); ctx.change(); }
      if (next) placeCaret(next, true);
      rememberSelection(D());
      return true;
    }
    if (el?.closest?.('li')) {
      exec(D(), shift ? 'outdent' : 'indent');
      ctx.change();
      return true;
    }
    if (shift) return true;
    insertHtml(D(), '<span class="wd-tab">\t</span>\u200b');
    ctx.change();
    return true;
  };
  actions.autocorrect = () => {
    if (ctx.tracking()) return;
    const range = rangeIn(D());
    const node = range?.startContainer;
    if (!node || node.nodeType !== 3 || !range.collapsed) return;
    const offset = range.startOffset - 1;
    const before = node.data.slice(0, offset);
    const match = /(\S+)$/.exec(before);
    if (!match) return;
    const word = match[1];
    const start = offset - word.length;
    const dictionary = doc().dictionary || [];
    let replacement = AUTOCORRECT[word.toLowerCase()];
    if (replacement && dictionary.includes(word)) replacement = null;
    const prevText = node.data.slice(0, start).trimEnd();
    const blockStart = !prevText && !node.previousSibling;
    const sentenceStart = blockStart || /[.!?¿¡]$/.test(prevText);
    if (!replacement && sentenceStart && /^\p{Ll}/u.test(word) && !/[@/.:]/.test(word) && word.length > 1) replacement = word[0].toLocaleUpperCase() + word.slice(1);
    if (!replacement || replacement === word) return;
    node.data = node.data.slice(0, start) + replacement + node.data.slice(offset);
    const caret = document.createRange();
    caret.setStart(node, start + replacement.length + 1);
    caret.collapse(true);
    document.getSelection().removeAllRanges();
    document.getSelection().addRange(caret);
  };
  actions.inlineItems = (state) => {
    if (!state) return [];
    const query = (state.query || '').toLowerCase();
    if (state.trigger === '/') {
      return SLASH_COMMANDS.filter((cmd) => !query || cmd.label.toLowerCase().includes(query) || cmd.keywords.includes(query))
        .map((cmd) => ({ key: cmd.id, kind: 'block', badge: cmd.label.slice(0, 1), label: cmd.label, hint: cmd.hint, cmd }));
    }
    const data = ctx.project();
    if (!data) return [{ key: 'none', kind: 'info', badge: '!', label: 'Sin proyecto vinculado', hint: 'Vincula un proyecto desde Compartir', none: true }];
    const match = (text) => !query || String(text).toLowerCase().includes(query);
    return [
      ...data.members.filter((member) => match(member.name) || match(member.email)).slice(0, 6).map((member) => ({ key: `u${member.userId}`, kind: 'user', badge: '@', label: member.name, hint: member.role || member.email, ref: 'user', item: member })),
      ...data.issues.filter((issue) => match(issue.title) || match(`#${issue.id}`) || match(issue.id)).slice(0, 8).map((issue) => ({ key: `i${issue.id}`, kind: 'issue', badge: '#', label: `#${issue.id} ${issue.title}`, hint: issue.status, ref: 'issue', item: issue })),
      ...data.sprints.filter((sprint) => match(sprint.name)).slice(0, 4).map((sprint) => ({ key: `s${sprint.id}`, kind: 'sprint', badge: 'S', label: sprint.name, hint: `${sprint.startDate || ''} – ${sprint.endDate || ''}`, ref: 'sprint', item: sprint })),
    ];
  };
  actions.consumeTrigger = (state) => {
    const range = rangeIn(D());
    if (!range || !state.node.isConnected) return;
    const remove = document.createRange();
    remove.setStart(state.node, state.offset);
    remove.setEnd(range.startContainer, range.startOffset);
    remove.deleteContents();
    rememberSelection(D());
  };
  actions.pickInline = (item) => {
    if (item.none) return;
    if (item.ref) {
      insert(refHtml(item.ref, item.item, ctx.project()));
      return;
    }
    const { cmd } = item;
    if (cmd.block) { setBlockTag(D(), cmd.block); ctx.change(); return; }
    if (cmd.command) { exec(D(), cmd.command); ctx.change(); return; }
    if (cmd.html) { block(typeof cmd.html === 'function' ? cmd.html() : cmd.html); return; }
    const map = { image: () => actions.imageDevice(), video: () => actions.youtube(), file: () => actions.attachment(), 'mention-issue': () => actions.mention('issue'), 'live-metrics': () => actions.live('metrics'), 'live-issues': () => actions.live('issues'), equation: () => actions.equation(), mermaid: () => actions.mermaid(), toc: () => actions.toc({ levels: 3 }), ai: () => ctx.openRight('ai') };
    map[cmd.action]?.();
  };

  // ---------- Insertar: páginas ----------
  actions.cover = (id, customHtml) => {
    if (!editable()) return;
    actions.removeCover(true);
    const cover = COVERS.find((item) => item.id === id);
    const html = customHtml || cover.html(escapeHtml(ctx.name || 'Título del documento'));
    const body = D().querySelector('[data-page-body]');
    body.insertAdjacentHTML('afterbegin', html);
    ctx.change();
  };
  actions.saveCover = async () => {
    const body = D().querySelector('[data-page-body]');
    const values = await ctx.ask({ title: 'Guardar portada personalizada', fields: [{ name: 'name', label: 'Nombre', value: 'Mi portada' }] });
    if (!values) return;
    const holder = document.createElement('div');
    for (const child of body.children) {
      holder.append(child.cloneNode(true));
      if (child.matches('hr.wd-break')) break;
    }
    if (!holder.querySelector('hr.wd-break')) holder.insertAdjacentHTML('beforeend', '<hr class="wd-break">');
    ctx.storage.set('covers', [...ctx.storage.get('covers', []), { id: uid('cover'), name: values.name, html: holder.innerHTML }]);
    toast.success('Portada guardada.');
  };
  actions.removeCover = (silent) => {
    const cover = D().querySelector('[data-page-body] .wd-cover');
    if (!cover) { if (silent !== true) toast.info('No hay portada.'); return; }
    let next = cover.nextElementSibling;
    while (next && !next.matches('hr.wd-break')) { const after = next.nextElementSibling; next.remove(); next = after; }
    next?.remove();
    cover.remove();
    ctx.change();
  };
  actions.blankPage = () => { if (editable()) block('<hr class="wd-break"><p><br></p><hr class="wd-break">'); };
  actions.pageBreak = () => { if (editable()) block('<hr class="wd-break">'); };
  actions.columnBreak = () => { if (editable()) block('<div class="wd-colbreak" contenteditable="false"></div>'); };
  actions.sectionBreak = (type) => { if (editable()) block(`<hr class="wd-break" data-section="${type}">`); };

  // ---------- Tablas ----------
  actions.table = (rows, cols) => { if (editable()) block(T.tableHtml(rows, cols)); };
  actions.tableDialog = async () => {
    if (!editable()) return;
    const values = await ctx.ask({ title: 'Insertar tabla', fields: [{ name: 'rows', label: 'Filas', type: 'number', value: 3, min: 1, max: 200 }, { name: 'cols', label: 'Columnas', type: 'number', value: 3, min: 1, max: 30 }, { name: 'header', label: 'Fila de encabezado', type: 'checkbox', value: true }, { name: 'style', label: 'Estilo', type: 'select', value: 'grid', options: T.TABLE_STYLES.map((style) => [style.id, style.label]) }, { name: 'fit', label: 'Autoajuste', type: 'select', value: 'page', options: [['page', 'A la ventana'], ['content', 'Al contenido'], ['fixed', 'Ancho fijo de columna']] }] });
    if (!values) return;
    const nodes = block(T.tableHtml(values.rows, values.cols, { header: values.header, style: values.style }));
    const table = nodes?.find((node) => node.tagName === 'TABLE');
    if (table) { if (values.fit === 'fixed') T.distributeColumns(table); else T.autofit(table, values.fit); }
  };
  actions.drawTable = () => {
    if (!editable()) return;
    if (ctx.pen()?.tool === 'table') {
      ctx.setPen({ tool: null });
      return;
    }
    ctx.setPen({ tool: 'table' });
    toast.info('Arrastra para crear la tabla. Dentro de una celda, traza una línea para dividirla. Esc para salir.');
  };
  actions.textToTable = async () => {
    if (!editable()) return;
    restoreSelection(D());
    const blocks = selectedBlocks(D()).filter((node) => node.matches('p, li'));
    if (!blocks.length) return toast.info('Selecciona los párrafos a convertir.');
    const values = await ctx.ask({ title: 'Convertir texto en tabla', fields: [{ name: 'sep', label: 'Separar en', type: 'select', value: 'auto', options: [['auto', 'Automático'], ['\t', 'Tabulaciones'], [',', 'Comas'], [';', 'Punto y coma'], ['|', 'Barras |']] }] });
    if (!values) return;
    T.textToTable(blocks, values.sep);
    ctx.change();
  };
  actions.calendarTable = async () => {
    const now = new Date();
    const values = await ctx.ask({ title: 'Calendario', fields: [{ name: 'month', label: 'Mes', type: 'month', value: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` }] });
    if (!values?.month) return;
    const [year, month] = values.month.split('-').map(Number);
    block(calendarHtml(year, month - 1));
  };

  const currentTable = () => ctx.cell()?.closest('table');
  actions.tableOp = async (op, arg) => {
    if (!editable()) return;
    const cell = ctx.cell();
    const table = cell?.closest('table');
    if (!cell || !table) return toast.info('Coloca el cursor dentro de una tabla.');
    const cells = T.selectedCells(table, rangeIn(D()) || savedRange());
    switch (op) {
      case 'rowAbove': T.addRow(cell, false); break;
      case 'rowBelow': T.addRow(cell, true); break;
      case 'colLeft': T.addColumn(cell, false); break;
      case 'colRight': T.addColumn(cell, true); break;
      case 'deleteRow': T.deleteRow(cell); break;
      case 'deleteCol': T.deleteColumn(cell); break;
      case 'deleteTable': table.remove(); break;
      case 'merge': if (!T.mergeCells(cells)) return toast.info('Selecciona dos o más celdas contiguas.'); break;
      case 'split': {
        const values = await ctx.ask({ title: 'Dividir celdas', fields: [{ name: 'cols', label: 'Columnas', type: 'number', value: 2, min: 1, max: 10 }, { name: 'rows', label: 'Filas', type: 'number', value: 1, min: 1, max: 10 }] });
        if (!values) return;
        T.splitCell(cell, values.cols, values.rows);
        break;
      }
      case 'splitTable': if (!T.splitTable(cell)) return toast.info('Coloca el cursor en la fila donde empieza la nueva tabla.'); break;
      case 'distributeRows': T.distributeRows(table); break;
      case 'distributeCols': T.distributeColumns(table); break;
      case 'fitContent': T.autofit(table, 'content'); break;
      case 'fitPage': T.autofit(table, 'page'); break;
      case 'colWidth': {
        const values = await ctx.ask({ title: 'Ancho de columna', fields: [{ name: 'width', label: 'Ancho (cm)', type: 'number', step: 0.1, value: cm(cell.offsetWidth) }] });
        if (!values) return;
        const index = cell.cellIndex;
        table.style.tableLayout = 'fixed';
        [...table.rows].forEach((row) => { if (row.cells[index]) row.cells[index].style.width = `${px(values.width)}px`; });
        break;
      }
      case 'rowHeight': {
        const values = await ctx.ask({ title: 'Alto de fila', fields: [{ name: 'height', label: 'Alto (cm)', type: 'number', step: 0.1, value: cm(cell.parentElement.offsetHeight) }] });
        if (!values) return;
        cell.parentElement.style.height = `${px(values.height)}px`;
        break;
      }
      case 'style': T.applyTableStyle(table, arg); break;
      case 'repeatHeader': T.setRepeatHeader(table, table.dataset.repeatHeader !== 'true'); break;
      case 'sort': {
        const head = [...table.rows[0].cells].map((item, index) => [String(index), item.textContent.trim() || `Columna ${index + 1}`]);
        const values = await ctx.ask({ title: 'Ordenar tabla', fields: [{ name: 'col', label: 'Ordenar por', type: 'select', value: String(cell.cellIndex), options: head }, { name: 'dir', label: 'Orden', type: 'select', value: 'asc', options: [['asc', 'Ascendente'], ['desc', 'Descendente']] }, { name: 'header', label: 'La tabla tiene encabezado', type: 'checkbox', value: true }] });
        if (!values) return;
        T.sortTable(table, Number(values.col), values.dir, values.header);
        break;
      }
      case 'formula': {
        const values = await ctx.ask({ title: 'Fórmula', description: 'Funciones: SUM, AVERAGE, MIN, MAX, COUNT, PRODUCT con ABOVE, LEFT, BELOW, RIGHT o rangos (A1:B3). También aritmética: =A1*B2.', fields: [{ name: 'formula', label: 'Fórmula', value: cell.dataset.formula || '=SUM(ABOVE)' }] });
        if (!values?.formula) return;
        cell.dataset.formula = values.formula.startsWith('=') ? values.formula : `=${values.formula}`;
        T.recalcFormulas(table);
        break;
      }
      case 'toText': T.tableToText(table, '\t'); break;
      default: return;
    }
    ctx.change();
  };
  actions.cellAlign = (styles) => {
    if (!editable()) return;
    const table = currentTable();
    if (!table) return;
    const cells = T.selectedCells(table, rangeIn(D()) || savedRange());
    (cells.length ? cells : [ctx.cell()]).forEach((cell) => Object.assign(cell.style, styles));
    ctx.change();
  };
  actions.tableBorders = ({ mode }) => {
    if (!editable()) return;
    const table = currentTable();
    if (!table) return;
    T.setBorders(table, T.selectedCells(table, rangeIn(D()) || savedRange()), { mode, ...ctx.borderPen() });
    ctx.change();
  };
  actions.tableGridlines = () => {
    if (!editable()) return;
    const table = currentTable();
    const tables = table ? [table] : [...D().querySelectorAll('table')];
    if (!tables.length) return;
    const show = tables.some((item) => !item.classList.contains('is-grid'));
    tables.forEach((item) => item.classList.toggle('is-grid', show));
    ctx.change();
  };
  actions.borderEdge = (kind) => {
    if (!editable()) return;
    if (kind === 'rule') { block('<hr class="wd-rule"><p><br></p>'); return; }
    if (kind === 'draw') { actions.drawTable(); return; }
    if (kind === 'grid') { actions.tableGridlines(); return; }
    const table = currentTable();
    if (table) {
      T.setBorders(table, T.selectedCells(table, rangeIn(D()) || savedRange()), { mode: kind, ...ctx.borderPen() });
      ctx.change();
      return;
    }
    const paragraph = {
      bottom: { borderBottom: '1.5px solid currentColor', paddingBottom: '4px' },
      top: { borderTop: '1.5px solid currentColor', paddingTop: '4px' },
      left: { borderLeft: '3px solid currentColor', paddingLeft: '10px' },
      right: { borderRight: '3px solid currentColor', paddingRight: '10px' },
      none: { border: 'none', borderTop: '', borderRight: '', borderBottom: '', borderLeft: '', padding: '' },
      all: { border: '1.5px solid currentColor', padding: '6px 10px' },
      outer: { border: '1.5px solid currentColor', padding: '6px 10px' },
    };
    if (!paragraph[kind]) return toast.info('Ese borde aplica dentro de una tabla.');
    applyBlockStyle(D(), paragraph[kind]);
    ctx.change();
  };

  // ---------- Imágenes y archivos ----------
  const insertImage = (src, { width, height, alt = '', wrap = 'inline' } = {}) => {
    const max = bodyWidth();
    const w = Math.min(width || 480, max);
    const hgt = width && height ? Math.round((w / width) * height) : Math.round(w * 0.66);
    insert(objectHtml('image', { src, alt }, { width: w, height: hgt, wrap }).replace('<figure', `<figure data-original="${escapeHtml(src)}"`));
  };
  actions.insertFile = async (file) => {
    if (!ctx.editable()) return;
    if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
      const src = await readFileAsDataUrl(file);
      const image = await new Promise((resolve) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => resolve({ width: 320, height: 240 }); img.src = src; });
      return insertImage(src, { width: image.width, height: image.height, alt: file.name });
    }
    if (file.type.startsWith('image/')) {
      const image = await readImageFile(file);
      return insertImage(image.src, { width: image.width, height: image.height, alt: file.name.replace(/\.[^.]+$/, '') });
    }
    if (file.type.startsWith('video/')) return actions.videoFile(file);
    if (file.type.startsWith('audio/')) return actions.audioFile(file);
    if (file.type === 'application/pdf') return actions.pdfPreview(file);
    return actions.attachment(file);
  };
  actions.imageDevice = async () => {
    if (!editable()) return;
    const files = await ctx.pick('image/*', true);
    for (const file of files || []) await actions.insertFile(file);
  };
  actions.imageUrl = async () => {
    if (!editable()) return;
    const values = await ctx.ask({ title: 'Imagen desde URL', fields: [{ name: 'url', label: 'Dirección de la imagen', type: 'url', placeholder: 'https://…', full: true }, { name: 'alt', label: 'Texto alternativo', full: true }] });
    if (!values?.url || !/^https?:\/\//i.test(values.url)) return;
    const image = await new Promise((resolve) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = values.url; });
    if (!image) return toast.error('No se pudo cargar la imagen.');
    insertImage(values.url, { width: image.naturalWidth, height: image.naturalHeight, alt: values.alt });
  };
  actions.imageLibrary = () => ctx.dialog('Biblioteca de imágenes libres', ({ close }) => h(LibraryPicker, {
    close,
    onPick: (item) => { insertImage(item.src, { width: 480, height: 320, alt: item.title }); close(); toast.success(`Imagen insertada · ${item.credit}`); },
  }), 'max-w-3xl');
  actions.svgFile = async () => {
    if (!editable()) return;
    const file = await ctx.pick('.svg,image/svg+xml');
    if (!file) return;
    const svg = DOMPurify.sanitize(await file.text(), { USE_PROFILES: { svg: true, svgFilters: true } });
    if (!svg.includes('<svg')) return toast.error('El archivo no es un SVG válido.');
    insert(objectHtml('icon', { svg, color: 'inherit' }, { width: 180, height: 180 }));
  };
  actions.illustration = async (key) => {
    if (!editable()) return;
    const { ILLUSTRATIONS } = await import('./render/iconLibrary');
    insert(objectHtml('icon', { svg: ILLUSTRATIONS[key].svg, color: 'inherit' }, { width: 280, height: 196 }));
  };
  actions.icons = async () => {
    if (!editable()) return;
    const library = await import('./render/iconLibrary');
    ctx.dialog('Iconos', ({ close }) => h(IconPicker, { library, close, onPick: (name, color) => { insert(objectHtml('icon', { svg: library.iconSvg(name), color, name }, { width: 64, height: 64 })); close(); } }), 'max-w-2xl');
  };
  actions.attachment = async (given) => {
    if (!editable()) return;
    const file = given || await ctx.pick('*/*');
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('El archivo supera 5 MB. Comparte un enlace en su lugar.');
    const src = await readFileAsDataUrl(file);
    const size = file.size > 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(file.size / 1024)} KB`;
    insert(`<a class="wd-attachment" contenteditable="false" href="${src}" download="${escapeHtml(file.name)}" title="Descargar ${escapeHtml(file.name)}"><b>📎 ${escapeHtml(file.name)}</b><small>${size}</small></a>&nbsp;`);
  };
  actions.embedObject = () => actions.attachment();
  actions.gif = async () => {
    if (!editable()) return;
    const file = await ctx.pick('image/gif');
    if (file) actions.insertFile(file);
  };
  actions.youtube = async () => {
    if (!editable()) return;
    const values = await ctx.ask({ title: 'Video en línea', fields: [{ name: 'url', label: 'URL de YouTube o Vimeo', type: 'url', full: true, placeholder: 'https://www.youtube.com/watch?v=…' }] });
    if (!values?.url) return;
    const yt = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/.exec(values.url);
    const vimeo = /vimeo\.com\/(\d+)/.exec(values.url);
    const src = yt ? `https://www.youtube-nocookie.com/embed/${yt[1]}` : vimeo ? `https://player.vimeo.com/video/${vimeo[1]}` : null;
    if (!src) return toast.error('Usa un enlace de YouTube o Vimeo.');
    block(`<figure class="wd-media" contenteditable="false"><iframe src="${src}" title="Video" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowfullscreen frameborder="0"></iframe><figcaption><a href="${escapeHtml(values.url)}">${escapeHtml(values.url)}</a></figcaption></figure>`);
  };
  const mediaFile = async (given, accept, tag) => {
    if (!editable()) return;
    const file = given || await ctx.pick(accept);
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return toast.error('El archivo supera 8 MB. Súbelo a YouTube/Vimeo e insértalo como video en línea.');
    const src = await readFileAsDataUrl(file);
    block(`<figure class="wd-media is-${tag}" contenteditable="false"><${tag} src="${src}" controls preload="metadata"></${tag}><figcaption>${escapeHtml(file.name)}</figcaption></figure>`);
  };
  actions.videoFile = (file) => mediaFile(file, 'video/*', 'video');
  actions.audioFile = (file) => mediaFile(file, 'audio/*', 'audio');
  actions.pdfPreview = async (given) => {
    if (!editable()) return;
    const file = given || await ctx.pick('application/pdf');
    if (!file) return;
    toast.info('Generando vista previa del PDF…');
    const pdfjs = await import('pdfjs-dist');
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const images = [];
    for (let number = 1; number <= Math.min(3, pdf.numPages); number += 1) {
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: 1.2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      images.push(canvas.toDataURL('image/jpeg', 0.8));
    }
    const link = file.size <= 5 * 1024 * 1024 ? `<a class="wd-attachment" contenteditable="false" href="${await readFileAsDataUrl(file)}" download="${escapeHtml(file.name)}"><b>📄 ${escapeHtml(file.name)}</b><small>${pdf.numPages} páginas</small></a>` : `<small>${escapeHtml(file.name)} · ${pdf.numPages} páginas</small>`;
    block(`<figure class="wd-pdf" contenteditable="false">${images.map((src, index) => `<img src="${src}" alt="Página ${index + 1} de ${escapeHtml(file.name)}">`).join('')}<figcaption>${link}</figcaption></figure>`);
  };

  // ---------- Formas, iconos, gráficos, diagramas, texto ----------
  actions.shape = (type) => {
    if (!editable()) return;
    const shape = SHAPES[type];
    const size = shape.line ? [220, 60] : shape.square ? [120, 120] : [170, 110];
    insert(objectHtml('shape', defaultShapeSpec(type), { width: size[0], height: size[1] }));
  };
  actions.chart = async (type) => {
    if (!editable()) return;
    const width = Math.min(560, bodyWidth());
    block(objectHtml('chart', defaultChartSpec(type), { width, height: Math.round(width * 0.594), wrap: 'topbottom' }));
    const el = [...D().querySelectorAll('figure.wd-chart')].pop();
    if (el) { ctx.selectObject(el); actions.chartData(el); }
  };
  actions.diagram = (type) => {
    if (!editable()) return;
    const spec = defaultDiagramSpec(type);
    const width = Math.min(type === 'cycle' || type === 'matrix' ? 420 : 620, bodyWidth());
    block(objectHtml('diagram', spec, { width, height: Math.round(width * diagramAspect(spec)), wrap: 'topbottom' }));
  };
  actions.textbox = () => { if (editable()) insert(objectHtml('textbox', { html: '<p>Escribe aquí</p>' }, { width: 260, height: 120, wrap: 'square', extraStyle: 'float:right;margin:0 0 12px 12px;' })); };
  actions.wordart = async (el) => {
    if (!editable()) return;
    const spec = el ? readSpec(el) : { text: 'Tu texto aquí', style: 'gradient', size: 56, font: '"Avenir Next", Avenir, sans-serif' };
    const values = await ctx.ask({ title: 'Texto decorado', fields: [{ name: 'text', label: 'Texto', value: spec.text, full: true }, { name: 'style', label: 'Estilo', type: 'select', value: spec.style, options: Object.entries(WORDART_STYLES).map(([id, style]) => [id, style.label]) }, { name: 'size', label: 'Tamaño (px)', type: 'number', value: spec.size, min: 16, max: 200 }, { name: 'font', label: 'Fuente', type: 'select', value: spec.font, options: FONTS }] });
    if (!values) return;
    const next = { ...spec, ...values, size: Number(values.size) };
    const width = Math.min(bodyWidth(), Math.round(next.text.length * next.size * 0.62) + 40);
    if (el) { updateObject(el, next); el.style.width = `${width}px`; el.style.height = `${Math.round(next.size * 1.5)}px`; ctx.change(); } else insert(objectHtml('wordart', next, { width, height: Math.round(next.size * 1.5) }));
  };
  actions.dropCap = (mode = 'dropped') => {
    if (!editable()) return;
    restoreSelection(D());
    const node = currentBlock(D());
    if (!node || node.tagName !== 'P') return toast.info('Coloca el cursor en un párrafo.');
    const lines = node.style.getPropertyValue('--wd-drop-lines');
    clearDropCap(node);
    if (mode !== 'none') {
      if (!wrapDropCap(node)) return toast.info('El párrafo no tiene una letra para agrandar.');
      node.classList.add('wd-dropcap');
      node.dataset.dropcap = mode === 'margin' ? 'margin' : 'dropped';
      node.style.setProperty('--wd-drop-lines', lines || '3');
    }
    ctx.change();
  };
  actions.signature = async (el) => {
    if (!editable()) return;
    const spec = el ? readSpec(el) : { name: ctx.user?.name || '', title: '', email: ctx.user?.email || '' };
    const values = await ctx.ask({ title: 'Línea de firma', fields: [{ name: 'name', label: 'Firmante sugerido', value: spec.name }, { name: 'title', label: 'Cargo', value: spec.title }, { name: 'email', label: 'Correo', value: spec.email }] });
    if (!values) return;
    if (el) { updateObject(el, values); ctx.change(); } else insert(objectHtml('signature', values, { width: 300, height: 120 }));
  };
  actions.dateTime = (format = 'long') => {
    if (!editable()) return;
    const now = new Date();
    const formats = {
      long: new Intl.DateTimeFormat('es', { dateStyle: 'long' }).format(now),
      full: new Intl.DateTimeFormat('es', { dateStyle: 'full' }).format(now),
      medium: new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(now),
      short: new Intl.DateTimeFormat('es', { dateStyle: 'short' }).format(now),
      time: new Intl.DateTimeFormat('es', { timeStyle: 'short' }).format(now),
      datetime: new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(now),
      iso: now.toISOString().slice(0, 10),
    };
    insert(escapeHtml(formats[format] || formats.long));
  };
  actions.field = (field) => {
    const labels = { date: 'fecha', time: 'hora', title: ctx.name, author: doc().properties?.author || ctx.meta?.ownerName || 'autor', page: '#', pages: '#', words: '0', updated: '' };
    const active = document.activeElement?.closest?.('.wd-chrome');
    if (active) {
      active.focus();
      document.execCommand('insertHTML', false, fieldHtml(field, labels[field]));
      active.dispatchEvent(new Event('input', { bubbles: true }));
      ctx.refreshAux();
      return;
    }
    if (editable()) { insert(fieldHtml(field, labels[field])); ctx.refreshAux(); }
  };
  actions.fields = async () => {
    const values = await ctx.ask({ title: 'Campo automático', fields: [{ name: 'field', label: 'Campo', type: 'select', value: 'page', options: [['page', 'Número de página'], ['pages', 'Total de páginas'], ['date', 'Fecha actual'], ['time', 'Hora actual'], ['title', 'Título del documento'], ['author', 'Autor'], ['words', 'Número de palabras'], ['updated', 'Última modificación']] }] });
    if (values) actions.field(values.field);
  };
  actions.propertyField = async () => {
    const props = doc().properties || {};
    const values = await ctx.ask({ title: 'Propiedad del documento', fields: [{ name: 'prop', label: 'Propiedad', type: 'select', value: 'title', options: [['title', 'Título'], ['author', 'Autor'], ['subject', 'Asunto'], ['keywords', 'Palabras clave'], ['company', 'Organización']] }] });
    if (!values) return;
    if (values.prop === 'title' || values.prop === 'author') actions.field(values.prop);
    else insert(escapeHtml(props[values.prop] || `[${values.prop}]`));
  };
  actions.quickParts = () => ctx.dialog('Texto reutilizable', ({ close }) => h(QuickParts, { storage: ctx.storage, close, onInsert: (html) => { insert(sanitizeHtml(html)); close(); } }));
  actions.saveQuickPart = async () => {
    const html = selectionHtml();
    if (!html) return toast.info('Selecciona el contenido que quieres reutilizar.');
    const values = await ctx.ask({ title: 'Guardar texto reutilizable', fields: [{ name: 'name', label: 'Nombre', value: selectionText().slice(0, 30) }] });
    if (!values?.name) return;
    ctx.storage.set('quickParts', [...ctx.storage.get('quickParts', []), { id: uid('qp'), name: values.name, html }]);
    toast.success('Guardado. Lo encontrarás en Insertar › Elementos rápidos.');
  };
  actions.applyEquation = async (tex, inline, el) => {
    if (!editable() || !String(tex || '').trim()) return;
    const html = await renderTex(tex, !inline);
    const node = `<${inline ? 'span' : 'div'} class="wd-eq" contenteditable="false" data-tex="${escapeHtml(tex)}">${html}</${inline ? 'span' : 'div'}>`;
    if (el?.isConnected) { el.outerHTML = node; ctx.change(); } else if (inline) insert(`${node}&nbsp;`); else block(node);
  };
  actions.equation = (el) => {
    if (!editable()) return;
    window.dispatchEvent(new CustomEvent('wd-equation', { detail: el || null }));
  };
  actions.mermaid = async (el) => {
    if (!editable()) return;
    const values = await ctx.ask({ title: 'Diagrama Mermaid', description: 'Escribe código Mermaid (flowchart, sequenceDiagram, gantt, classDiagram, stateDiagram, erDiagram, pie…).', fields: [{ name: 'code', label: 'Código', type: 'textarea', rows: 10, value: el?.dataset?.code || 'graph TD\n  A[Inicio] --> B{¿Listo?}\n  B -- Sí --> C[Publicar]\n  B -- No --> D[Revisar]\n  D --> B' }] });
    if (!values?.code) return;
    let svg;
    try {
      svg = await renderMermaid(values.code);
    } catch (err) {
      return toast.error(`Mermaid: ${err?.message || 'código inválido'}`);
    }
    const node = `<figure class="wd-mermaid" contenteditable="false" data-code="${escapeHtml(values.code)}">${svg}</figure>`;
    if (el) { el.outerHTML = node; ctx.change(); } else block(node);
  };
  actions.mermaidFromCode = async (code) => {
    if (!editable()) return;
    let svg;
    try {
      svg = await renderMermaid(code);
    } catch (err) {
      return toast.error(`Mermaid: ${err?.message || 'código inválido'}`);
    }
    block(`<figure class="wd-mermaid" contenteditable="false" data-code="${escapeHtml(code)}">${svg}</figure>`);
  };

  // ---------- Vínculos, marcadores, referencias cruzadas ----------
  actions.link = async () => {
    if (!editable()) return;
    restoreSelection(D());
    const existing = anchorElement()?.closest?.('a[href]');
    const range = rangeIn(D()) || savedRange();
    const headings = [...D().querySelectorAll('[data-page-body] h1, [data-page-body] h2, [data-page-body] h3')].filter((node) => node.textContent.trim());
    const bookmarks = [...D().querySelectorAll('.wd-bookmark')];
    const href = existing?.getAttribute('href') || '';
    const values = await ctx.ask({
      title: existing ? 'Editar hipervínculo' : 'Insertar hipervínculo',
      fields: [
        { name: 'kind', label: 'Vincular a', type: 'select', value: href.startsWith('mailto:') ? 'email' : href.startsWith('#') ? 'place' : 'web', options: [['web', 'Página web'], ['email', 'Correo electrónico'], ['place', 'Lugar de este documento']] },
        { name: 'url', label: 'Dirección', value: href.startsWith('#') || href.startsWith('mailto:') ? 'https://' : href || 'https://', full: true, show: (v) => v.kind === 'web' },
        { name: 'email', label: 'Correo', type: 'email', value: href.replace('mailto:', '').split('?')[0], show: (v) => v.kind === 'email' },
        { name: 'subject', label: 'Asunto', value: '', show: (v) => v.kind === 'email' },
        { name: 'place', label: 'Encabezado o marcador', type: 'select', value: href.slice(1), options: [...headings.map((node) => { if (!node.id) node.id = createId(); return [node.id, `§ ${node.textContent.trim().slice(0, 50)}`]; }), ...bookmarks.map((node) => [node.id, `🔖 ${node.dataset.bookmark}`])], show: (v) => v.kind === 'place' },
        { name: 'text', label: 'Texto a mostrar', value: existing?.textContent || range?.toString() || '', full: true },
        { name: 'title', label: 'Información en pantalla', value: existing?.title || '', full: true },
        ...(existing ? [{ name: 'remove', label: 'Quitar hipervínculo', type: 'checkbox', value: false }] : []),
      ],
    });
    if (!values) return;
    if (existing && values.remove) { existing.replaceWith(...existing.childNodes); ctx.change(); return; }
    const target = values.kind === 'email' ? `mailto:${values.email}${values.subject ? `?subject=${encodeURIComponent(values.subject)}` : ''}` : values.kind === 'place' ? `#${values.place}` : values.url;
    if (!target || target === 'https://') return;
    const html = `<a href="${escapeHtml(target)}"${values.title ? ` title="${escapeHtml(values.title)}"` : ''}>${escapeHtml(values.text || target)}</a>`;
    if (existing) existing.outerHTML = html;
    else insertHtml(D(), html);
    ctx.change();
  };
  actions.followLink = (link) => {
    const href = link.getAttribute('href') || '';
    if (href.startsWith('#')) {
      const target = D().querySelector(`#${CSS.escape(href.slice(1))}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (href.startsWith('/')) return ctx.navigate(href);
    if (/^(https?:|mailto:|data:)/.test(href)) window.open(href, '_blank', 'noopener');
  };
  actions.bookmark = async () => {
    if (!editable()) return;
    const values = await ctx.ask({ title: 'Marcador', fields: [{ name: 'name', label: 'Nombre del marcador', value: selectionText().trim().slice(0, 30).replace(/\s+/g, '_') || 'Marcador' }] });
    if (!values?.name) return;
    const id = `bm-${values.name.replace(/[^\w-]/g, '_')}`;
    D().querySelector(`#${CSS.escape(id)}`)?.remove();
    insert(`<span class="wd-bookmark" id="${id}" data-bookmark="${escapeHtml(values.name)}" contenteditable="false"></span>`);
  };
  actions.crossRef = async () => {
    if (!editable()) return;
    const root = D();
    const targets = [
      ...[...root.querySelectorAll('[data-page-body] h1, [data-page-body] h2, [data-page-body] h3')].filter((node) => node.textContent.trim()).map((node) => { if (!node.id) node.id = createId(); return [node.id, `Encabezado · ${node.textContent.trim().slice(0, 50)}`]; }),
      ...[...root.querySelectorAll('.wd-bookmark')].map((node) => [node.id, `Marcador · ${node.dataset.bookmark}`]),
      ...[...root.querySelectorAll('p.wd-caption')].map((node) => { if (!node.id) node.id = createId(); return [node.id, `${node.textContent.trim().slice(0, 50)}`]; }),
    ];
    if (!targets.length) return toast.info('Agrega encabezados, marcadores o títulos de figuras/tablas primero.');
    const values = await ctx.ask({ title: 'Referencia cruzada', fields: [{ name: 'target', label: 'Elemento', type: 'select', value: targets[0][0], options: targets, full: true }, { name: 'show', label: 'Insertar referencia a', type: 'select', value: 'text', options: [['text', 'Texto completo'], ['number', 'Solo rótulo y número'], ['page', 'Número de página']] }] });
    if (!values) return;
    insert(`<a class="wd-xref" contenteditable="false" href="#${values.target}" data-target="${values.target}" data-show="${values.show}">ref</a>&nbsp;`);
    updateAllReferences(D(), doc());
  };

  // ---------- Encabezados y pies ----------
  actions.editHeader = () => ctx.openChrome('header');
  actions.editFooter = () => ctx.openChrome('footer');
  actions.pageNumbers = async () => {
    const current = doc();
    const values = await ctx.ask({ title: 'Número de página', fields: [{ name: 'show', label: 'Mostrar número de página', type: 'checkbox', value: current.pageNumbers }, { name: 'format', label: 'Formato', type: 'select', value: current.pageNumberFormat, options: [['arabic', '1, 2, 3'], ['dash', '- 1 -, - 2 -'], ['roman', 'i, ii, iii'], ['ROMAN', 'I, II, III'], ['alpha', 'a, b, c'], ['page-of', 'Página X de Y']] }, { name: 'start', label: 'Empezar en', type: 'number', value: current.pageNumberStart, min: 0 }, { name: 'align', label: 'Posición', type: 'select', value: current.pageNumberAlign, options: [['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']] }] });
    if (values) ctx.patchDoc({ pageNumbers: values.show, pageNumberFormat: values.format, pageNumberStart: Number(values.start), pageNumberAlign: values.align });
  };
  actions.headerOptions = async () => {
    const current = doc();
    const values = await ctx.ask({ title: 'Opciones de encabezado y pie de página', fields: [{ name: 'first', label: 'Primera página diferente', type: 'checkbox', value: current.differentFirst }, { name: 'oddEven', label: 'Páginas pares e impares diferentes', type: 'checkbox', value: current.differentOddEven }, { name: 'link', label: 'Vincular al anterior (mismo contenido en todas las secciones)', type: 'checkbox', value: true }] });
    if (!values) return;
    const patch = { differentFirst: values.first, differentOddEven: values.oddEven };
    if (values.link) Object.assign(patch, { headerFirst: current.headerFirst || (values.first ? '' : current.header), headerEven: current.headerEven || current.header, footerEven: current.footerEven || current.footer });
    ctx.patchDoc(patch);
  };

  // ---------- SprintOps ----------
  actions.mention = async (kind) => {
    if (!editable()) return;
    const data = await needProject();
    if (!data) return;
    const items = kind === 'issue' ? data.issues.map((issue) => ({ id: issue.id, label: `#${issue.id} ${issue.title}`, hint: issue.status, value: issue }))
      : kind === 'user' ? data.members.map((member) => ({ id: member.userId, label: member.name, hint: member.role, value: member }))
        : data.sprints.map((sprint) => ({ id: sprint.id, label: sprint.name, hint: sprint.status, value: sprint }));
    const picked = await choose(kind === 'issue' ? 'Referenciar issue' : kind === 'user' ? 'Mencionar usuario' : 'Referenciar sprint', items);
    if (picked) insert(refHtml(kind, picked.value, data));
  };
  actions.live = async (kind) => {
    if (!editable()) return;
    const data = await needProject();
    if (!data) return;
    const fields = [];
    if (['issues', 'tasks', 'metrics', 'status', 'progress', 'people'].includes(kind)) fields.push({ name: 'sprint', label: 'Sprint', type: 'select', value: '', options: [['', 'Todo el proyecto'], ...data.sprints.map((sprint) => [String(sprint.id), sprint.name])] });
    if (['issues', 'tasks'].includes(kind)) {
      fields.push({ name: 'status', label: 'Estado', type: 'select', value: '', options: [['', 'Todos'], ['todo', 'Por hacer'], ['in_progress', 'En progreso'], ['done', 'Finalizado']] });
      fields.push({ name: 'assignee', label: 'Responsable', type: 'select', value: '', options: [['', 'Todos'], ...data.members.map((member) => [String(member.userId), member.name])] });
    }
    if (kind === 'calendar') fields.push({ name: 'month', label: 'Mes', type: 'month', value: new Date().toISOString().slice(0, 7) });
    const options = fields.length ? await ctx.ask({ title: LIVE_BLOCKS[kind], fields, submitLabel: 'Insertar' }) : {};
    if (!options) return;
    block(liveBlockHtml(kind, data, options));
  };
  actions.projectReport = async () => {
    if (!editable()) return;
    const data = await needProject();
    if (data) block(projectReport(data, ctx.meta?.projectName));
  };
  actions.refreshRefs = async () => {
    const data = await ctx.refreshProject(true);
    if (!data) return toast.info('Vincula un proyecto para actualizar referencias.');
    hydrateRefs(D(), data);
    hydrateLiveBlocks(D(), data);
    ctx.change();
    toast.success('Referencias y bloques del proyecto actualizados.');
  };
  actions.textToIssue = async (presetTitle, presetDescription) => {
    const data = await needProject();
    if (!data) return;
    const text = presetTitle || selectionText().trim();
    if (!text) return toast.info('Selecciona el texto que se convertirá en issue.');
    const active = data.sprints.find((sprint) => sprint.status === 'active');
    const values = await ctx.ask({ title: 'Crear issue', fields: [{ name: 'title', label: 'Título', value: text.split('\n')[0].slice(0, 120), full: true }, { name: 'description', label: 'Descripción', type: 'textarea', value: presetDescription || text }, { name: 'sprint', label: 'Sprint', type: 'select', value: active ? String(active.id) : '', options: [['', 'Backlog'], ...data.sprints.map((sprint) => [String(sprint.id), sprint.name])] }, { name: 'priority', label: 'Prioridad', type: 'select', value: 'Medium', options: [['High', 'Alta'], ['Medium', 'Media'], ['Low', 'Baja']] }, { name: 'assignee', label: 'Responsable', type: 'select', value: '', options: [['', 'Sin asignar'], ...data.members.map((member) => [String(member.userId), member.name])] }, { name: 'points', label: 'Story points', type: 'number', value: 1, min: 0 }] });
    if (!values?.title) return null;
    const issue = await issuesRepository.create({ projectId: data.projectId, sprintId: values.sprint || null, title: values.title, description: values.description, status: 'todo', priority: values.priority, storyPoints: Number(values.points) || 0, assigneeIds: values.assignee ? [Number(values.assignee)] : [] });
    const fresh = await ctx.refreshProject(true);
    if (!presetTitle && ctx.editable()) {
      restoreSelection(D());
      insertHtml(D(), refHtml('issue', issue, fresh || data));
      ctx.change();
    }
    toast.success(`Issue #${issue.id} creado.`);
    return issue;
  };
  actions.linkItems = async () => {
    const data = await needProject();
    if (!data) return;
    const result = await ctx.dialog('Vincular documento', ({ close }) => h(LinkEditor, { data, links: doc().links, close }), 'max-w-2xl');
    if (result) ctx.patchDoc({ links: result });
  };

  // ---------- Dibujo ----------
  const inkPage = () => ctx.inkSel().pageId;
  const selectedInk = () => (doc().ink[inkPage()] || []).filter((stroke) => ctx.inkSel().ids.includes(stroke.id));
  const setInk = (pageId, strokes) => ctx.patchDoc({ ink: { ...doc().ink, [pageId]: strokes } }, { noReflow: true });
  actions.deleteInk = () => {
    const pageId = inkPage();
    setInk(pageId, (doc().ink[pageId] || []).filter((stroke) => !ctx.inkSel().ids.includes(stroke.id)));
    ctx.setInkSel({ pageId: null, ids: [] });
  };
  actions.clearInk = () => {
    const pageId = inkPage() || doc().pages?.[0]?.id;
    if (pageId) setInk(pageId, []);
  };
  actions.smoothInk = () => {
    const ids = ctx.inkSel().ids;
    setInk(inkPage(), (doc().ink[inkPage()] || []).map((stroke) => (ids.includes(stroke.id) ? { ...stroke, points: smooth(stroke.points) } : stroke)));
  };
  actions.recognizeInk = () => {
    const ids = ctx.inkSel().ids;
    let count = 0;
    setInk(inkPage(), (doc().ink[inkPage()] || []).map((stroke) => {
      if (!ids.includes(stroke.id)) return stroke;
      const shape = recognize(stroke.points);
      if (!shape) return stroke;
      count += 1;
      return { ...stroke, points: idealPoints(shape) };
    }));
    toast[count ? 'success' : 'info'](count ? `${count} figuras reconocidas.` : 'No se reconocieron figuras en la selección.');
  };
  actions.inkToShapes = () => {
    if (!editable()) return;
    const pageId = inkPage();
    const body = D().querySelector(`[data-page-body][data-page-id="${pageId}"]`);
    if (!body) return;
    const current = doc();
    const offsetX = current.margins.left;
    const offsetY = current.margins.top + HEADER_SPACE;
    const converted = [];
    selectedInk().forEach((stroke) => {
      const shape = recognize(stroke.points);
      if (!shape) return;
      const type = { rect: 'rect', circle: 'circle', ellipse: 'ellipse', triangle: 'triangle', line: 'line', arrow: 'arrowLine' }[shape.type];
      const spec = { ...defaultShapeSpec(type), stroke: stroke.color, strokeWidth: Math.max(1.5, stroke.width), fill: SHAPES[type].line ? 'none' : `${stroke.color}22` };
      const box = shape.type === 'line' || shape.type === 'arrow' ? { x: Math.min(shape.x1, shape.x2), y: Math.min(shape.y1, shape.y2) - 10, w: Math.max(20, Math.abs(shape.x2 - shape.x1)), h: Math.max(20, Math.abs(shape.y2 - shape.y1)) } : shape.box;
      body.insertAdjacentHTML('beforeend', objectHtml('shape', spec, { width: box.w, height: box.h, wrap: 'front', extraStyle: `position:absolute;left:${Math.round(box.x - offsetX)}px;top:${Math.round(box.y - offsetY)}px;z-index:5;margin:0;` }));
      converted.push(stroke.id);
    });
    if (!converted.length) return toast.info('No se reconocieron figuras. Dibuja rectángulos, círculos, triángulos o líneas.');
    setInk(pageId, (current.ink[pageId] || []).filter((stroke) => !converted.includes(stroke.id)));
    ctx.setInkSel({ pageId: null, ids: [] });
    ctx.change({ noReflow: true });
  };
  actions.inkToText = async () => {
    const strokes = selectedInk();
    if (!strokes.length) return;
    const box = strokeBounds(strokes);
    const svg = inkToSvg(strokes, box, 16);
    const png = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(64, Math.round((box.w + 32) * 2));
        canvas.height = Math.max(64, Math.round((box.h + 32) * 2));
        const c = canvas.getContext('2d');
        c.fillStyle = '#fff';
        c.fillRect(0, 0, canvas.width, canvas.height);
        c.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
    toast.info('Reconociendo escritura a mano…');
    const text = (await ctx.ai('ink-to-text', { image: png, instruction: `Idioma probable: ${doc().language}` })).trim();
    if (!text) return toast.info('No se reconoció texto.');
    const values = await ctx.ask({ title: 'Texto reconocido', fields: [{ name: 'text', label: 'Revisa el texto', type: 'textarea', value: text }, { name: 'remove', label: 'Eliminar la tinta original', type: 'checkbox', value: true }], submitLabel: 'Insertar en el cursor' });
    if (!values) return;
    if (ctx.editable()) { restoreSelection(D()); insertHtml(D(), textToHtml(values.text)); ctx.change(); }
    if (values.remove) actions.deleteInk();
  };
  actions.groupInk = () => {
    const group = uid('g');
    const ids = ctx.inkSel().ids;
    setInk(inkPage(), (doc().ink[inkPage()] || []).map((stroke) => (ids.includes(stroke.id) ? { ...stroke, group } : stroke)));
    toast.success('Trazos agrupados.');
  };
  actions.ungroupInk = () => {
    const ids = ctx.inkSel().ids;
    setInk(inkPage(), (doc().ink[inkPage()] || []).map((stroke) => (ids.includes(stroke.id) ? { ...stroke, group: undefined } : stroke)));
  };

  // ---------- Diseño ----------
  actions.saveTheme = async () => {
    const values = await ctx.ask({ title: 'Guardar tema', fields: [{ name: 'name', label: 'Nombre del tema', value: 'Mi tema' }] });
    if (!values?.name) return;
    const theme = { ...doc().theme, id: uid('theme'), name: values.name };
    ctx.storage.set('themes', [...ctx.storage.get('themes', []), theme]);
    ctx.patchDoc({ theme });
    toast.success('Tema guardado.');
  };
  actions.backgroundImage = async () => {
    const file = await ctx.pick('image/*');
    if (!file) return;
    const image = await readImageFile(file);
    ctx.patchDoc({ background: { type: 'image', value: image.src } });
  };
  actions.watermark = async () => {
    const wm = doc().watermark;
    const values = await ctx.ask({ title: 'Marca de agua', fields: [{ name: 'type', label: 'Tipo', type: 'select', value: wm.type === 'image' ? 'image' : 'text', options: [['text', 'Texto'], ['image', 'Imagen']] }, { name: 'text', label: 'Texto', value: wm.text || 'CONFIDENCIAL', show: (v) => v.type === 'text' }, { name: 'color', label: 'Color', type: 'color', value: wm.color || '#94a3b8', show: (v) => v.type === 'text' }, { name: 'size', label: 'Tamaño (px)', type: 'number', value: wm.size || 96, show: (v) => v.type === 'text' }, { name: 'layout', label: 'Diseño', type: 'select', value: String(wm.rotate ?? -35), options: [['-35', 'Diagonal'], ['0', 'Horizontal']], show: (v) => v.type === 'text' }, { name: 'scale', label: 'Escala de la imagen (%)', type: 'number', value: wm.scale || 50, show: (v) => v.type === 'image' }, { name: 'opacity', label: 'Opacidad (%)', type: 'range', min: 5, max: 60, value: Math.round((wm.opacity ?? 0.18) * 100), suffix: '%' }] });
    if (!values) return;
    if (values.type === 'image') {
      const file = await ctx.pick('image/*');
      if (!file) return;
      const image = await readImageFile(file);
      ctx.patchDoc({ watermark: { type: 'image', image: image.src, opacity: values.opacity / 100, scale: Number(values.scale) } });
    } else ctx.patchDoc({ watermark: { type: 'text', text: values.text, color: values.color, size: Number(values.size), rotate: Number(values.layout), opacity: values.opacity / 100 } });
  };
  actions.pageBorders = async () => {
    const border = doc().pageBorder;
    const values = await ctx.ask({ title: 'Bordes de página', fields: [{ name: 'style', label: 'Estilo', type: 'select', value: border.style, options: [['none', 'Ninguno'], ['solid', 'Continuo'], ['double', 'Doble'], ['dashed', 'Discontinuo'], ['dotted', 'Punteado'], ['groove', 'Relieve'], ['ridge', 'Marco']] }, { name: 'color', label: 'Color', type: 'color', value: border.color || '#1e293b' }, { name: 'width', label: 'Grosor (px)', type: 'number', value: border.width || 2, min: 1, max: 20 }, { name: 'offset', label: 'Distancia al borde de la hoja (px)', type: 'number', value: border.offset ?? 24, min: 0, max: 120 }, { name: 'radius', label: 'Esquinas redondeadas (px)', type: 'number', value: border.radius || 0, min: 0, max: 60 }] });
    if (values) ctx.patchDoc({ pageBorder: { style: values.style, color: values.color, width: Number(values.width), offset: Number(values.offset), radius: Number(values.radius) } });
  };

  // ---------- Disposición ----------
  actions.customMargins = async () => {
    const m = doc().margins;
    const values = await ctx.ask({ title: 'Márgenes personalizados (cm)', fields: ['top', 'bottom', 'left', 'right'].map((side) => ({ name: side, label: { top: 'Superior', bottom: 'Inferior', left: 'Izquierdo', right: 'Derecho' }[side], type: 'number', step: 0.1, min: 0, value: cm(m[side]) })) });
    if (values) ctx.patchDoc({ margins: { top: px(values.top), right: px(values.right), bottom: px(values.bottom), left: px(values.left) } });
  };
  actions.customSize = async () => {
    const metrics = pageMetrics(doc());
    const values = await ctx.ask({ title: 'Tamaño de papel personalizado (cm)', fields: [{ name: 'width', label: 'Ancho', type: 'number', step: 0.1, value: cm(metrics.width), min: 5 }, { name: 'height', label: 'Alto', type: 'number', step: 0.1, value: cm(metrics.height), min: 5 }] });
    if (values) ctx.patchDoc({ pageSize: 'custom', orientation: 'portrait', customSize: { width: px(values.width), height: px(values.height) } });
  };
  actions.customColumns = async () => {
    const cols = doc().columns;
    const values = await ctx.ask({ title: 'Columnas', fields: [{ name: 'count', label: 'Número de columnas', type: 'number', value: cols.count, min: 1, max: 4 }, { name: 'gap', label: 'Espaciado entre columnas (cm)', type: 'number', step: 0.1, value: cm(cols.gap) }, { name: 'divider', label: 'Línea entre columnas', type: 'checkbox', value: cols.divider }] });
    if (values) ctx.patchDoc({ columns: { count: Math.min(4, Math.max(1, Number(values.count))), gap: px(values.gap), divider: values.divider } });
  };
  actions.pageSetup = async () => {
    const current = doc();
    const values = await ctx.ask({
      title: 'Configurar página',
      width: 'max-w-2xl',
      fields: [
        { name: 'size', label: 'Tamaño del papel', type: 'select', value: current.pageSize, options: [...Object.entries(PAGE_SIZES).map(([id, size]) => [id, size.label]), ['custom', 'Personalizado']] },
        { name: 'orientation', label: 'Orientación', type: 'select', value: current.orientation, options: [['portrait', 'Vertical'], ['landscape', 'Horizontal']] },
        ...['top', 'bottom', 'left', 'right'].map((side) => ({ name: side, label: `Margen ${{ top: 'superior', bottom: 'inferior', left: 'izquierdo', right: 'derecho' }[side]} (cm)`, type: 'number', step: 0.1, value: cm(current.margins[side]) })),
        { name: 'columns', label: 'Columnas', type: 'number', value: current.columns.count, min: 1, max: 4 },
        { name: 'start', label: 'Numeración de página empieza en', type: 'number', value: current.pageNumberStart, min: 0 },
        { name: 'first', label: 'Primera página diferente', type: 'checkbox', value: current.differentFirst },
        { name: 'oddEven', label: 'Pares e impares diferentes', type: 'checkbox', value: current.differentOddEven },
        { name: 'lines', label: 'Números de línea', type: 'checkbox', value: current.lineNumbers },
        { name: 'hyphen', label: 'Guiones', type: 'select', value: current.hyphenation, options: [['none', 'Ninguno'], ['auto', 'Automático'], ['manual', 'Manual']] },
      ],
    });
    if (!values) return;
    ctx.patchDoc({ pageSize: values.size, orientation: values.orientation, margins: { top: px(values.top), bottom: px(values.bottom), left: px(values.left), right: px(values.right) }, columns: { ...current.columns, count: Number(values.columns) }, pageNumberStart: Number(values.start), differentFirst: values.first, differentOddEven: values.oddEven, lineNumbers: values.lines, hyphenation: values.hyphen });
  };

  // ---------- Objetos ----------
  actions.wrap = (mode, side) => {
    const el = ensureObject();
    if (!el || !editable()) return;
    setWrap(el, mode, side || 'left');
    ctx.bumpObject();
    ctx.change();
  };
  actions.wrapDistance = async () => {
    const el = ensureObject();
    if (!el) return;
    const values = await ctx.ask({ title: 'Distancia respecto al texto', fields: [{ name: 'distance', label: 'Distancia (px)', type: 'number', value: Number(el.dataset.distance || 12), min: 0, max: 120 }] });
    if (values) { setDistance(el, values.distance); ctx.change(); }
  };
  actions.position = (horizontal, vertical) => {
    const el = ensureObject();
    if (!el || !editable()) return;
    setWrap(el, 'front');
    const body = el.closest('[data-page-body]');
    el.style.left = `${horizontal === 'left' ? 0 : horizontal === 'center' ? (body.clientWidth - el.offsetWidth) / 2 : body.clientWidth - el.offsetWidth}px`;
    el.style.top = `${vertical === 'top' ? 0 : vertical === 'middle' ? (body.clientHeight - el.offsetHeight) / 2 : body.clientHeight - el.offsetHeight}px`;
    ctx.bumpObject();
    ctx.change();
  };
  actions.zorder = (mode) => { const el = ensureObject(); if (el && editable()) { setZ(el, mode); ctx.change({ noReflow: true }); } };
  actions.alignObjects = (mode) => {
    const list = ctx.objects().length ? ctx.objects() : [ensureObject()].filter(Boolean);
    if (!list.length || !editable()) return;
    alignObjects(list, mode);
    ctx.bumpObject();
    ctx.change({ noReflow: true });
  };
  actions.distribute = (axis) => { if (editable()) { distributeObjects(ctx.objects(), axis); ctx.bumpObject(); ctx.change({ noReflow: true }); } };
  actions.group = () => {
    if (!editable()) return;
    const group = groupObjects(ctx.objects());
    if (group) { ctx.selectObject(group); ctx.change(); }
  };
  actions.ungroup = () => {
    const el = ensureObject();
    if (!el || el.dataset.kind !== 'group' || !editable()) return;
    const children = ungroupObjects(el);
    ctx.selectObject(children[0]);
    children.slice(1).forEach((child) => ctx.selectObject(child, true));
    ctx.change();
  };
  actions.rotate = (degrees) => { const el = ensureObject(); if (el && editable()) { rotateBy(el, degrees); ctx.bumpObject(); ctx.change({ noReflow: true }); } };
  actions.rotateExact = async () => {
    const el = ensureObject();
    if (!el) return;
    const values = await ctx.ask({ title: 'Girar', fields: [{ name: 'deg', label: 'Ángulo (°)', type: 'number', value: Number(el.dataset.rotate || 0), min: -360, max: 360 }] });
    if (values) { el.dataset.rotate = String(values.deg); applyTransform(el); ctx.bumpObject(); ctx.change({ noReflow: true }); }
  };
  actions.flip = (axis) => { const el = ensureObject(); if (el && editable()) { flip(el, axis); ctx.change({ noReflow: true }); } };
  actions.deleteObject = () => {
    const list = ctx.objects().length ? ctx.objects() : [pickedObject()].filter(Boolean);
    if (!list.length || !editable()) return;
    list.forEach((el) => el.remove());
    ctx.selectObject(null);
    ctx.change();
  };
  actions.resize = (width, height) => {
    const el = ensureObject();
    if (!el || !editable()) return;
    const ratio = el.offsetHeight / (el.offsetWidth || 1);
    const lock = el.tagName === 'IMG' || ['image', 'chart', 'diagram'].includes(el.dataset.kind);
    if (width) { el.style.width = `${width}px`; if (lock) el.style.height = `${Math.round(width * ratio)}px`; }
    if (height) { el.style.height = `${height}px`; if (lock) el.style.width = `${Math.round(height / ratio)}px`; }
    ctx.bumpObject();
    ctx.change();
  };
  actions.adjust = (patch) => { const el = ensureObject(); if (el && editable()) { writeAdjust(el, patch); ctx.bumpObject(); ctx.change({ noReflow: true }); } };
  const imageEl = () => imageOf(ensureObject());
  const keepOriginal = (el, img) => { if (!el.dataset.original) el.dataset.original = img.src; };
  actions.removeBackground = async () => {
    const el = ensureObject();
    const img = imageEl();
    if (!img || !editable()) return;
    toast.info('Quitando el fondo…');
    keepOriginal(el, img);
    try {
      img.src = await removeBackground(img.src);
      ctx.change({ noReflow: true });
      toast.success('Fondo eliminado. Restablecer imagen lo deshace.');
    } catch {
      toast.error('No se pudo procesar esta imagen (puede estar protegida por su sitio de origen).');
    }
  };
  actions.compress = async () => {
    const img = imageEl();
    if (!img || !editable()) return;
    const before = img.src.length;
    try {
      const src = await compressImage(img.src);
      if (src.length < before) { img.src = src; ctx.change({ noReflow: true }); toast.success(`Imagen comprimida: ${Math.round(before / 1024)} KB → ${Math.round(src.length / 1024)} KB`); } else toast.info('La imagen ya está optimizada.');
    } catch {
      toast.error('No se pudo comprimir esta imagen.');
    }
  };
  actions.replaceImage = async () => {
    const img = imageEl();
    if (!img || !editable()) return;
    const file = await ctx.pick('image/*');
    if (!file) return;
    const image = await readImageFile(file);
    img.src = image.src;
    const el = ensureObject();
    el.dataset.original = image.src;
    ctx.change();
  };
  actions.resetImage = () => {
    const el = ensureObject();
    const img = imageOf(el);
    if (!img || !editable()) return;
    if (el.dataset.original) img.src = el.dataset.original;
    el.dataset.adjust = '{}';
    el.dataset.rotate = '0';
    el.dataset.flipH = 'false';
    el.dataset.flipV = 'false';
    applyTransform(el);
    applyAdjustments(el);
    ctx.bumpObject();
    ctx.change();
  };
  actions.altText = async () => {
    const img = imageEl();
    if (!img) return;
    const values = await ctx.ask({ title: 'Texto alternativo', description: 'Describe la imagen para lectores de pantalla.', fields: [{ name: 'alt', label: 'Descripción', type: 'textarea', rows: 3, value: img.alt }, { name: 'decorative', label: 'Marcar como decorativa', type: 'checkbox', value: img.getAttribute('role') === 'presentation' }] });
    if (!values) return;
    img.alt = values.decorative ? '' : values.alt;
    if (values.decorative) img.setAttribute('role', 'presentation'); else img.removeAttribute('role');
    ctx.change({ noReflow: true });
  };
  actions.crop = async () => {
    const el = ensureObject();
    const img = imageOf(el);
    if (!img || !editable()) return;
    const values = await ctx.ask({ title: 'Recortar imagen (%)', fields: ['top', 'right', 'bottom', 'left'].map((side) => ({ name: side, label: { top: 'Arriba', right: 'Derecha', bottom: 'Abajo', left: 'Izquierda' }[side], type: 'range', min: 0, max: 45, value: 0, suffix: '%' })) });
    if (!values) return;
    keepOriginal(el, img);
    try {
      const { src, ratio } = await cropImage(img.src, values);
      img.src = src;
      el.style.height = `${Math.round(el.offsetWidth * ratio)}px`;
      ctx.bumpObject();
      ctx.change();
    } catch {
      toast.error('No se pudo recortar esta imagen.');
    }
  };
  actions.shapeSpec = (patch) => {
    const el = ensureObject();
    if (!el || !editable()) return;
    updateObject(el, { ...readSpec(el), ...patch });
    if (patch.type) el.dataset.lockRatio = SHAPES[patch.type]?.square ? 'true' : 'false';
    ctx.change({ noReflow: true });
  };
  actions.shapeText = async () => {
    const el = ensureObject();
    if (!el) return;
    const spec = readSpec(el);
    const values = await ctx.ask({ title: 'Texto de la forma', fields: [{ name: 'text', label: 'Texto', type: 'textarea', rows: 3, value: spec.text || '' }, { name: 'textColor', label: 'Color', type: 'color', value: spec.textColor || '#1e293b' }, { name: 'fontSize', label: 'Tamaño', type: 'number', value: spec.fontSize || 16 }] });
    if (values) actions.shapeSpec({ ...values, fontSize: Number(values.fontSize) });
  };
  actions.chartData = async (given) => {
    const el = given || ensureObject();
    if (!el) return;
    const spec = readSpec(el);
    const values = await ctx.ask({ title: 'Editar datos del gráfico', width: 'max-w-2xl', description: 'Primera fila: nombres de las series. Primera columna: categorías. Separa con comas o tabulaciones (puedes pegar desde una hoja de cálculo).', fields: [{ name: 'title', label: 'Título', value: spec.title, full: true }, { name: 'type', label: 'Tipo', type: 'select', value: spec.type, options: Object.entries(CHART_TYPES) }, { name: 'csv', label: 'Datos', type: 'textarea', rows: 9, value: dataToCsv(spec) }] });
    if (!values) return;
    const data = csvToData(values.csv);
    if (!data) return toast.error('Los datos necesitan encabezado y al menos una fila.');
    updateObject(el, { ...spec, title: values.title, type: values.type, ...data });
    ctx.change({ noReflow: true });
  };
  actions.chartSpec = (patch) => {
    const el = ensureObject();
    if (el && editable()) { updateObject(el, { ...readSpec(el), ...patch }); ctx.change({ noReflow: true }); }
  };
  actions.chartAxes = async () => {
    const el = ensureObject();
    if (!el) return;
    const spec = readSpec(el);
    const values = await ctx.ask({ title: 'Títulos y ejes', fields: [{ name: 'title', label: 'Título del gráfico', value: spec.title, full: true }, { name: 'xTitle', label: 'Título del eje horizontal', value: spec.xTitle }, { name: 'yTitle', label: 'Título del eje vertical', value: spec.yTitle }, { name: 'bins', label: 'Intervalos (histograma)', type: 'number', value: spec.bins || 5, min: 2, max: 30 }] });
    if (values) actions.chartSpec({ ...values, bins: Number(values.bins) });
  };
  actions.diagramText = async () => {
    const el = ensureObject();
    if (!el) return;
    const spec = readSpec(el);
    const values = await ctx.ask({ title: 'Texto del diagrama', description: 'Un nodo por línea. Usa dos espacios de sangría para crear hijos (jerarquías y organigramas).', fields: [{ name: 'text', label: 'Nodos', type: 'textarea', rows: 10, value: spec.text }] });
    if (values) actions.diagramSpec({ text: values.text });
  };
  actions.diagramNode = (direction) => {
    const el = ensureObject();
    if (!el) return;
    const spec = readSpec(el);
    const lines = spec.text.split('\n').filter((line) => line.trim());
    if (direction > 0) lines.push(`Nuevo ${lines.length + 1}`);
    else if (lines.length > 1) lines.pop();
    actions.diagramSpec({ text: lines.join('\n') });
  };
  actions.diagramSpec = (patch) => {
    const el = ensureObject();
    if (!el || !editable()) return;
    const spec = { ...readSpec(el), ...patch };
    updateObject(el, spec);
    el.style.height = `${Math.round(el.offsetWidth * diagramAspect(spec))}px`;
    ctx.bumpObject();
    ctx.change();
  };
  actions.editObject = (given) => {
    const el = given || pickedObject();
    if (!el) return;
    if (el.matches('figure.wd-mermaid')) return actions.mermaid(el);
    if (el.matches('.wd-eq')) return actions.equation(el);
    if (el.matches('.wd-progress-block')) return actions.progress(el);
    const kind = el.tagName === 'IMG' ? 'image' : el.dataset.kind;
    ctx.selectObject(el.closest('figure.wd-obj') || el);
    if (kind === 'shape') return actions.shapeText();
    if (kind === 'chart') return actions.chartData(el);
    if (kind === 'diagram') return actions.diagramText();
    if (kind === 'wordart') return actions.wordart(el);
    if (kind === 'signature') return actions.signature(el);
    if (kind === 'textbox') { const inner = el.querySelector('.wd-textbox-body'); inner?.focus(); return undefined; }
    if (kind === 'icon') return actions.iconColor(el);
    if (kind === 'image') return actions.altText();
    return undefined;
  };
  actions.iconColor = async (el) => {
    const spec = readSpec(el);
    const values = await ctx.ask({ title: 'Color del icono', fields: [{ name: 'color', label: 'Color', type: 'color', value: spec.color && spec.color !== 'inherit' ? spec.color : '#2f6f5e' }] });
    if (values) { updateObject(el, { ...spec, color: values.color }); ctx.change({ noReflow: true }); }
  };
  actions.progress = async (el) => {
    if (!editable()) return;
    const values = await ctx.ask({ title: 'Barra de progreso', fields: [{ name: 'label', label: 'Etiqueta', value: el.dataset.label || 'Progreso' }, { name: 'value', label: 'Valor (%)', type: 'range', min: 0, max: 100, value: Number(el.dataset.value || 50), suffix: '%' }] });
    if (!values) return;
    const holder = document.createElement('div');
    holder.innerHTML = progressHtml(values.value, values.label);
    el.replaceWith(holder.firstElementChild);
    ctx.change();
  };

  // ---------- Referencias ----------
  const refreshRefsSoon = () => setTimeout(() => { updateAllReferences(D(), doc()); ctx.change({ noHistory: true }); }, 120);
  actions.toc = (options) => { if (editable()) { block(tocHtml(D(), doc(), options)); refreshRefsSoon(); } };
  actions.tocDialog = async () => {
    const values = await ctx.ask({ title: 'Tabla de contenido', fields: [{ name: 'title', label: 'Título', value: 'Contenido' }, { name: 'levels', label: 'Mostrar niveles', type: 'number', value: 3, min: 1, max: 6 }, { name: 'pages', label: 'Mostrar números de página', type: 'checkbox', value: true }, { name: 'leader', label: 'Carácter de relleno', type: 'select', value: 'dots', options: [['dots', '.......'], ['dashes', '-------'], ['line', '_______'], ['none', '(ninguno)']] }, { name: 'manual', label: 'Índice manual (editable)', type: 'checkbox', value: false }] });
    if (values) actions.toc({ ...values, levels: Number(values.levels) });
  };
  actions.removeToc = () => { D().querySelectorAll('nav.wd-toc').forEach((nav) => nav.remove()); ctx.change(); };
  actions.updateToc = () => { updateAllReferences(D(), doc()); ctx.change(); toast.success('Índices y referencias actualizados.'); };
  actions.updateBibliography = actions.updateToc;
  actions.updateCaptions = actions.updateToc;
  actions.updateIndex = actions.updateToc;
  actions.note = async (kind) => {
    if (!editable()) return;
    restoreSelection(D());
    const values = await ctx.ask({ title: kind === 'end' ? 'Nota al final' : 'Nota al pie', fields: [{ name: 'text', label: 'Texto de la nota', type: 'textarea', rows: 3, value: '' }] });
    if (!values?.text) return;
    const id = uid('n');
    ctx.setDocRaw({ ...doc(), notes: [...doc().notes, { id, html: escapeHtml(values.text) }] });
    insert(noteRefHtml(id, kind));
  };
  actions.editNote = async (id) => {
    const target = id || anchorElement()?.closest?.('sup.wd-note-ref')?.dataset.note;
    const note = doc().notes.find((item) => item.id === target);
    if (!note) return toast.info('Selecciona una llamada de nota.');
    const values = await ctx.ask({ title: 'Editar nota', fields: [{ name: 'text', label: 'Texto', type: 'textarea', rows: 4, value: plainText(note.html) }, ...(ctx.editable() ? [{ name: 'remove', label: 'Eliminar esta nota', type: 'checkbox', value: false }] : [])] });
    if (!values || !ctx.editable()) return;
    if (values.remove) return actions.deleteNote(target);
    ctx.patchDoc({ notes: doc().notes.map((item) => (item.id === target ? { ...item, html: escapeHtml(values.text) } : item)) });
  };
  actions.deleteNote = (id) => {
    const target = id || anchorElement()?.closest?.('sup.wd-note-ref')?.dataset.note;
    if (!target) return;
    D().querySelectorAll(`sup.wd-note-ref[data-note="${target}"]`).forEach((ref) => ref.remove());
    ctx.patchDoc({ notes: doc().notes.filter((item) => item.id !== target) });
  };
  actions.navNote = (direction) => {
    const refs = [...D().querySelectorAll('sup.wd-note-ref')];
    if (!refs.length) return toast.info('No hay notas.');
    const range = rangeIn(D()) || savedRange();
    const after = refs.findIndex((ref) => range && (range.comparePoint(ref, 0) > 0));
    const index = direction > 0 ? (after < 0 ? 0 : after) : ((after < 0 ? refs.length : after) - 2 + refs.length) % refs.length;
    const ref = refs[Math.max(0, index)];
    ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const r = document.createRange();
    r.setStartAfter(ref);
    document.getSelection().removeAllRanges();
    document.getSelection().addRange(r);
    rememberSelection(D());
  };
  actions.noteSettings = async () => {
    const s = doc().noteSettings || {};
    const formats = [['arabic', '1, 2, 3'], ['roman', 'i, ii, iii'], ['alpha', 'a, b, c'], ['symbol', '*, †, ‡']];
    const values = await ctx.ask({ title: 'Notas al pie y al final', fields: [{ name: 'footFormat', label: 'Formato de notas al pie', type: 'select', value: s.footFormat || 'arabic', options: formats }, { name: 'footStart', label: 'Empezar en', type: 'number', value: s.footStart || 1, min: 1 }, { name: 'endFormat', label: 'Formato de notas al final', type: 'select', value: s.endFormat || 'roman', options: formats }, { name: 'endStart', label: 'Empezar en', type: 'number', value: s.endStart || 1, min: 1 }] });
    if (values) ctx.patchDoc({ noteSettings: { ...values, footStart: Number(values.footStart), endStart: Number(values.endStart) } });
  };
  actions.convertNotes = (kind) => {
    if (!editable()) return;
    D().querySelectorAll(`sup.wd-note-ref[data-kind="${kind === 'end' ? 'foot' : 'end'}"]`).forEach((ref) => { ref.dataset.kind = kind; });
    ctx.change();
  };
  actions.citationStyle = (value) => { ctx.patchDoc({ citationStyle: value }); setTimeout(() => updateAllReferences(D(), doc()), 50); };
  actions.manageSources = () => ctx.dialog('Administrar fuentes', ({ close }) => h(SourceManager, { sources: doc().sources, ask: ctx.ask, close, onChange: (sources) => { ctx.patchDoc({ sources }); setTimeout(() => updateCitations(D(), doc()), 50); } }), 'max-w-2xl');
  actions.citation = async () => {
    if (!editable()) return;
    restoreSelection(D());
    let sources = doc().sources;
    if (!sources.length) {
      const values = await ctx.ask({ title: 'Agregar fuente', fields: SOURCE_FIELDS.map((field) => ({ ...field, value: field.name === 'type' ? 'book' : '' })), width: 'max-w-2xl' });
      if (!values?.title) return;
      sources = [...sources, { ...values, id: uid('src') }];
      ctx.setDocRaw({ ...doc(), sources });
    }
    const values = await ctx.ask({ title: 'Insertar cita', fields: [{ name: 'source', label: 'Fuente', type: 'select', value: sources[0].id, options: sources.map((source) => [source.id, `${source.author || 'Sin autor'} — ${source.title}`]), full: true }, { name: 'page', label: 'Página (opcional)', value: '' }] });
    if (!values) return;
    insert(`<span class="wd-cite" contenteditable="false" data-source="${values.source}" data-page="${escapeHtml(values.page)}">(cita)</span>&nbsp;`);
    updateCitations(D(), doc());
  };
  actions.bibliography = (title) => { if (editable()) { const order = updateCitations(D(), doc()); block(bibliographyHtml(doc(), order, title)); } };
  actions.caption = async (label) => {
    if (!editable()) return;
    const values = await ctx.ask({ title: `Título de ${label.toLowerCase()}`, fields: [{ name: 'text', label: 'Texto', value: '', full: true }, { name: 'position', label: 'Posición', type: 'select', value: label === 'Tabla' ? 'above' : 'below', options: [['below', 'Debajo del elemento seleccionado'], ['above', 'Encima del elemento seleccionado']] }] });
    if (!values) return;
    const html = captionHtml(label, values.text);
    const target = pickedObject()?.closest('[data-page-body] > *') || (label === 'Tabla' ? ctx.cell()?.closest('table') : null);
    if (target) {
      target.insertAdjacentHTML(values.position === 'above' ? 'beforebegin' : 'afterend', html);
      ctx.change();
    } else block(html);
    updateAllReferences(D(), doc());
  };
  actions.tableOfFigures = async () => {
    const values = await ctx.ask({ title: 'Tabla de ilustraciones', fields: [{ name: 'label', label: 'Rótulo', type: 'select', value: 'Figura', options: [['Figura', 'Figura'], ['Tabla', 'Tabla'], ['Ecuación', 'Ecuación']] }] });
    if (values && editable()) { block(tableOfFiguresHtml(D(), doc(), values.label)); refreshRefsSoon(); }
  };
  actions.markEntry = async () => {
    if (!editable()) return;
    restoreSelection(D());
    const text = selectionText().trim();
    const values = await ctx.ask({ title: 'Marcar entrada de índice', fields: [{ name: 'entry', label: 'Entrada principal', value: text.slice(0, 60) }, { name: 'sub', label: 'Subentrada', value: '' }, { name: 'all', label: 'Marcar todas las apariciones', type: 'checkbox', value: false }] });
    if (!values?.entry) return;
    const marker = `<span class="wd-idx" contenteditable="false" data-entry="${escapeHtml(values.entry)}" data-sub="${escapeHtml(values.sub)}"></span>`;
    if (values.all && text) {
      const ranges = findAll(D(), { query: text, matchCase: false, wholeWord: true });
      [...ranges].reverse().forEach((range) => { const r = range.cloneRange(); r.collapse(false); const holder = document.createElement('span'); holder.innerHTML = marker; r.insertNode(holder.firstChild); });
      ctx.change();
      toast.success(`${ranges.length} entradas marcadas.`);
    } else {
      const range = rangeIn(D()) || savedRange();
      range?.collapse(false);
      if (range) { document.getSelection().removeAllRanges(); document.getSelection().addRange(range); }
      insert(marker);
    }
  };
  actions.index = () => { if (editable()) { block(indexHtml(D(), doc())); refreshRefsSoon(); } };
  actions.markAuthority = async () => {
    if (!editable()) return;
    restoreSelection(D());
    const values = await ctx.ask({ title: 'Marcar cita (tabla de autoridades)', fields: [{ name: 'cite', label: 'Cita larga', value: selectionText().trim().slice(0, 120), full: true }, { name: 'category', label: 'Categoría', type: 'select', value: 'Casos', options: [['Casos', 'Casos'], ['Leyes', 'Leyes'], ['Reglamentos', 'Reglamentos'], ['Tratados', 'Tratados'], ['Otras autoridades', 'Otras autoridades']] }] });
    if (!values?.cite) return;
    const range = rangeIn(D()) || savedRange();
    range?.collapse(false);
    if (range) { document.getSelection().removeAllRanges(); document.getSelection().addRange(range); }
    insert(`<span class="wd-auth" contenteditable="false" data-cite="${escapeHtml(values.cite)}" data-category="${escapeHtml(values.category)}"></span>`);
  };
  actions.authorities = () => { if (editable()) { block(authoritiesHtml(D(), doc())); refreshRefsSoon(); } };

  // ---------- Correspondencia ----------
  actions.mergeRows = () => {
    const r = doc().recipients;
    let rows = r.rows.map((row, index) => ({ index, data: Object.fromEntries(r.fields.map((field, column) => [field, row[column] ?? ''])) })).filter((row) => !r.excluded.includes(row.index));
    if (r.filter?.field) {
      const value = String(r.filter.value || '').toLowerCase();
      rows = rows.filter((row) => {
        const cell = String(row.data[r.filter.field] || '').toLowerCase();
        return { contains: cell.includes(value), equals: cell === value, not: cell !== value, empty: !cell, notempty: Boolean(cell) }[r.filter.op || 'contains'];
      });
    }
    if (r.sort?.field) rows.sort((a, b) => String(a.data[r.sort.field]).localeCompare(String(b.data[r.sort.field]), 'es', { numeric: true }) * (r.sort.dir === 'desc' ? -1 : 1));
    return rows.map((row) => row.data);
  };
  const setRecipients = (patch) => ctx.patchDoc({ recipients: { ...doc().recipients, ...patch } }, { noReflow: true });
  actions.mailType = async (type) => {
    if (!editable()) return;
    if (type === 'envelope') {
      ctx.patchDoc({ mailType: type, pageSize: 'envelope', orientation: 'portrait', margins: { top: 36, right: 48, bottom: 36, left: 48 }, pageNumbers: false });
      if (!plainText(ctx.readModel().pages[0].html).trim()) block('<p class="wd-env-return">Remitente<br>Dirección</p><p class="wd-env-to"><span class="wd-merge" contenteditable="false" data-field="Nombre">«Nombre»</span><br><span class="wd-merge" contenteditable="false" data-field="Dirección">«Dirección»</span></p>');
    } else if (type === 'labels') {
      const fields = doc().recipients.fields.slice(0, 3);
      const content = (fields.length ? fields : ['Nombre', 'Dirección']).map((field) => `<span class="wd-merge" contenteditable="false" data-field="${escapeHtml(field)}">«${escapeHtml(field)}»</span>`).join('<br>');
      const cells = Array.from({ length: 30 }, (_, index) => `<td>${index ? '<span class="wd-merge-next" contenteditable="false">«Siguiente registro»</span><br>' : ''}${content}</td>`);
      const rows = Array.from({ length: 10 }, (_, r) => `<tr>${cells.slice(r * 3, r * 3 + 3).join('')}</tr>`).join('');
      ctx.patchDoc({ mailType: type, pageSize: 'letter', margins: { top: 48, right: 18, bottom: 48, left: 18 }, pageNumbers: false });
      block(`<table class="wd-labels"><tbody>${rows}</tbody></table>`);
    } else {
      ctx.patchDoc({ mailType: type });
      if (type === 'email') toast.info('Escribe el correo y usa Finalizar y combinar › Enviar correos personalizados.');
    }
  };
  actions.recipients = async (mode) => {
    if (mode === 'import') {
      const file = await ctx.pick('.csv,.tsv,.txt,text/csv');
      if (!file) return;
      const rows = parseCsv(await file.text());
      if (rows.length < 2) return toast.error('El archivo necesita encabezados y al menos un registro.');
      setRecipients({ fields: rows[0], rows: rows.slice(1), excluded: [] });
      toast.success(`${rows.length - 1} destinatarios importados.`);
      return;
    }
    if (mode === 'members' || mode === 'issues') {
      const data = await needProject();
      if (!data) return;
      if (mode === 'members') setRecipients({ fields: ['Nombre', 'Correo', 'Rol'], rows: data.members.map((member) => [member.name, member.email, member.role || '']), excluded: [] });
      else setRecipients({ fields: ['ID', 'Título', 'Estado', 'Prioridad', 'Puntos'], rows: data.issues.map((issue) => [String(issue.id), issue.title, issue.status, issue.priority, String(issue.storyPoints ?? 0)]), excluded: [] });
      toast.success('Destinatarios conectados al proyecto.');
      return;
    }
    const r = doc().recipients;
    const values = await ctx.ask({ title: 'Lista de destinatarios', width: 'max-w-3xl', description: 'Primera línea: nombres de los campos. Una línea por destinatario, separado por comas. Excluye registros escribiendo sus números (1 = primero).', fields: [{ name: 'csv', label: 'Destinatarios', type: 'textarea', rows: 12, value: r.fields.length ? toCsv(r.fields, r.rows) : 'Nombre,Correo,Empresa,Dirección\nAna López,ana@correo.com,Pistache,Calle 1\nLuis Pérez,luis@correo.com,SprintOps,Av. 2' }, { name: 'excluded', label: 'Excluir registros', value: r.excluded.map((index) => index + 1).join(', '), placeholder: 'Ej.: 2, 5' }] });
    if (!values) return;
    const rows = parseCsv(values.csv);
    setRecipients({ fields: rows[0] || [], rows: rows.slice(1), excluded: values.excluded.split(/[,\s]+/).map(Number).filter((n) => n > 0).map((n) => n - 1) });
  };
  actions.filterRecipients = async () => {
    const r = doc().recipients;
    if (!r.fields.length) return toast.info('Primero agrega destinatarios.');
    const values = await ctx.ask({ title: 'Filtrar destinatarios', fields: [{ name: 'field', label: 'Campo', type: 'select', value: r.filter?.field || '', options: [['', '(sin filtro)'], ...r.fields.map((field) => [field, field])] }, { name: 'op', label: 'Comparación', type: 'select', value: r.filter?.op || 'contains', options: [['contains', 'Contiene'], ['equals', 'Es igual a'], ['not', 'No es igual a'], ['empty', 'Está vacío'], ['notempty', 'No está vacío']] }, { name: 'value', label: 'Valor', value: r.filter?.value || '' }] });
    if (values) { setRecipients({ filter: values.field ? values : null }); toast.success(`${actions.mergeRows().length} destinatarios después del filtro.`); }
  };
  actions.sortRecipients = async () => {
    const r = doc().recipients;
    if (!r.fields.length) return toast.info('Primero agrega destinatarios.');
    const values = await ctx.ask({ title: 'Ordenar destinatarios', fields: [{ name: 'field', label: 'Ordenar por', type: 'select', value: r.sort?.field || r.fields[0], options: [['', '(sin orden)'], ...r.fields.map((field) => [field, field])] }, { name: 'dir', label: 'Orden', type: 'select', value: r.sort?.dir || 'asc', options: [['asc', 'Ascendente'], ['desc', 'Descendente']] }] });
    if (values) setRecipients({ sort: values.field ? values : null });
  };
  actions.mergeField = (field) => { if (editable()) insert(`<span class="wd-merge" contenteditable="false" data-field="${escapeHtml(field)}">«${escapeHtml(field)}»</span>&nbsp;`); };
  actions.mergeRule = async () => {
    if (!editable()) return;
    const fields = doc().recipients.fields;
    const values = await ctx.ask({ title: 'Regla: Si… entonces… si no…', fields: [{ name: 'field', label: 'Campo', type: 'select', value: fields[0], options: fields }, { name: 'op', label: 'Comparación', type: 'select', value: 'equals', options: [['equals', 'Es igual a'], ['not', 'No es igual a'], ['contains', 'Contiene'], ['gt', 'Mayor que'], ['lt', 'Menor que'], ['empty', 'Está vacío']] }, { name: 'value', label: 'Valor', value: '' }, { name: 'then', label: 'Insertar este texto', value: '', full: true }, { name: 'else', label: 'De lo contrario, este', value: '', full: true }] });
    if (!values) return;
    insert(`<span class="wd-merge-if" contenteditable="false" data-field="${escapeHtml(values.field)}" data-op="${values.op}" data-value="${escapeHtml(values.value)}" data-then="${escapeHtml(values.then)}" data-else="${escapeHtml(values.else)}">«SI ${escapeHtml(values.field)}»</span>&nbsp;`);
  };
  actions.addressBlock = () => {
    if (!editable()) return;
    const fields = doc().recipients.fields;
    const pickField = (re) => fields.find((field) => re.test(field));
    const lines = [pickField(/nombre|name/i), pickField(/empresa|company|organiza/i), pickField(/direcci|address|calle/i), pickField(/ciudad|city/i), pickField(/pa[ií]s|country/i)].filter(Boolean);
    block(`<p>${(lines.length ? lines : fields.slice(0, 3)).map((field) => `<span class="wd-merge" contenteditable="false" data-field="${escapeHtml(field)}">«${escapeHtml(field)}»</span>`).join('<br>')}</p>`);
  };
  actions.greetingLine = async () => {
    if (!editable()) return;
    const fields = doc().recipients.fields;
    const values = await ctx.ask({ title: 'Línea de saludo', fields: [{ name: 'greeting', label: 'Saludo', type: 'select', value: 'Estimado/a', options: [['Estimado/a', 'Estimado/a'], ['Hola', 'Hola'], ['Querido/a', 'Querido/a'], ['A quien corresponda', 'A quien corresponda']] }, { name: 'field', label: 'Campo del nombre', type: 'select', value: fields.find((field) => /nombre|name/i.test(field)) || fields[0], options: fields }, { name: 'punct', label: 'Puntuación', type: 'select', value: ':', options: [[':', ':'], [',', ','], ['', '(ninguna)']] }] });
    if (values) block(`<p>${escapeHtml(values.greeting)} <span class="wd-merge" contenteditable="false" data-field="${escapeHtml(values.field)}">«${escapeHtml(values.field)}»</span>${values.punct}</p>`);
  };
  const evalRule = (el, data) => {
    const cell = String(data[el.dataset.field] ?? '');
    const value = el.dataset.value || '';
    const ok = { equals: cell.toLowerCase() === value.toLowerCase(), not: cell.toLowerCase() !== value.toLowerCase(), contains: cell.toLowerCase().includes(value.toLowerCase()), gt: Number(cell) > Number(value), lt: Number(cell) < Number(value), empty: !cell }[el.dataset.op || 'equals'];
    return ok ? el.dataset.then || '' : el.dataset.else || '';
  };
  const fillMerge = (root, rows, startIndex = 0) => {
    let index = startIndex;
    const walker = [...root.querySelectorAll('.wd-merge, .wd-merge-if, .wd-merge-next')];
    walker.forEach((el) => {
      if (el.matches('.wd-merge-next')) { index += 1; el.textContent = ''; return; }
      const data = rows[index] || {};
      el.textContent = el.matches('.wd-merge-if') ? evalRule(el, data) : String(data[el.dataset.field] ?? '');
    });
    return index;
  };
  actions.mergePreview = (index) => {
    const rows = actions.mergeRows();
    const root = D();
    if (index === null || index === undefined) {
      root.querySelectorAll('.wd-merge').forEach((el) => { el.textContent = `«${el.dataset.field}»`; el.removeAttribute('data-preview'); });
      root.querySelectorAll('.wd-merge-if').forEach((el) => { el.textContent = `«SI ${el.dataset.field}»`; });
      root.querySelectorAll('.wd-merge-next').forEach((el) => { el.textContent = '«Siguiente registro»'; });
      ctx.setMergePreview(null);
      return;
    }
    const safe = Math.max(0, Math.min(rows.length - 1, index));
    fillMerge(root, rows, safe);
    root.querySelectorAll('.wd-merge').forEach((el) => el.setAttribute('data-preview', '1'));
    ctx.setMergePreview(safe);
  };
  const mergedHtml = (rows, startIndex) => {
    const holder = document.createElement('div');
    holder.innerHTML = exportHtml(ctx.readModel().pages.map((page) => page.html));
    const next = fillMerge(holder, rows, startIndex);
    holder.querySelectorAll('.wd-merge, .wd-merge-if, .wd-merge-next').forEach((el) => el.replaceWith(document.createTextNode(el.textContent)));
    return { html: holder.innerHTML, next };
  };
  const createDoc = async (name, html, extra = {}) => portfolioRepository.create({
    userId: ctx.user.id,
    name,
    projectId: ctx.meta?.projectId || null,
    document: serializeDocument({ kind: 'document', doc: { ...doc(), recipients: { fields: [], rows: [], excluded: [] }, comments: [], ink: {}, lock: null, ...extra, pages: [{ id: createId(), html }] } }),
  });
  actions.mergeDocs = async (mode) => {
    const rows = actions.mergeRows();
    if (!rows.length) return toast.info('No hay destinatarios.');
    const labels = doc().mailType === 'labels';
    if (mode === 'single') {
      const { html } = mergedHtml(rows, ctx.mergePreview() ?? 0);
      const created = await createDoc(`${ctx.name} · registro ${(ctx.mergePreview() ?? 0) + 1}`, html);
      return ctx.navigate(`/portafolio/${created.id}`);
    }
    if (mode === 'each') {
      if (rows.length > 50) return toast.error('Máximo 50 documentos individuales a la vez. Usa "Un documento con todos los registros".');
      for (let index = 0; index < rows.length; index += 1) {
        const first = Object.values(rows[index])[0] || index + 1;
        await createDoc(`${ctx.name} · ${first}`, mergedHtml(rows, index).html);
      }
      return toast.success(`${rows.length} documentos creados en Portafolio.`);
    }
    const parts = [];
    let index = 0;
    while (index < rows.length) {
      const { html, next } = mergedHtml(rows, index);
      parts.push(html);
      index = labels ? next + 1 : index + 1;
    }
    const created = await createDoc(`${ctx.name} · combinado`, parts.join('<hr class="wd-break">'));
    ctx.navigate(`/portafolio/${created.id}`);
  };
  actions.mergeEmails = async () => {
    const rows = actions.mergeRows();
    const fields = doc().recipients.fields;
    const values = await ctx.ask({ title: 'Enviar correos personalizados', fields: [{ name: 'to', label: 'Campo con el correo', type: 'select', value: fields.find((field) => /correo|mail/i.test(field)) || fields[0], options: fields }, { name: 'subject', label: 'Asunto', value: ctx.name }, { name: 'format', label: 'Formato', type: 'select', value: 'eml', options: [['eml', 'Descargar correos (.eml en .zip) con formato'], ['mailto', 'Abrir en mi cliente de correo (texto plano)']] }] });
    if (!values) return;
    const messages = rows.map((row, index) => ({ to: row[values.to], ...mergedHtml(rows, index) })).filter((message) => message.to);
    if (values.format === 'mailto') {
      return ctx.dialog('Correos personalizados', () => h('div', { className: 'wd-list' }, messages.map((message, index) => h('a', { key: index, className: 'wd-item', href: `mailto:${encodeURIComponent(message.to)}?subject=${encodeURIComponent(values.subject)}&body=${encodeURIComponent(plainText(message.html).slice(0, 1800))}`, target: '_blank', rel: 'noreferrer' }, `✉ ${message.to}`))));
    }
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    messages.forEach((message, index) => zip.file(`${String(index + 1).padStart(3, '0')}-${message.to.replace(/[^\w@.-]/g, '_')}.eml`, `To: ${message.to}\r\nSubject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(values.subject)))}?=\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nX-Unsent: 1\r\n\r\n${standaloneHtml(message.html, values.subject)}`));
    const { download } = await import('./io/exporters');
    download(await zip.generateAsync({ type: 'blob' }), `${ctx.name}-correos.zip`);
    toast.success(`${messages.length} correos generados. Ábrelos con tu cliente de correo para enviarlos.`);
  };
  actions.mergePrint = () => {
    const rows = actions.mergeRows();
    const parts = rows.map((_, index) => mergedHtml(rows, index).html);
    const win = window.open('', '_blank');
    if (!win) return toast.error('Permite ventanas emergentes para imprimir.');
    win.document.write(standaloneHtml(parts.join('<hr class="wd-break">'), ctx.name));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  // ---------- Revisar ----------
  actions.grammar = async () => {
    const text = selectionText().trim() || docText();
    if (!text) return toast.info('No hay texto que revisar.');
    toast.info('Revisando ortografía y gramática…');
    const result = parseJson(await ctx.ai('grammar', { text: text.slice(0, 20000), instruction: `Idioma: ${doc().language}` }));
    const dictionary = (doc().dictionary || []).map((word) => word.toLowerCase());
    const items = (result?.items || []).filter((item) => item.wrong && !dictionary.includes(item.wrong.toLowerCase()));
    ctx.setGrammar(items);
    ctx.openRight('grammar');
    if (!items.length) toast.success('No se encontraron errores.');
  };
  actions.applyFix = (item) => {
    if (!editable()) return false;
    const [range] = findAll(D(), { query: item.wrong, matchCase: true });
    if (!range) return false;
    range.deleteContents();
    range.insertNode(document.createTextNode(item.right));
    ctx.change();
    return true;
  };
  actions.addToDictionary = (word) => ctx.patchDoc({ dictionary: [...new Set([...(doc().dictionary || []), word])] }, { noReflow: true });
  actions.dictionary = async () => {
    const values = await ctx.ask({ title: 'Diccionario personalizado', description: 'Palabras que la revisión no marcará como error (una por línea).', fields: [{ name: 'words', label: 'Palabras', type: 'textarea', rows: 10, value: (doc().dictionary || []).join('\n') }] });
    if (values) ctx.patchDoc({ dictionary: values.words.split('\n').map((word) => word.trim()).filter(Boolean) }, { noReflow: true });
  };
  actions.synonyms = async () => {
    restoreSelection(D());
    let word = selectionText().trim();
    if (!word) {
      const s = document.getSelection();
      s.modify?.('move', 'backward', 'word');
      s.modify?.('extend', 'forward', 'word');
      word = s.toString().trim();
      rememberSelection(D());
    }
    if (!word) return toast.info('Selecciona una palabra.');
    const result = parseJson(await ctx.ai('synonyms', { text: word, instruction: `Idioma: ${doc().language}` }));
    const items = (result?.items || []).map((item) => ({ id: item, label: item }));
    const picked = await choose(`Sinónimos de “${word}”`, items, { empty: 'Sin sinónimos.' });
    if (picked && ctx.editable()) { restoreSelection(D()); document.execCommand('insertText', false, picked.label); ctx.change(); }
  };
  actions.wordCount = () => {
    const text = docText();
    const words = wordsOf(text).length;
    const root = D();
    const stats = [
      ['Páginas', root.querySelectorAll('.wd-page').length],
      ['Palabras', words],
      ['Caracteres (sin espacios)', text.replace(/\s/g, '').length],
      ['Caracteres (con espacios)', text.replace(/\n/g, '').length],
      ['Párrafos', root.querySelectorAll('[data-page-body] p, [data-page-body] li, [data-page-body] h1, [data-page-body] h2, [data-page-body] h3').length],
      ['Líneas (aprox.)', Math.round([...root.querySelectorAll('[data-page-body] p, [data-page-body] li')].reduce((sum, node) => sum + node.offsetHeight / (parseFloat(window.getComputedStyle(node).lineHeight) || 24), 0))],
      ['Tablas', root.querySelectorAll('[data-page-body] table').length],
      ['Imágenes y objetos', root.querySelectorAll('[data-page-body] img, [data-page-body] figure').length],
      ['Tiempo de lectura', `${Math.max(1, Math.round(words / 230))} min`],
      ['Tiempo para leer en voz alta', `${Math.max(1, Math.round(words / 140))} min`],
    ];
    const selected = selectionText();
    if (selected.trim()) stats.unshift(['Palabras seleccionadas', wordsOf(selected).length]);
    ctx.dialog('Estadísticas', () => h('table', { className: 'wd-stats' }, h('tbody', null, stats.map(([label, value]) => h('tr', { key: label }, h('th', null, label), h('td', null, String(value)))))));
  };
  actions.readAloud = () => {
    if (!('speechSynthesis' in window)) return toast.error('Tu navegador no admite lectura en voz alta.');
    let text = selectionText();
    if (!text.trim()) {
      const range = rangeIn(D()) || savedRange();
      const body = range?.startContainer.parentElement?.closest('[data-page-body]');
      if (range && body) {
        const rest = document.createRange();
        rest.setStart(range.startContainer, range.startOffset);
        const bodies = [...D().querySelectorAll('[data-page-body]')];
        const last = bodies[bodies.length - 1];
        rest.setEnd(last, last.childNodes.length);
        text = rest.toString();
      } else text = docText();
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 32000));
    utterance.lang = { es: 'es-ES', en: 'en-US', pt: 'pt-BR', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', ca: 'ca-ES', ja: 'ja-JP', zh: 'zh-CN' }[doc().language] || 'es-ES';
    utterance.onend = () => ctx.setReading(false);
    utterance.onerror = () => ctx.setReading(false);
    ctx.setReading(true);
    window.speechSynthesis.speak(utterance);
  };
  actions.stopReading = () => { window.speechSynthesis?.cancel(); ctx.setReading(false); };
  actions.accessibility = () => {
    const root = D();
    const issues = [];
    root.querySelectorAll('[data-page-body] img').forEach((img) => { if (!img.alt && img.getAttribute('role') !== 'presentation') issues.push({ el: img, kind: 'Error', text: 'Imagen sin texto alternativo', fix: () => { ctx.selectObject(img.closest('figure.wd-obj') || img); actions.altText(); } }); });
    let last = 0;
    root.querySelectorAll('[data-page-body] h1, [data-page-body] h2, [data-page-body] h3, [data-page-body] h4, [data-page-body] h5, [data-page-body] h6').forEach((heading) => {
      const level = Number(heading.tagName[1]);
      if (!heading.textContent.trim()) issues.push({ el: heading, kind: 'Advertencia', text: 'Encabezado vacío' });
      if (last && level > last + 1) issues.push({ el: heading, kind: 'Advertencia', text: `Salto de nivel de encabezado (H${last} → H${level})` });
      last = level;
    });
    root.querySelectorAll('[data-page-body] table').forEach((table) => { if (!table.querySelector('th')) issues.push({ el: table, kind: 'Error', text: 'Tabla sin fila de encabezado', fix: () => { T.setRepeatHeader(table, true); ctx.change(); } }); });
    root.querySelectorAll('[data-page-body] a[href]').forEach((link) => { if (/^(aqu[ií]|clic|click|here|link|enlace|ver m[aá]s)$/i.test(link.textContent.trim())) issues.push({ el: link, kind: 'Advertencia', text: `Texto de vínculo poco descriptivo: “${link.textContent.trim()}”` }); });
    const luminance = (rgb) => {
      const [r, g, b] = (rgb.match(/\d+(\.\d+)?/g) || [0, 0, 0]).slice(0, 3).map((value) => { const c = Number(value) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    root.querySelectorAll('[data-page-body] [style*="color"]').forEach((el) => {
      if (!el.textContent.trim()) return;
      const fg = luminance(window.getComputedStyle(el).color);
      const ratio = (1.05) / (fg + 0.05);
      if (ratio < 4.5) issues.push({ el, kind: 'Advertencia', text: `Contraste bajo (${ratio.toFixed(1)}:1) en “${el.textContent.trim().slice(0, 30)}”` });
    });
    if (!root.querySelector('[data-page-body] h1, [data-page-body] h2')) issues.push({ el: null, kind: 'Sugerencia', text: 'Usa encabezados para estructurar el documento (ayuda a la navegación).' });
    if (!ctx.name || /sin t[ií]tulo/i.test(ctx.name)) issues.push({ el: null, kind: 'Sugerencia', text: 'Pon un título descriptivo al documento.' });
    ctx.dialog('Comprobación de accesibilidad', ({ close }) => h(Picker, {
      items: issues.map((issue, index) => ({ id: index, label: issue.text, hint: issue.kind, value: issue })),
      empty: '✓ No se encontraron problemas de accesibilidad.',
      close: (picked) => {
        close();
        if (!picked) return;
        picked.value.el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        picked.value.fix?.();
      },
    }), 'max-w-xl');
  };
  actions.detectLanguage = async () => {
    const words = wordsOf(docText().toLowerCase()).slice(0, 3000);
    const scores = Object.fromEntries(Object.entries(LANG_HINTS).map(([lang, hints]) => [lang, words.filter((word) => hints.includes(word)).length]));
    let [best, score] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    if (score < 3 && words.length) {
      const result = parseJson(await ctx.ai('detect-language', { text: words.slice(0, 300).join(' ') }));
      if (result?.language) best = result.language;
    }
    const name = { es: 'Español', en: 'English' }[best] || best;
    toast.success(`Idioma detectado: ${name}. El documento usa el idioma de Ajustes.`);
  };
  actions.translate = async (scope, language) => {
    if (scope === 'selection') {
      const html = selectionHtml();
      if (!html) return toast.info('Selecciona el texto a traducir.');
      toast.info('Traduciendo…');
      const result = await ctx.ai('translate', { text: html, instruction: `Traduce al ${language}. Conserva el HTML.` });
      if (!ctx.editable()) return ctx.dialog('Traducción', () => h('div', { className: 'wd-ai-result', dangerouslySetInnerHTML: { __html: sanitizeHtml(result) } }));
      restoreSelection(D());
      insertHtml(D(), sanitizeHtml(result));
      ctx.change();
      return;
    }
    const pages = ctx.readModel().pages;
    const out = [];
    for (let index = 0; index < pages.length; index += 1) {
      toast.info(`Traduciendo página ${index + 1} de ${pages.length}…`);
      out.push(await ctx.ai('translate', { text: exportHtml([pages[index].html]), instruction: `Traduce al ${language}. Conserva exactamente la estructura HTML.` }));
    }
    const created = await createDoc(`${ctx.name} (${language})`, sanitizeHtml(out.join('')));
    toast.success('Documento traducido creado.');
    ctx.navigate(`/portafolio/${created.id}`);
  };

  // ---------- Comentarios ----------
  const members = () => ctx.project()?.members || [];
  const mentionIds = (text) => members().filter((member) => text.includes(`@${member.name}`)).map((member) => member.userId);
  const notifyMentions = (ids, text) => {
    if (!ids.length) return;
    portfolioRepository.mentions(ctx.hojaId, { userId: ctx.user.id, mentionedIds: ids, text }).then((result) => {
      if (result?.sent) toast.success(`Notificación enviada a ${result.sent} persona(s) por Telegram.`);
    }).catch(() => {});
  };
  const patchComments = (fn) => {
    ctx.patchDoc({ comments: fn(doc().comments) }, { noReflow: true });
  };
  actions.comment = async () => {
    if (!ctx.canComment) return toast.info('No tienes permiso para comentar.');
    restoreSelection(D());
    const range = rangeIn(D()) || savedRange();
    const quote = range?.toString().trim() ? range.toString() : '';
    if (!quote) return toast.info('Selecciona el texto que quieres comentar.');
    const body = range.startContainer.parentElement?.closest('[data-page-body]');
    const before = document.createRange();
    before.setStart(body, 0);
    before.setEnd(range.startContainer, range.startOffset);
    const prefix = before.toString();
    let occurrence = 0;
    let at = prefix.indexOf(quote);
    while (at >= 0) { occurrence += 1; at = prefix.indexOf(quote, at + 1); }
    ctx.openRight('comments');
    const values = await ctx.ask({ title: 'Nuevo comentario', description: members().length ? `Menciona con @Nombre: ${members().map((member) => `@${member.name}`).join(', ')}` : '', fields: [{ name: 'text', label: `Sobre: “${quote.slice(0, 80)}”`, type: 'textarea', rows: 4, value: '' }], submitLabel: 'Comentar' });
    if (!values?.text?.trim()) return;
    const id = uid('c');
    const mentions = mentionIds(values.text);
    patchComments((list) => [...list, { id, quote, occurrence, authorId: ctx.user.id, authorName: ctx.user.name || ctx.user.username || 'Usuario', text: values.text.trim(), createdAt: new Date().toISOString(), resolved: false, replies: [], mentions }]);
    ctx.setActiveComment(id);
    notifyMentions(mentions, values.text);
  };
  actions.replyComment = (id, text) => {
    const mentions = mentionIds(text);
    patchComments((list) => list.map((comment) => (comment.id === id ? { ...comment, replies: [...(comment.replies || []), { id: uid('r'), authorId: ctx.user.id, authorName: ctx.user.name || ctx.user.username, text, createdAt: new Date().toISOString(), mentions }] } : comment)));
    notifyMentions(mentions, text);
  };
  actions.editComment = (id, text, replyId) => patchComments((list) => list.map((comment) => {
    if (comment.id !== id) return comment;
    if (!replyId) return { ...comment, text, editedAt: new Date().toISOString() };
    return { ...comment, replies: comment.replies.map((reply) => (reply.id === replyId ? { ...reply, text, editedAt: new Date().toISOString() } : reply)) };
  }));
  actions.deleteComment = (id, replyId) => patchComments((list) => (replyId ? list.map((comment) => (comment.id === id ? { ...comment, replies: comment.replies.filter((reply) => reply.id !== replyId) } : comment)) : list.filter((comment) => comment.id !== id)));
  actions.resolveComment = (id, resolved) => patchComments((list) => list.map((comment) => (comment.id === id ? { ...comment, resolved, resolvedBy: resolved ? ctx.user.name : null } : comment)));
  actions.deleteResolved = () => patchComments((list) => list.filter((comment) => !comment.resolved));
  actions.navComment = (direction) => {
    const marks = [...new Map([...D().querySelectorAll('mark.wd-cmark')].map((mark) => [mark.dataset.commentId, mark])).values()];
    if (!marks.length) return toast.info('No hay comentarios abiertos.');
    const active = marks.findIndex((mark) => mark.classList.contains('is-active'));
    const next = marks[((active < 0 ? (direction > 0 ? -1 : 0) : active) + direction + marks.length) % marks.length];
    next.scrollIntoView({ behavior: 'smooth', block: 'center' });
    ctx.setActiveComment(next.dataset.commentId);
    ctx.openRight('comments');
  };
  actions.focusComment = (id) => {
    const mark = D().querySelector(`mark.wd-cmark[data-comment-id="${id}"]`);
    mark?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    ctx.setActiveComment(id);
  };

  // ---------- Control de cambios ----------
  actions.toggleTracking = () => {
    const current = doc();
    if (current.protection.mode === 'tracked' && !ctx.owner) return toast.info('El propietario exige control de cambios en este documento.');
    ctx.patchDoc({ tracking: !current.tracking }, { noReflow: true });
    toast.success(!current.tracking ? 'Control de cambios activado: se registran inserciones, eliminaciones y formato.' : 'Control de cambios desactivado.');
  };
  const changeNear = (direction = 1) => {
    const root = D();
    const marks = allChanges(root);
    if (!marks.length) return null;
    const range = rangeIn(root) || savedRange();
    const here = changeAt(range?.startContainer);
    if (here) return here;
    if (!range) return marks[0];
    const after = marks.filter((mark) => range.comparePoint(mark, 0) > 0);
    return direction > 0 ? after[0] || marks[0] : marks.filter((mark) => range.comparePoint(mark, 0) < 0).pop() || marks[marks.length - 1];
  };
  const reveal = (mark) => {
    if (!mark) return toast.info('No hay más cambios.');
    mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const r = document.createRange();
    r.selectNodeContents(mark);
    document.getSelection().removeAllRanges();
    document.getSelection().addRange(r);
    rememberSelection(D());
    return mark;
  };
  actions.acceptChange = (mark) => {
    const target = mark || changeNear(1);
    if (!target) return toast.info('No hay cambios pendientes.');
    acceptChange(target);
    ctx.change();
    if (!mark) reveal(changeNear(1));
  };
  actions.rejectChange = (mark) => {
    const target = mark || changeNear(1);
    if (!target) return toast.info('No hay cambios pendientes.');
    rejectChange(target);
    ctx.change();
    if (!mark) reveal(changeNear(1));
  };
  actions.navChange = (direction) => {
    const root = D();
    const marks = allChanges(root);
    if (!marks.length) return toast.info('No hay cambios.');
    const range = rangeIn(root) || savedRange();
    const current = changeAt(range?.startContainer);
    const index = current ? marks.indexOf(current) : -1;
    reveal(marks[(index + direction + marks.length) % marks.length] || marks[0]);
  };
  actions.acceptAll = () => { allChanges(D()).forEach(acceptChange); ctx.change(); toast.success('Todos los cambios aceptados.'); };
  actions.rejectAll = () => { allChanges(D()).forEach(rejectChange); ctx.change(); toast.success('Todos los cambios rechazados.'); };
  const pickOtherHtml = async (title) => {
    const list = await portfolioRepository.list(ctx.user.id);
    const versions = await portfolioRepository.versions(ctx.hojaId, ctx.user.id).catch(() => []);
    const items = [
      { id: 'file', label: 'Archivo del equipo (DOCX, ODT, PDF, HTML, Markdown…)', hint: 'Importar', value: { type: 'file' } },
      ...versions.slice(0, 20).map((version) => ({ id: `v${version.id}`, label: `Versión ${version.label ? `“${version.label}” · ` : ''}${new Date(version.createdAt).toLocaleString('es')}`, hint: version.authorName, value: { type: 'version', id: version.id } })),
      ...list.filter((item) => item.id !== Number(ctx.hojaId) && !item.deleted).map((item) => ({ id: `d${item.id}`, label: item.name, hint: 'Documento', value: { type: 'doc', id: item.id, name: item.name } })),
    ];
    const picked = await choose(title, items);
    if (!picked) return null;
    const { value } = picked;
    if (value.type === 'file') {
      const file = await ctx.pick('.docx,.doc,.odt,.rtf,.txt,.html,.htm,.md,.pdf');
      return file ? { name: file.name, html: await importAnyFile(file) } : null;
    }
    if (value.type === 'version') {
      const version = await portfolioRepository.version(ctx.hojaId, value.id, ctx.user.id);
      return { name: picked.label, html: (parseDocument(version.document).doc?.pages || []).map((page) => page.html).join('') };
    }
    const other = await portfolioRepository.get(value.id, ctx.user.id);
    const parsed = parseDocument(other.document);
    if (!parsed.doc) throw new Error('Ese elemento no es un documento de texto.');
    return { name: value.name, html: parsed.doc.pages.map((page) => page.html).join('') };
  };
  actions.compare = async () => {
    const other = await pickOtherHtml('Comparar con…');
    if (!other) return;
    const current = exportHtml(ctx.readModel().pages.map((page) => page.html));
    const diff = compareHtml(exportHtml([other.html]), current, ctx.user.name || 'Comparación');
    ctx.setView({ compare: { name: `Comparación: ${other.name} → este documento`, html: sanitizeHtml(diff) }, split: false });
    toast.success('Comparación lista en el panel derecho (inserciones en verde, eliminaciones tachadas).');
  };
  actions.combine = async () => {
    if (!editable()) return;
    const other = await pickOtherHtml('Combinar revisiones de…');
    if (!other) return;
    const current = exportHtml(ctx.readModel().pages.map((page) => page.html));
    const merged = compareHtml(current, exportHtml([other.html]), other.name);
    ctx.applyModel({ ...doc(), tracking: true, pages: [{ id: createId(), html: merged }] });
    ctx.change();
    toast.success('Revisiones combinadas como cambios controlados. Acéptalos o recházalos uno a uno.');
  };

  // ---------- Protección y colaboración ----------
  actions.protect = (mode) => {
    if (!ctx.owner) return toast.info('Solo el propietario puede restringir la edición.');
    ctx.patchDoc({ protection: { mode, by: ctx.user.name, at: new Date().toISOString() }, ...(mode === 'tracked' ? { tracking: true } : {}) }, { noReflow: true });
    ctx.setFinalOverride(false);
    toast.success({ none: 'Restricciones quitadas.', readonly: 'Ahora es de solo lectura para los demás.', comments: 'Los demás solo pueden comentar.', tracked: 'Los cambios de los demás quedarán como sugerencias.', final: 'Marcado como final.' }[mode]);
  };
  actions.permissions = () => ctx.dialog('Permisos por persona', ({ close }) => h(PermissionEditor, { hojaId: ctx.hojaId, user: ctx.user, close }), 'max-w-xl');
  actions.lockDoc = () => {
    const lock = doc().lock;
    if (lock && String(lock.id) !== String(ctx.user.id) && !ctx.owner) return toast.info(`Solo ${lock.name} o el propietario pueden desbloquearlo.`);
    ctx.patchDoc({ lock: lock ? null : { id: ctx.user.id, name: ctx.user.name || ctx.user.username, at: new Date().toISOString() } }, { noReflow: true });
    toast.success(lock ? 'Documento desbloqueado.' : 'Documento bloqueado: los demás solo pueden leer.');
  };
  actions.lockSection = () => {
    if (!editable()) return;
    restoreSelection(D());
    const blocks = selectedBlocks(D()).map((node) => node.closest('[data-page-body] > *')).filter((node, index, list) => node && list.indexOf(node) === index);
    if (!blocks.length) return toast.info('Selecciona los párrafos a bloquear.');
    const wrap = document.createElement('div');
    wrap.className = 'wd-locked';
    wrap.contentEditable = 'false';
    wrap.dataset.lockedBy = ctx.user.name || ctx.user.username;
    wrap.dataset.lockedId = String(ctx.user.id);
    blocks[0].before(wrap);
    wrap.append(...blocks);
    ctx.change();
  };
  actions.unlockSection = () => {
    if (!editable()) return;
    const mine = [...D().querySelectorAll('div.wd-locked')].filter((node) => ctx.owner || node.dataset.lockedId === String(ctx.user.id));
    if (!mine.length) return toast.info('No hay secciones bloqueadas por ti.');
    mine.forEach((node) => node.replaceWith(...node.childNodes));
    ctx.change();
    toast.success(`${mine.length} secciones desbloqueadas.`);
  };
  actions.resolveConflict = async () => {
    const server = await portfolioRepository.get(ctx.hojaId, ctx.user.id);
    const theirs = parseDocument(server.document).doc;
    if (!theirs) return;
    const mine = ctx.readModel();
    const base = ctx.base();
    const join = (model) => model.pages.map((page) => page.html).join('');
    ctx.setRevision(server.revision);
    const mergedComments = [...new Map([...theirs.comments, ...mine.comments].map((comment) => [comment.id, comment])).values()];
    const { merged, conflicts } = merge3(join(base), join(mine), join(theirs));
    if (!conflicts) {
      ctx.applyModel({ ...mine, comments: mergedComments, pages: [{ id: createId(), html: merged }] }, { caret: caretPosition(D()) });
      ctx.setBase(theirs);
      ctx.change();
      toast.success('Tus cambios se combinaron con los de otra persona.');
      return;
    }
    const choice = await choose('Otra persona editó las mismas partes', [
      { id: 'tracked', label: 'Combinar: ver sus cambios como sugerencias sobre los míos', hint: 'Recomendado', value: 'tracked' },
      { id: 'mine', label: 'Conservar mi versión (sobrescribe la suya)', value: 'mine' },
      { id: 'theirs', label: 'Usar la versión del servidor (descarta lo mío)', value: 'theirs' },
    ]);
    const option = choice?.value || 'tracked';
    ctx.setBase(theirs);
    if (option === 'theirs') ctx.applyModel(theirs);
    else if (option === 'tracked') {
      ctx.applyModel({ ...mine, comments: mergedComments, tracking: true, pages: [{ id: createId(), html: compareHtml(join(mine), join(theirs), 'Servidor') }] });
      ctx.change();
    } else ctx.change();
  };

  // ---------- Vista ----------
  actions.fullscreen = () => {
    const root = ctx.rootEl();
    if (document.fullscreenElement) document.exitFullscreen?.();
    else root?.requestFullscreen?.().catch(() => toast.error('Pantalla completa no disponible.'));
  };
  actions.zoom = (delta) => ctx.setView({ zoom: Math.min(3, Math.max(0.2, Math.round((ctx.view().zoom + delta) * 100) / 100)), fit: null });
  actions.zoomCustom = async () => {
    const values = await ctx.ask({ title: 'Zoom', fields: [{ name: 'zoom', label: 'Porcentaje', type: 'number', value: Math.round(ctx.view().zoom * 100), min: 20, max: 300 }] });
    if (values) ctx.setView({ zoom: Number(values.zoom) / 100, fit: null });
  };
  actions.newWindow = () => window.open(window.location.href, '_blank', 'noopener');
  actions.arrangeWindows = () => {
    const w = Math.round(window.screen.availWidth / 2);
    const win = window.open(window.location.href, '_blank', `width=${w},height=${window.screen.availHeight},left=${w},top=0`);
    if (!win) toast.error('Permite ventanas emergentes para organizar ventanas.');
    else toast.info('Se abrió una segunda ventana en la mitad derecha de la pantalla.');
  };
  actions.sideBySide = async () => {
    if (ctx.view().compare) return ctx.setView({ compare: null });
    const list = (await portfolioRepository.list(ctx.user.id)).filter((item) => item.id !== Number(ctx.hojaId) && !item.deleted);
    const picked = await choose('Ver en paralelo con…', list.map((item) => ({ id: item.id, label: item.name, hint: item.projectName || '', value: item })));
    if (!picked) return;
    const other = await portfolioRepository.get(picked.value.id, ctx.user.id);
    const parsed = parseDocument(other.document);
    if (!parsed.doc) return toast.error('Ese elemento no es un documento de texto.');
    ctx.setView({ compare: { name: picked.value.name, html: sanitizeHtml(parsed.doc.pages.map((page) => page.html).join('<hr class="wd-break">')) }, split: false, syncScroll: true });
  };
  actions.switchDoc = async () => {
    const list = (await portfolioRepository.list(ctx.user.id)).filter((item) => !item.deleted);
    const picked = await choose('Cambiar de documento', list.map((item) => ({ id: item.id, label: item.name, hint: item.projectName || '', value: item })));
    if (picked) ctx.navigate(`/portafolio/${picked.value.id}`);
  };

  // ---------- Archivo ----------
  actions.print = async (options = {}) => {
    const current = doc();
    const metrics = pageMetrics(current);
    const pages = [...D().querySelectorAll('.wd-page')];
    const wanted = new Set();
    if (options.range === 'current') wanted.add(Math.max(0, (Number(document.querySelector('.wd-status button')?.textContent.match(/\d+/)?.[0]) || 1) - 1));
    else if (options.range === 'custom' && options.pages) {
      options.pages.split(',').forEach((part) => {
        const [a, b] = part.split('-').map((value) => Number(value.trim()));
        for (let n = a; n <= (b || a); n += 1) if (n >= 1) wanted.add(n - 1);
      });
    }
    pages.forEach((page, index) => page.classList.toggle('wd-print-skip', wanted.size > 0 && !wanted.has(index)));
    const landscape = options.orientation ? options.orientation === 'landscape' : metrics.width > metrics.height;
    const style = document.createElement('style');
    style.id = 'wd-print-style';
    style.textContent = `@page{size:${landscape ? Math.max(metrics.width, metrics.height) : Math.min(metrics.width, metrics.height)}px ${landscape ? Math.min(metrics.width, metrics.height) : Math.max(metrics.width, metrics.height)}px;margin:${options.margin ?? 0}px}.wd-stack{zoom:${(options.scale || 100) / 100} !important}`;
    document.head.append(style);
    const previousTitle = document.title;
    document.title = ctx.name || 'Documento';
    if (options.selection) document.body.classList.add('wd-print-selection');
    window.print();
    setTimeout(() => {
      style.remove();
      document.title = previousTitle;
      document.body.classList.remove('wd-print-selection');
      pages.forEach((page) => page.classList.remove('wd-print-skip'));
    }, 600);
  };
  actions.exportAs = async (format, options = {}) => {
    const model = ctx.readModel();
    let pagesHtml = model.pages.map((page) => page.html);
    let pageNodes = [...D().querySelectorAll('.wd-page')];
    if (options.scope === 'selection') {
      const html = selectionHtml();
      if (!html) return toast.info('Selecciona el contenido a exportar.');
      pagesHtml = [html];
    } else if (options.scope === 'pages' && options.pages) {
      const wanted = new Set();
      options.pages.split(',').forEach((part) => {
        const [a, b] = part.split('-').map((value) => Number(value.trim()));
        for (let n = a; n <= (b || a); n += 1) if (n >= 1) wanted.add(n - 1);
      });
      pagesHtml = pagesHtml.filter((_, index) => wanted.has(index));
      pageNodes = pageNodes.filter((_, index) => wanted.has(index));
    }
    if (format === 'pdf' && options.scope === 'selection') {
      const holder = document.createElement('article');
      holder.className = 'wd-page';
      holder.innerHTML = `<div class="wd-body">${pagesHtml[0]}</div>`;
      pageNodes = [holder];
    }
    toast.info('Generando archivo…');
    await exportDocument(format, { pagesHtml, pageNodes, doc: model, title: ctx.name });
    toast.success('Archivo exportado.');
  };
  actions.importFile = async (file, mode = 'insert') => {
    toast.info(`Importando ${file.name}…`);
    const html = await importAnyFile(file);
    if (mode === 'new') {
      const created = await createDoc(file.name.replace(/\.[^.]+$/, ''), html);
      return ctx.navigate(`/portafolio/${created.id}`);
    }
    if (!editable()) return undefined;
    if (mode === 'replace') ctx.applyModel({ ...doc(), pages: [{ id: createId(), html }] });
    else block(html);
    ctx.change();
    toast.success('Archivo importado.');
    return undefined;
  };
  actions.createFromTemplate = async (templateId, name) => {
    const template = templateDocument(templateId);
    const defaults = ctx.storage.get('defaultDocStyle', null);
    let document = template.document;
    if (defaults && templateId.startsWith('doc')) {
      const parsed = JSON.parse(document);
      parsed.doc = { ...parsed.doc, ...defaults };
      document = JSON.stringify(parsed);
    }
    const created = await portfolioRepository.create({ userId: ctx.user.id, name: name || template.name, projectId: ctx.meta?.projectId || null, document });
    ctx.navigate(`/portafolio/${created.id}`);
  };
  actions.saveAsTemplate = async () => {
    const values = await ctx.ask({ title: 'Guardar como plantilla personalizada', fields: [{ name: 'name', label: 'Nombre de la plantilla', value: ctx.name }] });
    if (!values?.name) return;
    const model = ctx.readModel();
    ctx.storage.set('templates', [...ctx.storage.get('templates', []), { id: uid('tpl'), name: values.name, createdAt: new Date().toISOString(), doc: { ...model, comments: [], ink: {}, lock: null } }]);
    toast.success('Plantilla guardada. Aparecerá en Archivo › Nuevo.');
  };
  actions.createFromCustomTemplate = async (template) => {
    const created = await portfolioRepository.create({ userId: ctx.user.id, name: template.name, projectId: ctx.meta?.projectId || null, document: serializeDocument({ kind: 'document', doc: template.doc }) });
    ctx.navigate(`/portafolio/${created.id}`);
  };
  actions.saveAs = async (name, projectId) => {
    await ctx.save();
    const model = ctx.readModel();
    const created = await portfolioRepository.create({ userId: ctx.user.id, name: name || `${ctx.name} (copia)`, projectId: projectId ?? ctx.meta?.projectId ?? null, document: serializeDocument({ kind: 'document', doc: model }) });
    return created;
  };
  actions.namedVersion = async () => {
    const values = await ctx.ask({ title: 'Crear versión con nombre', fields: [{ name: 'label', label: 'Nombre de la versión', value: '' }] });
    if (!values) return;
    await ctx.save();
    await portfolioRepository.createVersion(ctx.hojaId, ctx.user.id, values.label);
    toast.success('Versión guardada en el historial.');
  };
  actions.restoreVersion = async (versionId) => {
    const saved = await portfolioRepository.restoreVersion(ctx.hojaId, versionId, ctx.user.id);
    const parsed = parseDocument(saved.document);
    ctx.setRevision(saved.revision);
    ctx.setBase(parsed.doc);
    ctx.applyModel(parsed.doc);
    toast.success('Versión restaurada.');
  };
  actions.previewVersion = async (versionId, label) => {
    const version = await portfolioRepository.version(ctx.hojaId, versionId, ctx.user.id);
    const parsed = parseDocument(version.document);
    ctx.setView({ compare: { name: label || 'Versión anterior', html: sanitizeHtml((parsed.doc?.pages || []).map((page) => page.html).join('<hr class="wd-break">')) }, split: false });
  };
  actions.shortcuts = () => ctx.dialog('Atajos de teclado', () => h('table', { className: 'wd-stats' }, h('tbody', null, [
    ['⌘/Ctrl + S', 'Guardar'], ['⌘/Ctrl + Z / ⇧Z / Y', 'Deshacer / Rehacer'], ['⌘/Ctrl + B / I / U', 'Negrita / Cursiva / Subrayado'], ['⌘/Ctrl + K', 'Hipervínculo'],
    ['⌘/Ctrl + F / H / G', 'Buscar / Reemplazar / Ir a'], ['⌘/Ctrl + P', 'Imprimir'], ['⌘/Ctrl + Enter', 'Salto de página'], ['⌘/Ctrl + ⇧ + Enter', 'Salto de columna'],
    ['⌘/Ctrl + Alt + 1…6 / 0', 'Encabezado 1…6 / Normal'], ['⌘/Ctrl + ⇧ + 7 / 8', 'Lista numerada / viñetas'], ['⌘/Ctrl + L / E / R / J', 'Alinear izquierda / centro / derecha / justificar'],
    ['⌘/Ctrl + ] / [', 'Aumentar / disminuir fuente'], ['⌘/Ctrl + , / .', 'Subíndice / superíndice'], ['⌘/Ctrl + D', 'Fuente avanzada'], ['⌘/Ctrl + ⇧ + C / V', 'Copiar / pegar formato'],
    ['⌘/Ctrl + ⇧ + V', 'Pegar sin formato'], ['⌘/Ctrl + Alt + M', 'Comentario'], ['⌘/Ctrl + Alt + F', 'Nota al pie'], ['⌘/Ctrl + *', 'Marcas de formato'], ['Tab / ⇧Tab', 'Sangría de lista o siguiente celda'],
    ['/', 'Menú de bloques'], ['@', 'Mencionar usuario, issue o sprint'], ['Supr', 'Eliminar objeto seleccionado'], ['Flechas', 'Mover objeto con posición fija (⇧ = 10 px)'],
  ].map(([keys, label]) => h('tr', { key: keys }, h('th', null, h('kbd', null, keys)), h('td', null, label)))))) ;

  // ---------- IA ----------
  actions.aiRun = async (action, { scope = 'selection', instruction = '', context = '' } = {}) => {
    const text = scope === 'document' ? docText() : (selectionText().trim() ? selectionHtml() : docText());
    return ctx.ai(action, { text: text.slice(0, 24000), instruction, context });
  };
  actions.aiInsert = (html, replace = false) => {
    if (!editable()) return;
    restoreSelection(D());
    const clean = /<[a-z][\s\S]*>/i.test(html) ? sanitizeHtml(html) : textToHtml(html);
    if (replace && selectionText().trim()) insertHtml(D(), clean);
    else insertBlockHtml(D(), clean);
    ctx.change();
  };
  actions.aiExtract = async (kind) => {
    toast.info('Analizando el documento…');
    const result = parseJson(await ctx.ai(kind === 'issues' ? 'issues' : kind, { text: docText().slice(0, 24000) }));
    const items = result?.items || [];
    if (!items.length) return toast.info('No se encontraron elementos.');
    const picked = await ctx.dialog({ issues: 'Issues sugeridos', tasks: 'Tareas detectadas', commitments: 'Compromisos', decisions: 'Decisiones' }[kind] || 'Resultados', ({ close }) => h(ExtractList, { items, kind, close }), 'max-w-2xl');
    if (!picked) return;
    if (picked.action === 'issues') {
      const data = await needProject();
      if (!data) return;
      for (const item of picked.items) {
        await issuesRepository.create({ projectId: data.projectId, title: item.title.slice(0, 200), description: item.detail || item.title, status: 'todo', priority: 'Medium', assigneeIds: data.members.filter((member) => item.owner && member.name.toLowerCase().includes(item.owner.toLowerCase())).map((member) => member.userId) });
      }
      await ctx.refreshProject(true);
      toast.success(`${picked.items.length} issues creados en el proyecto.`);
    } else if (ctx.editable()) {
      block(`<ul class="wd-checklist">${picked.items.map((item) => `<li data-checked="false">${escapeHtml(item.title)}${item.owner ? ` — <em>${escapeHtml(item.owner)}</em>` : ''}${item.due ? ` · ${escapeHtml(item.due)}` : ''}</li>`).join('')}</ul>`);
    }
  };
  actions.aiSearchDocs = async (question) => {
    const words = wordsOf(question).filter((word) => word.length > 3).slice(0, 4);
    const found = new Map();
    for (const word of words.length ? words : [question]) {
      (await portfolioRepository.search(ctx.user.id, word)).forEach((item) => found.set(item.id, item));
    }
    const docs = [...found.values()].slice(0, 6);
    if (!docs.length) return { html: '<p>No encontré documentos relacionados.</p>', docs };
    const answer = await ctx.ai('search', { text: question, context: docs.map((item) => `# ${item.name}\n${item.text}`).join('\n\n').slice(0, 22000) });
    return { html: answer, docs };
  };
  actions.aiLinkIssues = async () => {
    const data = await needProject();
    if (!data) return [];
    const result = parseJson(await ctx.ai('link-issues', { text: docText().slice(0, 12000), context: data.issues.map((issue) => `#${issue.id} ${issue.title} (${issue.status})`).join('\n').slice(0, 10000) }));
    return (result?.items || []).map((item) => ({ ...item, issue: data.issues.find((issue) => String(issue.id) === String(item.id)) })).filter((item) => item.issue);
  };
  actions.insertIssueRef = (issue) => { if (editable()) insert(refHtml('issue', issue, ctx.project())); };

  // ---------- Menú contextual ----------
  actions.contextItems = (target, icons) => {
    const items = [];
    const obj = target.closest('figure.wd-obj, [data-page-body] img');
    const cell = target.closest('td, th');
    if (obj) {
      ctx.selectObject(obj.parentElement?.closest('figure.wd-group') || obj);
      items.push({ label: 'Editar objeto', icon: icons.Type, run: () => actions.editObject(obj) });
      items.push({ label: 'Delante del texto', run: () => actions.wrap('front') }, { label: 'En línea con el texto', run: () => actions.wrap('inline') }, { label: 'Ajuste cuadrado', run: () => actions.wrap('square') });
      items.push({ label: 'Traer al frente', run: () => actions.zorder('front') }, { label: 'Enviar al fondo', run: () => actions.zorder('back') });
      if (obj.tagName === 'IMG' || obj.dataset.kind === 'image') items.push({ label: 'Texto alternativo…', run: () => actions.altText() }, { label: 'Recortar…', run: () => actions.crop() });
      items.push({ label: 'Insertar título…', run: () => actions.caption('Figura') });
      items.push('-', { label: 'Eliminar', icon: icons.Trash2, run: () => actions.deleteObject() });
      return items;
    }
    items.push({ label: 'Cortar', icon: icons.Scissors, hint: '⌘X', run: () => actions.cut(), disabled: !ctx.editable() });
    items.push({ label: 'Copiar', icon: icons.Copy, hint: '⌘C', run: () => actions.copy() });
    items.push({ label: 'Pegar', icon: icons.ClipboardPaste, hint: '⌘V', run: () => actions.paste(), disabled: !ctx.editable() });
    items.push({ label: 'Pegar sin formato', hint: '⌘⇧V', run: () => actions.pastePlain(), disabled: !ctx.editable() });
    items.push('-');
    if (cell) {
      items.push({ label: 'Insertar fila arriba', run: () => actions.tableOp('rowAbove') }, { label: 'Insertar fila debajo', run: () => actions.tableOp('rowBelow') }, { label: 'Insertar columna a la derecha', run: () => actions.tableOp('colRight') });
      items.push({ label: 'Eliminar fila', run: () => actions.tableOp('deleteRow') }, { label: 'Eliminar columna', run: () => actions.tableOp('deleteCol') }, { label: 'Combinar celdas', run: () => actions.tableOp('merge') }, '-');
    }
    items.push({ label: 'Nuevo comentario', icon: icons.MessageSquarePlus, hint: '⌘⌥M', run: () => actions.comment(), disabled: !ctx.canComment });
    items.push({ label: 'Hipervínculo…', icon: icons.Link2, hint: '⌘K', run: () => actions.link(), disabled: !ctx.editable() });
    items.push({ label: 'Sinónimos', icon: icons.BookA, run: () => actions.synonyms() });
    items.push({ label: 'Traducir selección al inglés', icon: icons.Languages, run: () => actions.translate('selection', 'Inglés') });
    items.push({ label: 'Convertir en issue', icon: icons.ListPlus, run: () => actions.textToIssue() });
    items.push({ label: 'Mejorar redacción (IA)', icon: icons.Sparkles, run: () => ctx.openRight('ai') });
    items.push('-', { label: 'Seleccionar todo', icon: icons.TextSelect, hint: '⌘A', run: () => actions.selectAll() });
    items.push({ label: 'Párrafo…', run: () => actions.paragraphDialog(), disabled: !ctx.editable() });
    return items;
  };

  return actions;
}

// ---------- Componentes auxiliares de diálogo ----------

function Picker({ items, close, render, empty }) {
  const [query, setQuery] = useStateShim('');
  const filtered = items.filter((item) => !query || `${item.label} ${item.hint || ''}`.toLowerCase().includes(query.toLowerCase()));
  return h('div', { className: 'wd-picker' },
    items.length > 6 && h('input', { className: 'wd-input', autoFocus: true, placeholder: 'Buscar…', value: query, onChange: (event) => setQuery(event.target.value) }),
    h('div', { className: 'wd-list' }, filtered.length ? filtered.map((item) => h('button', { key: item.id, type: 'button', className: 'wd-item', onClick: () => close(item) }, render ? render(item) : [h('span', { key: 'l', className: 'wd-item-label' }, item.label), item.hint && h('small', { key: 'h' }, item.hint)])) : h('p', { className: 'wd-muted' }, empty)),
    h('div', { className: 'wd-dialog-actions' }, h('button', { type: 'button', className: 'ps-quiet', onClick: () => close(null) }, 'Cerrar')));
}

function LibraryPicker({ onPick, close }) {
  const [query, setQuery] = useStateShim('');
  const [items, setItems] = useStateShim([]);
  const [busy, setBusy] = useStateShim(false);
  const search = async (event) => {
    event?.preventDefault();
    setBusy(true);
    try {
      setItems(await searchCommons(query || 'naturaleza', 'image'));
    } finally {
      setBusy(false);
    }
  };
  return h('div', null,
    h('form', { className: 'wd-row', onSubmit: search }, h('input', { className: 'wd-input', autoFocus: true, placeholder: 'Buscar imágenes libres (CC0, CC BY)…', value: query, onChange: (event) => setQuery(event.target.value) }), h('button', { type: 'submit', className: 'wd-primary' }, busy ? 'Buscando…' : 'Buscar')),
    h('div', { className: 'wd-image-grid' }, items.map((item) => h('button', { key: item.src, type: 'button', title: item.credit, onClick: () => onPick(item) }, h('img', { src: item.src, alt: item.title, loading: 'lazy' })))),
    h('div', { className: 'wd-dialog-actions' }, h('button', { type: 'button', className: 'ps-quiet', onClick: () => close(null) }, 'Cerrar')));
}

function IconPicker({ library, onPick, close }) {
  const [query, setQuery] = useStateShim('');
  const [color, setColor] = useStateShim('#2f6f5e');
  const names = library.listIcons(query);
  return h('div', null,
    h('div', { className: 'wd-row' }, h('input', { className: 'wd-input', autoFocus: true, placeholder: 'Buscar iconos (equipo, cohete, calendario…)', value: query, onChange: (event) => setQuery(event.target.value) }), h('input', { type: 'color', value: color, 'aria-label': 'Color', onChange: (event) => setColor(event.target.value) })),
    h('div', { className: 'wd-icon-grid', style: { color } }, names.map((name) => h('button', { key: name, type: 'button', title: name, 'aria-label': name, onClick: () => onPick(name, color), dangerouslySetInnerHTML: { __html: library.iconSvg(name) } }))),
    h('div', { className: 'wd-dialog-actions' }, h('button', { type: 'button', className: 'ps-quiet', onClick: () => close(null) }, 'Cerrar')));
}

function QuickParts({ storage, onInsert, close }) {
  const [parts, setParts] = useStateShim(storage.get('quickParts', []));
  const remove = (id) => { const next = parts.filter((part) => part.id !== id); setParts(next); storage.set('quickParts', next); };
  return h('div', null,
    parts.length ? h('div', { className: 'wd-list' }, parts.map((part) => h('div', { key: part.id, className: 'wd-list-row' }, h('button', { type: 'button', className: 'wd-item', onClick: () => onInsert(part.html) }, part.name), h('button', { type: 'button', className: 'ps-quiet', onClick: () => remove(part.id) }, 'Eliminar')))) : h('p', { className: 'wd-muted' }, 'Selecciona contenido y usa “Guardar selección como texto reutilizable”.'),
    h('div', { className: 'wd-dialog-actions' }, h('button', { type: 'button', className: 'ps-quiet', onClick: () => close(null) }, 'Cerrar')));
}

function StyleManager({ styles, onChange, close }) {
  const [list, setList] = useStateShim(styles);
  const update = (next) => { setList(next); onChange(next); };
  return h('div', null,
    list.length ? h('div', { className: 'wd-list' }, list.map((style) => h('div', { key: style.id, className: 'wd-list-row' },
      h('input', { className: 'wd-input', value: style.name, 'aria-label': 'Nombre', onChange: (event) => update(list.map((item) => (item.id === style.id ? { ...item, name: event.target.value } : item))) }),
      h('button', { type: 'button', className: 'ps-quiet', onClick: () => update(list.filter((item) => item.id !== style.id)) }, 'Eliminar')))) : h('p', { className: 'wd-muted' }, 'No hay estilos personalizados.'),
    h('div', { className: 'wd-dialog-actions' }, h('button', { type: 'button', className: 'wd-primary', onClick: () => close(true) }, 'Listo')));
}

function SourceManager({ sources, ask, onChange, close }) {
  const [list, setList] = useStateShim(sources);
  const save = (next) => { setList(next); onChange(next); };
  const edit = async (source) => {
    const values = await ask({ title: source ? 'Editar fuente' : 'Crear fuente', width: 'max-w-2xl', fields: SOURCE_FIELDS.map((field) => ({ ...field, value: source?.[field.name] ?? (field.name === 'type' ? 'book' : '') })) });
    if (!values?.title) return;
    save(source ? list.map((item) => (item.id === source.id ? { ...item, ...values } : item)) : [...list, { ...values, id: uid('src') }]);
  };
  return h('div', null,
    h('div', { className: 'wd-list' }, list.length ? list.map((source) => h('div', { key: source.id, className: 'wd-list-row' },
      h('span', { className: 'wd-item-label' }, h('b', null, source.title), h('small', null, `${source.author || 'Sin autor'} · ${source.year || 's.f.'}`)),
      h('button', { type: 'button', className: 'ps-quiet', onClick: () => edit(source) }, 'Editar'),
      h('button', { type: 'button', className: 'ps-quiet', onClick: () => save(list.filter((item) => item.id !== source.id)) }, 'Eliminar'))) : h('p', { className: 'wd-muted' }, 'Aún no hay fuentes.')),
    h('div', { className: 'wd-dialog-actions' }, h('button', { type: 'button', className: 'ps-quiet', onClick: () => edit(null) }, 'Nueva fuente'), h('button', { type: 'button', className: 'wd-primary', onClick: () => close(true) }, 'Listo')));
}

function SelectionPane({ desk, onSelect, onChange, close }) {
  const [, setTick] = useStateShim(0);
  const objects = [...desk.querySelectorAll('[data-page-body] figure.wd-obj, [data-page-body] img')].filter((el) => !el.parentElement.closest('figure.wd-group'));
  const name = (el) => (el.tagName === 'IMG' ? `Imagen ${el.alt || ''}` : `${{ shape: 'Forma', chart: 'Gráfico', diagram: 'SmartArt', textbox: 'Cuadro de texto', wordart: 'Texto decorado', icon: 'Icono', group: 'Grupo', signature: 'Firma', image: 'Imagen' }[el.dataset.kind] || 'Objeto'}${el.dataset.kind === 'shape' ? ` · ${SHAPES[readSpec(el).type]?.label || ''}` : ''}`);
  return h('div', null,
    objects.length ? h('div', { className: 'wd-list' }, objects.map((el, index) => h('div', { key: index, className: 'wd-list-row' },
      h('button', { type: 'button', className: 'wd-item', onClick: () => { onSelect(el); close(); } }, `${index + 1}. ${name(el)}`),
      h('button', { type: 'button', className: 'ps-quiet', onClick: () => { el.style.visibility = el.style.visibility === 'hidden' ? '' : 'hidden'; onChange(); setTick((value) => value + 1); } }, el.style.visibility === 'hidden' ? 'Mostrar' : 'Ocultar')))) : h('p', { className: 'wd-muted' }, 'No hay objetos en el documento.'),
    h('div', { className: 'wd-dialog-actions' }, h('button', { type: 'button', className: 'ps-quiet', onClick: () => close(null) }, 'Cerrar')));
}

function LinkEditor({ data, links, close }) {
  const [state, setState] = useStateShim(links);
  const toggle = (key, id) => setState((current) => ({ ...current, [key]: current[key].includes(id) ? current[key].filter((item) => item !== id) : [...current[key], id] }));
  const section = (title, key, items) => h('section', { className: 'wd-link-section' }, h('h3', null, title), items.length ? items.map(([id, label]) => h('label', { key: id, className: 'wd-field-inline' }, h('input', { type: 'checkbox', checked: state[key].includes(id), onChange: () => toggle(key, id) }), ` ${label}`)) : h('p', { className: 'wd-muted' }, 'Sin elementos'));
  return h('div', null,
    h('div', { className: 'wd-link-grid' },
      section('Sprints', 'sprintIds', data.sprints.map((sprint) => [sprint.id, sprint.name])),
      section('Issues', 'issueIds', data.issues.slice(0, 80).map((issue) => [issue.id, `#${issue.id} ${issue.title}`])),
      section('Usuarios', 'userIds', data.members.map((member) => [member.userId, member.name])),
      section('Reuniones', 'meetingIds', data.meetings.map((meeting) => [meeting.id, `${meeting.type || 'Reunión'} · ${meeting.date}`]))),
    h('div', { className: 'wd-dialog-actions' }, h('button', { type: 'button', className: 'ps-quiet', onClick: () => close(null) }, 'Cancelar'), h('button', { type: 'button', className: 'wd-primary', onClick: () => close(state) }, 'Guardar vínculos')));
}

function ExtractList({ items, kind, close }) {
  const [checked, setChecked] = useStateShim(items.map(() => true));
  const chosen = items.filter((_, index) => checked[index]);
  return h('div', null,
    h('div', { className: 'wd-list' }, items.map((item, index) => h('label', { key: index, className: 'wd-list-row wd-extract' },
      h('input', { type: 'checkbox', checked: checked[index], onChange: () => setChecked((current) => current.map((value, i) => (i === index ? !value : value))) }),
      h('span', { className: 'wd-item-label' }, h('b', null, item.title), h('small', null, [item.detail, item.owner && `Responsable: ${item.owner}`, item.due && `Fecha: ${item.due}`].filter(Boolean).join(' · ')))))),
    h('div', { className: 'wd-dialog-actions' },
      h('button', { type: 'button', className: 'ps-quiet', onClick: () => close(null) }, 'Cerrar'),
      h('button', { type: 'button', className: 'ps-quiet', disabled: !chosen.length, onClick: () => close({ action: 'insert', items: chosen }) }, 'Insertar como checklist'),
      (kind === 'issues' || kind === 'tasks' || kind === 'commitments') && h('button', { type: 'button', className: 'wd-primary', disabled: !chosen.length, onClick: () => close({ action: 'issues', items: chosen }) }, `Crear ${chosen.length} issues`)));
}

function PermissionEditor({ hojaId, user, close }) {
  const [access, setAccess] = useStateShim(null);
  const [email, setEmail] = useStateShim('');
  const [role, setRole] = useStateShim('editor');
  useEffectShim(() => { portfolioRepository.access(hojaId, user.id).then(setAccess).catch(() => setAccess({ invites: [], error: true })); }, [hojaId, user.id]);
  const update = async (patch) => setAccess(await portfolioRepository.updateAccess(hojaId, { userId: user.id, ...patch }));
  if (!access) return h('p', { className: 'wd-muted' }, 'Cargando…');
  if (access.error) return h('p', { className: 'wd-muted' }, 'Solo el propietario puede administrar permisos.');
  const roles = [['editor', 'Puede editar'], ['comentador', 'Puede comentar'], ['lector', 'Solo lectura']];
  return h('div', null,
    h('form', { className: 'wd-row', onSubmit: (event) => { event.preventDefault(); if (email.trim()) update({ addEmail: email.trim(), addRole: role }).then(() => setEmail('')); } },
      h('input', { className: 'wd-input', type: 'email', placeholder: 'correo@equipo.com', value: email, onChange: (event) => setEmail(event.target.value) }),
      h('select', { className: 'wd-input', value: role, onChange: (event) => setRole(event.target.value), 'aria-label': 'Permiso' }, roles.map(([value, label]) => h('option', { key: value, value }, label))),
      h('button', { type: 'submit', className: 'wd-primary' }, 'Invitar')),
    h('div', { className: 'wd-list' }, (access.invites || []).map((person) => h('div', { key: person.id, className: 'wd-list-row' },
      h('span', { className: 'wd-item-label' }, h('b', null, person.name || person.email), h('small', null, person.email)),
      h('select', { className: 'wd-input', value: person.role || 'editor', 'aria-label': `Permiso de ${person.name}`, onChange: (event) => update({ roleUserId: person.id, role: event.target.value }) }, roles.map(([value, label]) => h('option', { key: value, value }, label))),
      h('button', { type: 'button', className: 'ps-quiet', onClick: () => update({ removeUserId: person.id }) }, 'Quitar')))),
    h('p', { className: 'wd-muted' }, `Visibilidad: ${access.visibility === 'enlace' ? 'cualquiera con el enlace puede ver' : 'privada'}. El equipo del proyecto vinculado puede editar.`),
    h('div', { className: 'wd-dialog-actions' }, h('button', { type: 'button', className: 'wd-primary', onClick: () => close(true) }, 'Listo')));
}

export { issueUrl, INK_TOOLS };
