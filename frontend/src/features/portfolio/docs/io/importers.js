// Importación: DOCX, DOC, ODT, RTF, TXT, HTML, Markdown y PDF (por conversión de texto).

import { portfolioRepository } from '../../../../data/repositories/portfolioRepository';
import { cleanPastedHtml, escapeHtml, sanitizeHtml, textToHtml } from '../sanitize';

export const IMPORT_ACCEPT = '.docx,.doc,.odt,.rtf,.txt,.html,.htm,.md,.markdown,.pdf';

const ext = (name) => (name.split('.').pop() || '').toLowerCase();

async function fromDocx(file) {
  const mammoth = await import('mammoth');
  const result = await (mammoth.default || mammoth).convertToHtml({ arrayBuffer: await file.arrayBuffer() }, {
    styleMap: ["p[style-name='Title'] => h1.wd-style-title:fresh", "p[style-name='Subtitle'] => p.wd-style-subtitle:fresh", "p[style-name='Quote'] => blockquote:fresh"],
  });
  return result.value;
}

async function fromOdt(file) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = new DOMParser().parseFromString(await zip.file('content.xml').async('string'), 'application/xml');
  const NS = { text: 'urn:oasis:names:tc:opendocument:xmlns:text:1.0', table: 'urn:oasis:names:tc:opendocument:xmlns:table:1.0', style: 'urn:oasis:names:tc:opendocument:xmlns:style:1.0', fo: 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0', draw: 'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0', xlink: 'http://www.w3.org/1999/xlink' };
  const styles = {};
  [...xml.getElementsByTagNameNS(NS.style, 'style')].forEach((style) => {
    const props = style.getElementsByTagNameNS(NS.style, 'text-properties')[0];
    if (!props) return;
    styles[style.getAttributeNS(NS.style, 'name')] = {
      bold: props.getAttributeNS(NS.fo, 'font-weight') === 'bold',
      italic: props.getAttributeNS(NS.fo, 'font-style') === 'italic',
      underline: Boolean(props.getAttributeNS(NS.style, 'text-underline-style')) && props.getAttributeNS(NS.style, 'text-underline-style') !== 'none',
      color: props.getAttributeNS(NS.fo, 'color'),
    };
  });
  const images = {};
  for (const path of Object.keys(zip.files).filter((name) => name.startsWith('Pictures/'))) {
    const type = path.endsWith('.png') ? 'image/png' : path.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg';
    images[path] = `data:${type};base64,${await zip.file(path).async('base64')}`;
  }
  const inline = (node) => [...node.childNodes].map((child) => {
    if (child.nodeType === 3) return escapeHtml(child.data);
    const name = child.localName;
    if (name === 's') return '&nbsp;'.repeat(Number(child.getAttributeNS(NS.text, 'c') || 1));
    if (name === 'tab') return '&emsp;';
    if (name === 'line-break') return '<br>';
    if (name === 'a') return `<a href="${escapeHtml(child.getAttributeNS(NS.xlink, 'href'))}">${inline(child)}</a>`;
    if (name === 'frame') {
      const img = child.getElementsByTagNameNS(NS.draw, 'image')[0];
      const src = img && images[img.getAttributeNS(NS.xlink, 'href')];
      return src ? `<img src="${src}" alt="">` : '';
    }
    if (name === 'span') {
      const style = styles[child.getAttributeNS(NS.text, 'style-name')] || {};
      let html = inline(child);
      if (style.bold) html = `<strong>${html}</strong>`;
      if (style.italic) html = `<em>${html}</em>`;
      if (style.underline) html = `<u>${html}</u>`;
      if (style.color) html = `<span style="color:${style.color}">${html}</span>`;
      return html;
    }
    return inline(child);
  }).join('');
  const block = (node) => {
    const name = node.localName;
    if (name === 'h') return `<h${Math.min(6, Number(node.getAttributeNS(NS.text, 'outline-level') || 1))}>${inline(node) || '<br>'}</h${Math.min(6, Number(node.getAttributeNS(NS.text, 'outline-level') || 1))}>`;
    if (name === 'p') return `<p>${inline(node) || '<br>'}</p>`;
    if (name === 'list') return `<ul>${[...node.children].map((item) => `<li>${[...item.children].map((child) => (child.localName === 'p' ? inline(child) : block(child))).join('')}</li>`).join('')}</ul>`;
    if (name === 'table') {
      const rows = [...node.getElementsByTagNameNS(NS.table, 'table-row')];
      return `<table class="wd-tbl-grid"><tbody>${rows.map((row) => `<tr>${[...row.getElementsByTagNameNS(NS.table, 'table-cell')].map((cell) => `<td>${[...cell.children].map(block).join('') || '<br>'}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
    if (name === 'section') return [...node.children].map(block).join('');
    return '';
  };
  const office = xml.getElementsByTagNameNS(NS.text, 'h')[0]?.parentElement || xml.getElementsByTagNameNS(NS.text, 'p')[0]?.parentElement;
  return office ? [...office.children].map(block).join('') : '';
}

/** Lector RTF básico: párrafos, negrita, cursiva, subrayado, caracteres hex y unicode. */
export function rtfToHtml(rtf) {
  let out = '';
  let paragraph = '';
  const stack = [];
  let state = { b: false, i: false, u: false, skip: false };
  let skipChars = 0;
  const open = () => `${state.b ? '<strong>' : ''}${state.i ? '<em>' : ''}${state.u ? '<u>' : ''}`;
  const close = () => `${state.u ? '</u>' : ''}${state.i ? '</em>' : ''}${state.b ? '</strong>' : ''}`;
  const emit = (text) => { if (!state.skip) paragraph += open() + escapeHtml(text) + close(); };
  const flush = () => { out += `<p>${paragraph || '<br>'}</p>`; paragraph = ''; };
  const DESTINATIONS = /^(fonttbl|colortbl|stylesheet|info|pict|header|footer|footnote|xmlnstbl|listtable|listoverridetable|rsidtbl|generator|themedata|colorschememapping|datastore|latentstyles)$/;
  for (let i = 0; i < rtf.length; i += 1) {
    const ch = rtf[i];
    if (ch === '{') { stack.push({ ...state }); continue; }
    if (ch === '}') { state = stack.pop() || state; continue; }
    if (ch === '\\') {
      const next = rtf[i + 1];
      if (next === '\\' || next === '{' || next === '}') { emit(next); i += 1; continue; }
      if (next === "'") {
        const hex = rtf.substr(i + 2, 2);
        if (skipChars > 0) skipChars -= 1;
        else emit(new TextDecoder('windows-1252').decode(new Uint8Array([parseInt(hex, 16)])));
        i += 3;
        continue;
      }
      if (next === '*') { state.skip = true; i += 1; continue; }
      const match = /^([a-z]+)(-?\d+)? ?/i.exec(rtf.slice(i + 1, i + 40));
      if (!match) continue;
      i += match[0].length;
      const [, word, arg] = match;
      if (DESTINATIONS.test(word)) state.skip = true;
      else if (word === 'par' || word === 'line') flush();
      else if (word === 'tab') emit('\t');
      else if (word === 'b') state.b = arg !== '0';
      else if (word === 'i') state.i = arg !== '0';
      else if (word === 'ul') state.u = arg !== '0';
      else if (word === 'ulnone') state.u = false;
      else if (word === 'plain') state = { ...state, b: false, i: false, u: false };
      else if (word === 'u') { emit(String.fromCharCode(Number(arg) < 0 ? Number(arg) + 65536 : Number(arg))); skipChars = 1; }
      continue;
    }
    if (ch === '\r' || ch === '\n') continue;
    if (skipChars > 0) { skipChars -= 1; continue; }
    emit(ch);
  }
  if (paragraph) flush();
  return out;
}

async function fromPdf(file) {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const blocks = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    const lines = [];
    content.items.forEach((item) => {
      if (!item.str) return;
      const y = Math.round(item.transform[5]);
      const size = Math.abs(item.transform[3]) || item.height || 10;
      let line = lines.find((entry) => Math.abs(entry.y - y) < size * 0.4);
      if (!line) { line = { y, size, parts: [] }; lines.push(line); }
      line.parts.push({ x: item.transform[4], text: item.str });
      line.size = Math.max(line.size, size);
    });
    lines.sort((a, b) => b.y - a.y);
    const sizes = lines.map((line) => line.size).sort((a, b) => a - b);
    const median = sizes[Math.floor(sizes.length / 2)] || 10;
    let paragraph = [];
    let lastY = null;
    const flush = () => { if (paragraph.length) blocks.push(`<p>${escapeHtml(paragraph.join(' '))}</p>`); paragraph = []; };
    lines.forEach((line) => {
      const text = line.parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(' ').replace(/\s+/g, ' ').trim();
      if (!text) return;
      if (line.size > median * 1.35 && text.length < 120) {
        flush();
        blocks.push(`<h${line.size > median * 1.8 ? 1 : 2}>${escapeHtml(text)}</h${line.size > median * 1.8 ? 1 : 2}>`);
      } else {
        if (lastY !== null && lastY - line.y > line.size * 1.8) flush();
        paragraph.push(text);
      }
      lastY = line.y;
    });
    flush();
    if (number < pdf.numPages) blocks.push('<hr class="wd-break">');
  }
  return blocks.join('');
}

/** Convierte un archivo a HTML del documento. */
export async function importFile(file) {
  const type = ext(file.name);
  let html = '';
  if (type === 'docx') html = await fromDocx(file);
  else if (type === 'doc') html = (await portfolioRepository.importLegacyDoc(file)).html;
  else if (type === 'odt') html = await fromOdt(file);
  else if (type === 'rtf') html = rtfToHtml(await file.text());
  else if (type === 'txt') html = textToHtml(await file.text());
  else if (type === 'html' || type === 'htm') {
    const doc = new DOMParser().parseFromString(await file.text(), 'text/html');
    html = cleanPastedHtml(doc.body.innerHTML, 'keep');
  } else if (type === 'md' || type === 'markdown') {
    const { marked } = await import('marked');
    html = await marked.parse(await file.text(), { gfm: true });
  } else if (type === 'pdf') html = await fromPdf(file);
  else throw new Error('Formato no compatible.');
  return sanitizeHtml(html);
}

export async function markdownToHtml(markdown) {
  const { marked } = await import('marked');
  return sanitizeHtml(await marked.parse(markdown, { gfm: true }));
}
