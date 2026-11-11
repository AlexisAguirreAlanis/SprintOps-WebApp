// Exportación: DOCX, PDF, ODT, RTF, TXT, HTML, Markdown y EPUB. Acepta documento completo, páginas o selección.

import { escapeHtml } from '../sanitize';
import { joinContinuations } from '../engine/pagination';
import { stripDecorations } from '../render/rich';
import { pageMetrics, plainText } from '../model';

export const EXPORT_FORMATS = {
  docx: 'Word (.docx)',
  pdf: 'PDF (.pdf)',
  odt: 'OpenDocument (.odt)',
  rtf: 'Texto enriquecido (.rtf)',
  txt: 'Texto plano (.txt)',
  html: 'Página web (.html)',
  md: 'Markdown (.md)',
  epub: 'Libro electrónico (.epub)',
};

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const safeName = (name) => (name || 'Documento').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Documento';

/** HTML limpio y continuo para exportar (sin decoraciones, sin atributos de edición, trozos unidos). */
export function exportHtml(pagesHtml) {
  const root = document.createElement('div');
  root.innerHTML = joinContinuations(stripDecorations(pagesHtml.join('<hr class="wd-break" data-auto="1">')));
  root.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
  root.querySelectorAll('del.wd-del').forEach((el) => el.remove());
  root.querySelectorAll('ins.wd-ins, span.wd-fmtchg').forEach((el) => el.replaceWith(...el.childNodes));
  root.querySelectorAll('hr.wd-break[data-auto]').forEach((el) => el.remove());
  return root.innerHTML;
}

export const DOC_CSS = `
body{font-family:Georgia,"Times New Roman",serif;color:#1e293b;line-height:1.55;max-width:760px;margin:40px auto;padding:0 24px}
h1,h2,h3,h4,h5,h6{font-family:"Avenir Next",Avenir,"Segoe UI",sans-serif;color:#1f4e43;line-height:1.2}
table{border-collapse:collapse;width:100%;margin:12px 0}th,td{border:1px solid #cbd5e1;padding:6px 8px;vertical-align:top}th{background:#eef6f2}
blockquote{border-left:4px solid #67bfa1;margin:12px 0;padding:4px 16px;color:#475569}
pre{background:#0f172a;color:#e2e8f0;padding:12px;border-radius:8px;overflow:auto}
img,svg{max-width:100%;height:auto}figure{margin:12px 0}
.wd-callout{border-radius:10px;padding:10px 14px;margin:10px 0;background:#eef6f2;border-left:4px solid #2f6f5e}
.wd-callout.is-warn{background:#fff7e6;border-color:#d97706}.wd-callout.is-error{background:#fdecec;border-color:#be123c}.wd-callout.is-success{background:#eafaf1;border-color:#16a34a}
.wd-checklist{list-style:none;padding-left:4px}.wd-checklist li::before{content:"☐ "}.wd-checklist li[data-checked="true"]::before{content:"☑ "}
hr.wd-break{page-break-after:always;border:0}
.wd-pill{display:inline-block;padding:0 6px;border-radius:999px;background:#e2e8f0;font-size:.8em}
`;

export function standaloneHtml(html, title) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${DOC_CSS}</style></head><body>${html}</body></html>`;
}

async function svgToPng(svg, width, height) {
  const blob = new Blob([svg.includes('xmlns=') ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * 2));
    canvas.height = Math.max(1, Math.round(height * 2));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Sustituye figuras SVG (formas, gráficos, diagramas, Mermaid) por PNG para formatos que no las entienden. */
async function rasterizeFigures(root) {
  for (const figure of [...root.querySelectorAll('figure')]) {
    const svg = figure.querySelector('svg');
    if (!svg || figure.querySelector('img')) continue;
    const width = parseFloat(figure.style.width) || 480;
    const height = parseFloat(figure.style.height) || 300;
    try {
      const src = await svgToPng(svg.outerHTML, width, height);
      figure.innerHTML = `<img src="${src}" width="${Math.round(width)}" height="${Math.round(height)}" alt="${escapeHtml(figure.dataset.kind || 'figura')}">`;
    } catch {
      figure.remove();
    }
  }
}

function dataUrlBytes(src) {
  const [head, body] = src.split(',');
  const binary = atob(body || '');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { bytes, type: /image\/(png|jpe?g|gif|bmp)/.exec(head)?.[1]?.replace('jpeg', 'jpg') || 'png' };
}

async function toDocx(html, doc, title) {
  const docx = await import('docx');
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ImageRun, ExternalHyperlink, AlignmentType, Header, Footer, PageNumber, PageOrientation, ShadingType, LevelFormat } = docx;
  const root = document.createElement('div');
  root.innerHTML = html;
  await rasterizeFigures(root);
  const align = (el) => ({ center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED }[el?.style?.textAlign] || undefined);
  const runs = (node, fmt = {}) => {
    const out = [];
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        if (child.data) out.push(new TextRun({ text: child.data.replace(/\u200b/g, ''), ...fmt }));
        return;
      }
      if (child.nodeType !== 1) return;
      const tag = child.tagName;
      const style = child.style || {};
      const next = { ...fmt };
      if (tag === 'B' || tag === 'STRONG' || Number(style.fontWeight) >= 600 || style.fontWeight === 'bold') next.bold = true;
      if (tag === 'I' || tag === 'EM' || style.fontStyle === 'italic') next.italics = true;
      if (tag === 'U' || /underline/.test(style.textDecoration || '')) next.underline = {};
      if (tag === 'S' || tag === 'STRIKE' || /line-through/.test(style.textDecoration || '')) next.strike = true;
      if (tag === 'SUP') next.superScript = true;
      if (tag === 'SUB') next.subScript = true;
      if (tag === 'CODE') next.font = 'Consolas';
      if (style.color && /^#|rgb/.test(style.color)) next.color = rgbHex(style.color);
      if (style.backgroundColor && /^#|rgb/.test(style.backgroundColor)) next.shading = { type: ShadingType.CLEAR, fill: rgbHex(style.backgroundColor) };
      if (style.fontSize && /px$/.test(style.fontSize)) next.size = Math.round(parseFloat(style.fontSize) * 1.5);
      if (tag === 'BR') { out.push(new TextRun({ break: 1 })); return; }
      if (tag === 'IMG' && /^data:image/.test(child.src)) {
        const { bytes, type } = dataUrlBytes(child.src);
        const width = Number(child.getAttribute('width')) || child.naturalWidth || 400;
        const height = Number(child.getAttribute('height')) || child.naturalHeight || 300;
        const scale = Math.min(1, 600 / width);
        out.push(new ImageRun({ data: bytes, type, transformation: { width: Math.round(width * scale), height: Math.round(height * scale) } }));
        return;
      }
      if (tag === 'A' && child.href) {
        out.push(new ExternalHyperlink({ link: child.href, children: [new TextRun({ text: child.textContent, style: 'Hyperlink', ...next })] }));
        return;
      }
      out.push(...runs(child, next));
    });
    return out;
  };
  const headingLevels = { H1: HeadingLevel.HEADING_1, H2: HeadingLevel.HEADING_2, H3: HeadingLevel.HEADING_3, H4: HeadingLevel.HEADING_4, H5: HeadingLevel.HEADING_5, H6: HeadingLevel.HEADING_6 };
  const blocks = (container, level = 0) => {
    const out = [];
    [...container.children].forEach((el) => {
      const tag = el.tagName;
      if (headingLevels[tag]) out.push(new Paragraph({ heading: el.classList.contains('wd-style-title') ? HeadingLevel.TITLE : headingLevels[tag], alignment: align(el), children: runs(el) }));
      else if (tag === 'UL' || tag === 'OL') {
        [...el.children].forEach((li) => {
          const nested = [...li.children].filter((child) => child.tagName === 'UL' || child.tagName === 'OL');
          const clone = li.cloneNode(true);
          clone.querySelectorAll(':scope > ul, :scope > ol').forEach((child) => child.remove());
          const checked = el.classList.contains('wd-checklist') ? (li.dataset.checked === 'true' ? '☑ ' : '☐ ') : '';
          out.push(new Paragraph({ children: [new TextRun(checked), ...runs(clone)], ...(checked ? {} : { numbering: { reference: tag === 'OL' ? 'numbers' : 'bullets', level: Math.min(level, 8) } }) }));
          nested.forEach((list) => out.push(...blocks({ children: [list] }, level + 1)));
        });
      } else if (tag === 'TABLE') {
        const rows = [...el.rows].map((row) => new TableRow({
          tableHeader: row.rowIndex === 0 && el.dataset.repeatHeader === 'true',
          children: [...row.cells].map((cell) => new TableCell({
            columnSpan: cell.colSpan,
            rowSpan: cell.rowSpan,
            shading: cell.tagName === 'TH' ? { type: ShadingType.CLEAR, fill: 'EEF6F2' } : (cell.style.backgroundColor ? { type: ShadingType.CLEAR, fill: rgbHex(cell.style.backgroundColor) } : undefined),
            children: cell.children.length && [...cell.children].some((child) => /^(P|UL|OL|H\d|TABLE)$/.test(child.tagName)) ? blocks(cell, level) : [new Paragraph({ children: runs(cell, cell.tagName === 'TH' ? { bold: true } : {}) })],
          })),
        }));
        out.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }), new Paragraph(''));
      } else if (tag === 'HR') out.push(new Paragraph({ children: [], pageBreakBefore: el.classList.contains('wd-break') }));
      else if (tag === 'BLOCKQUOTE') out.push(new Paragraph({ style: 'Quote', children: runs(el), indent: { left: 720 } }));
      else if (tag === 'PRE') el.textContent.split('\n').forEach((line) => out.push(new Paragraph({ children: [new TextRun({ text: line, font: 'Consolas', size: 19 })] })));
      else if (tag === 'DETAILS' || tag === 'DIV' || tag === 'FIGURE' || tag === 'SECTION') {
        const nested = blocks(el, level);
        out.push(...(nested.length ? nested : [new Paragraph({ children: runs(el) })]));
      } else if (tag === 'SUMMARY') out.push(new Paragraph({ children: runs(el, { bold: true }) }));
      else out.push(new Paragraph({ alignment: align(el), children: runs(el), indent: el.style.marginLeft ? { left: Math.round(parseFloat(el.style.marginLeft) * 15) } : undefined }));
    });
    return out;
  };
  const metrics = pageMetrics(doc);
  const twip = (px) => Math.round(px * 15);
  const chrome = (text) => [new Paragraph({ children: [new TextRun(plainText(text || ''))] })];
  const document_ = new Document({
    creator: doc.properties?.author || 'SprintOps',
    title,
    description: doc.properties?.description || '',
    numbering: {
      config: [
        { reference: 'bullets', levels: Array.from({ length: 9 }, (_, level) => ({ level, format: LevelFormat.BULLET, text: ['•', '◦', '▪'][level % 3], alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } } })) },
        { reference: 'numbers', levels: Array.from({ length: 9 }, (_, level) => ({ level, format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN][level % 3], text: `%${level + 1}.`, alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } } })) },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: twip(doc.orientation === 'landscape' ? metrics.height : metrics.width), height: twip(doc.orientation === 'landscape' ? metrics.width : metrics.height), orientation: doc.orientation === 'landscape' ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
          margin: { top: twip(doc.margins.top), right: twip(doc.margins.right), bottom: twip(doc.margins.bottom), left: twip(doc.margins.left) },
        },
        column: doc.columns.count > 1 ? { count: doc.columns.count, space: twip(doc.columns.gap), separate: doc.columns.divider } : undefined,
      },
      headers: doc.header ? { default: new Header({ children: chrome(doc.header) }) } : undefined,
      footers: { default: new Footer({ children: [...(doc.footer ? chrome(doc.footer) : []), ...(doc.pageNumbers ? [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT] })] })] : [])] }) },
      children: blocks(root),
    }],
  });
  return Packer.toBlob(document_);
}

function rgbHex(value) {
  if (value.startsWith('#')) return value.slice(1, 7).toUpperCase();
  const parts = value.match(/\d+/g) || [0, 0, 0];
  return parts.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
}

const xml = (text) => escapeHtml(text).replace(/'/g, '&apos;');

async function toOdt(html, title) {
  const { default: JSZip } = await import('jszip');
  const root = document.createElement('div');
  root.innerHTML = html;
  await rasterizeFigures(root);
  const zip = new JSZip();
  const pictures = [];
  const inline = (node) => [...node.childNodes].map((child) => {
    if (child.nodeType === 3) return xml(child.data).replace(/\t/g, '<text:tab/>');
    if (child.nodeType !== 1) return '';
    const tag = child.tagName;
    if (tag === 'BR') return '<text:line-break/>';
    if (tag === 'IMG' && /^data:image/.test(child.src)) {
      const { bytes, type } = dataUrlBytes(child.src);
      const name = `Pictures/img${pictures.length + 1}.${type}`;
      pictures.push({ name, bytes, type });
      const width = (Number(child.getAttribute('width')) || child.naturalWidth || 400) / 96;
      const height = (Number(child.getAttribute('height')) || child.naturalHeight || 300) / 96;
      const scale = Math.min(1, 6.5 / width);
      return `<draw:frame text:anchor-type="as-char" svg:width="${(width * scale).toFixed(2)}in" svg:height="${(height * scale).toFixed(2)}in"><draw:image xlink:href="${name}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame>`;
    }
    if (tag === 'A') return `<text:a xlink:type="simple" xlink:href="${xml(child.href)}">${inline(child)}</text:a>`;
    const style = tag === 'B' || tag === 'STRONG' ? 'TB' : tag === 'I' || tag === 'EM' ? 'TI' : tag === 'U' ? 'TU' : tag === 'S' ? 'TS' : null;
    return style ? `<text:span text:style-name="${style}">${inline(child)}</text:span>` : inline(child);
  }).join('');
  const blocks = (container) => [...container.children].map((el) => {
    const tag = el.tagName;
    if (/^H[1-6]$/.test(tag)) return `<text:h text:style-name="Heading_20_${tag[1]}" text:outline-level="${tag[1]}">${inline(el)}</text:h>`;
    if (tag === 'UL' || tag === 'OL') return `<text:list text:style-name="${tag === 'OL' ? 'LNum' : 'LBul'}">${[...el.children].map((li) => `<text:list-item><text:p>${inline(li)}</text:p></text:list-item>`).join('')}</text:list>`;
    if (tag === 'TABLE') {
      const cols = Math.max(...[...el.rows].map((row) => row.cells.length));
      return `<table:table><table:table-column table:number-columns-repeated="${cols}"/>${[...el.rows].map((row) => `<table:table-row>${[...row.cells].map((cell) => `<table:table-cell office:value-type="string"${cell.colSpan > 1 ? ` table:number-columns-spanned="${cell.colSpan}"` : ''}><text:p>${inline(cell)}</text:p></table:table-cell>`).join('')}</table:table-row>`).join('')}</table:table>`;
    }
    if (tag === 'HR' && el.classList.contains('wd-break')) return '<text:p text:style-name="PBreak"/>';
    if (tag === 'DIV' || tag === 'FIGURE' || tag === 'DETAILS' || tag === 'SECTION') return blocks(el) || `<text:p>${inline(el)}</text:p>`;
    return `<text:p text:style-name="${tag === 'BLOCKQUOTE' ? 'Quote' : tag === 'PRE' ? 'Code' : 'Standard'}">${inline(el)}</text:p>`;
  }).join('');
  const NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"';
  const body = blocks(root);
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
  zip.file('content.xml', `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${NS} office:version="1.2"><office:automatic-styles><style:style style:name="TB" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style><style:style style:name="TI" style:family="text"><style:text-properties fo:font-style="italic"/></style:style><style:style style:name="TU" style:family="text"><style:text-properties style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"/></style:style><style:style style:name="TS" style:family="text"><style:text-properties style:text-line-through-style="solid"/></style:style><style:style style:name="PBreak" style:family="paragraph"><style:paragraph-properties fo:break-after="page"/></style:style><text:list-style style:name="LBul"><text:list-level-style-bullet text:level="1" text:bullet-char="•"/></text:list-style><text:list-style style:name="LNum"><text:list-level-style-number text:level="1" style:num-format="1" style:num-suffix="."/></text:list-style></office:automatic-styles><office:body><office:text>${body}</office:text></office:body></office:document-content>`);
  zip.file('styles.xml', `<?xml version="1.0" encoding="UTF-8"?><office:document-styles ${NS} office:version="1.2"><office:styles><style:style style:name="Standard" style:family="paragraph"><style:text-properties style:font-name="Georgia" fo:font-size="12pt"/></style:style>${[1, 2, 3, 4, 5, 6].map((n) => `<style:style style:name="Heading_20_${n}" style:display-name="Heading ${n}" style:family="paragraph"><style:text-properties fo:font-size="${24 - n * 2}pt" fo:font-weight="bold" fo:color="#1f4e43"/></style:style>`).join('')}<style:style style:name="Quote" style:family="paragraph"><style:paragraph-properties fo:margin-left="0.5in"/><style:text-properties fo:font-style="italic"/></style:style><style:style style:name="Code" style:family="paragraph"><style:text-properties style:font-name="Courier New" fo:font-family="Courier New"/></style:style></office:styles></office:document-styles>`);
  zip.file('meta.xml', `<?xml version="1.0" encoding="UTF-8"?><office:document-meta ${NS} office:version="1.2"><office:meta><dc:title>${xml(title)}</dc:title><meta:generator>Pistache SprintOps</meta:generator></office:meta></office:document-meta>`);
  pictures.forEach((picture) => zip.file(picture.name, picture.bytes));
  zip.file('META-INF/manifest.xml', `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>${pictures.map((picture) => `<manifest:file-entry manifest:full-path="${picture.name}" manifest:media-type="image/${picture.type === 'jpg' ? 'jpeg' : picture.type}"/>`).join('')}</manifest:manifest>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.oasis.opendocument.text' });
}

function toRtf(html) {
  const root = document.createElement('div');
  root.innerHTML = html;
  const esc = (text) => [...text].map((ch) => {
    const code = ch.charCodeAt(0);
    if (ch === '\\' || ch === '{' || ch === '}') return `\\${ch}`;
    if (code > 127) return `\\u${code > 32767 ? code - 65536 : code}?`;
    if (ch === '\t') return '\\tab ';
    return ch;
  }).join('');
  const inline = (node) => [...node.childNodes].map((child) => {
    if (child.nodeType === 3) return esc(child.data.replace(/\u200b/g, ''));
    if (child.nodeType !== 1) return '';
    const tag = child.tagName;
    if (tag === 'BR') return '\\line ';
    const inner = inline(child);
    if (tag === 'B' || tag === 'STRONG') return `{\\b ${inner}}`;
    if (tag === 'I' || tag === 'EM') return `{\\i ${inner}}`;
    if (tag === 'U') return `{\\ul ${inner}}`;
    if (tag === 'S') return `{\\strike ${inner}}`;
    if (tag === 'SUP') return `{\\super ${inner}}`;
    if (tag === 'SUB') return `{\\sub ${inner}}`;
    return inner;
  }).join('');
  const sizes = { H1: 48, H2: 36, H3: 30, H4: 26, H5: 24, H6: 22 };
  const blocks = (container) => [...container.children].map((el) => {
    const tag = el.tagName;
    if (sizes[tag]) return `{\\pard\\sb240\\sa120\\b\\fs${sizes[tag]} ${inline(el)}\\par}`;
    if (tag === 'UL' || tag === 'OL') return [...el.children].map((li, index) => `{\\pard\\li720\\fi-360 ${tag === 'OL' ? `${index + 1}.` : '\\bullet'}\\tab ${inline(li)}\\par}`).join('');
    if (tag === 'TABLE') {
      return [...el.rows].map((row) => {
        const cells = [...row.cells];
        const width = Math.round(9000 / (cells.length || 1));
        return `\\trowd\\trgaph108${cells.map((_, index) => `\\clbrdrt\\brdrs\\clbrdrl\\brdrs\\clbrdrb\\brdrs\\clbrdrr\\brdrs\\cellx${width * (index + 1)}`).join('')}${cells.map((cell) => `\\pard\\intbl ${inline(cell)}\\cell`).join('')}\\row`;
      }).join('') + '\\pard\\par';
    }
    if (tag === 'HR' && el.classList.contains('wd-break')) return '\\page ';
    if (tag === 'BLOCKQUOTE') return `{\\pard\\li720\\i ${inline(el)}\\par}`;
    if (tag === 'PRE') return `{\\pard\\f1 ${esc(el.textContent).replace(/\n/g, '\\line ')}\\par}`;
    if (tag === 'DIV' || tag === 'FIGURE' || tag === 'DETAILS') return blocks(el) || `{\\pard ${inline(el)}\\par}`;
    const alignment = { center: '\\qc', right: '\\qr', justify: '\\qj' }[el.style?.textAlign] || '';
    return `{\\pard${alignment}\\sa160 ${inline(el)}\\par}`;
  }).join('\n');
  return `{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0 Georgia;}{\\f1 Courier New;}}\\fs24\n${blocks(root)}\n}`;
}

function toTxt(html) {
  const root = document.createElement('div');
  root.innerHTML = html;
  root.querySelectorAll('li').forEach((li) => li.prepend(li.closest('ol') ? `${[...li.parentElement.children].indexOf(li) + 1}. ` : '• '));
  root.querySelectorAll('td, th').forEach((cell) => cell.append('\t'));
  root.querySelectorAll('hr.wd-break').forEach((hr) => hr.replaceWith('\n\f\n'));
  return plainText(root.innerHTML);
}

async function toMarkdown(html) {
  const { default: TurndownService } = await import('turndown');
  const service = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
  service.addRule('table', {
    filter: 'table',
    replacement: (_, node) => {
      const rows = [...node.rows].map((row) => `| ${[...row.cells].map((cell) => cell.textContent.trim().replace(/\|/g, '\\|')).join(' | ')} |`);
      if (!rows.length) return '';
      const cols = node.rows[0].cells.length;
      rows.splice(1, 0, `| ${Array(cols).fill('---').join(' | ')} |`);
      return `\n\n${rows.join('\n')}\n\n`;
    },
  });
  service.addRule('checklist', { filter: (node) => node.nodeName === 'LI' && node.parentElement?.classList.contains('wd-checklist'), replacement: (content, node) => `- [${node.dataset.checked === 'true' ? 'x' : ' '}] ${content.trim()}\n` });
  service.addRule('mermaid', { filter: (node) => node.nodeName === 'FIGURE' && node.classList.contains('wd-mermaid'), replacement: (_, node) => `\n\n\`\`\`mermaid\n${node.dataset.code || ''}\n\`\`\`\n\n` });
  service.addRule('equation', { filter: (node) => node.classList?.contains('wd-eq'), replacement: (_, node) => (node.tagName === 'SPAN' ? `$${node.dataset.tex}$` : `\n\n$$\n${node.dataset.tex}\n$$\n\n`) });
  service.addRule('break', { filter: (node) => node.nodeName === 'HR' && node.classList.contains('wd-break'), replacement: () => '\n\n---\n\n' });
  return service.turndown(html);
}

async function toEpub(html, title, author) {
  const { default: JSZip } = await import('jszip');
  const root = document.createElement('div');
  root.innerHTML = html;
  await rasterizeFigures(root);
  const zip = new JSZip();
  const images = [];
  root.querySelectorAll('img').forEach((img) => {
    if (!/^data:image/.test(img.src)) { img.remove(); return; }
    const { bytes, type } = dataUrlBytes(img.src);
    const name = `images/img${images.length + 1}.${type}`;
    images.push({ name, bytes, type });
    img.setAttribute('src', name);
  });
  const chapters = [];
  let current = { title: title, nodes: [] };
  [...root.children].forEach((el) => {
    if (el.tagName === 'H1' && current.nodes.length) { chapters.push(current); current = { title: el.textContent.trim() || title, nodes: [] }; }
    if (el.tagName === 'H1' && !current.nodes.length) current.title = el.textContent.trim() || title;
    if (!(el.tagName === 'HR' && el.classList.contains('wd-break'))) current.nodes.push(el);
  });
  chapters.push(current);
  const serializer = new XMLSerializer();
  const xhtml = (chapterTitle, bodyHtml) => `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="es"><head><title>${xml(chapterTitle)}</title><link rel="stylesheet" href="style.css"/></head><body>${bodyHtml}</body></html>`;
  const id = `urn:uuid:${crypto.randomUUID?.() || Date.now()}`;
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  zip.file('OEBPS/style.css', DOC_CSS);
  chapters.forEach((chapter, index) => {
    const body = chapter.nodes.map((node) => serializer.serializeToString(node).replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '')).join('');
    zip.file(`OEBPS/chapter${index + 1}.xhtml`, xhtml(chapter.title, body));
  });
  images.forEach((image) => zip.file(`OEBPS/${image.name}`, image.bytes));
  zip.file('OEBPS/nav.xhtml', xhtml('Índice', `<nav epub:type="toc"><h1>Índice</h1><ol>${chapters.map((chapter, index) => `<li><a href="chapter${index + 1}.xhtml">${xml(chapter.title)}</a></li>`).join('')}</ol></nav>`));
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">${id}</dc:identifier><dc:title>${xml(title)}</dc:title><dc:creator>${xml(author || 'SprintOps')}</dc:creator><dc:language>es</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/>${chapters.map((_, index) => `<item id="c${index + 1}" href="chapter${index + 1}.xhtml" media-type="application/xhtml+xml"/>`).join('')}${images.map((image, index) => `<item id="i${index + 1}" href="${image.name}" media-type="image/${image.type === 'jpg' ? 'jpeg' : image.type}"/>`).join('')}</manifest><spine>${chapters.map((_, index) => `<itemref idref="c${index + 1}"/>`).join('')}</spine></package>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
}

function prepareExportPage(page, metrics) {
  const clone = page.cloneNode(true);
  clone.classList.add('wd-export-page');
  clone.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
  clone.querySelectorAll('[spellcheck]').forEach((el) => el.setAttribute('spellcheck', 'false'));
  clone.querySelectorAll('.wd-ink-layer, .wd-collab-tag, .wd-obj-handles').forEach((el) => el.remove());
  clone.querySelectorAll('mark.wd-cmark').forEach((mark) => mark.replaceWith(...mark.childNodes));
  clone.querySelectorAll('span.wd-fmtchg').forEach((el) => {
    const look = el.getAttribute('style');
    const kids = [...el.childNodes];
    if (look && kids.length) {
      const keep = document.createElement('span');
      keep.setAttribute('style', look);
      keep.append(...kids);
      el.replaceWith(keep);
    } else el.replaceWith(...kids);
  });
  const quiet = document.createElement('style');
  quiet.textContent = '.wd-export-page ::spelling-error, .wd-export-page ::grammar-error { text-decoration: none !important; background: none !important; }';
  clone.prepend(quiet);
  Object.assign(clone.style, {
    width: `${metrics.width}px`,
    height: `${metrics.height}px`,
    minHeight: `${metrics.height}px`,
    margin: '0',
    boxShadow: 'none',
    position: 'relative',
    overflow: 'hidden',
    background: clone.style.background || '#ffffff',
  });
  return clone;
}

function pdfColor(value) {
  if (!value || value === 'transparent') return null;
  const rgb = String(value).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/i);
  if (rgb) {
    const alpha = rgb[4] == null ? 1 : (rgb[4].endsWith('%') ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4]));
    if (alpha < 0.04) return null;
    return [Math.round(Number(rgb[1])), Math.round(Number(rgb[2])), Math.round(Number(rgb[3]))];
  }
  const srgb = String(value).match(/color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/i);
  if (srgb) {
    const alpha = srgb[4] == null ? 1 : parseFloat(srgb[4]);
    if (alpha < 0.04) return null;
    return [Math.round(Number(srgb[1]) * 255), Math.round(Number(srgb[2]) * 255), Math.round(Number(srgb[3]) * 255)];
  }
  const hex = String(value).match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (!hex) return null;
  const full = hex[1].length === 3 ? hex[1].split('').map((ch) => ch + ch).join('') : hex[1];
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function pdfFace(style) {
  const family = (style.fontFamily || '').toLowerCase();
  const face = /mono|courier|consolas|menlo|monaco|source code|ui-monospace/.test(family)
    ? 'courier'
    : /georgia|times|cambria|palatino|garamond|liberation serif|serif/.test(family)
      ? 'times'
      : 'helvetica';
  const bold = style.fontWeight === 'bold' || Number(style.fontWeight) >= 600;
  const italic = /italic|oblique/.test(style.fontStyle || '');
  let fontStyle = 'normal';
  if (bold && italic) fontStyle = face === 'courier' ? 'boldoblique' : 'bolditalic';
  else if (bold) fontStyle = 'bold';
  else if (italic) fontStyle = face === 'courier' ? 'oblique' : 'italic';
  return { face, fontStyle };
}

function quotedContent(value) {
  if (!value || value === 'none' || value === 'normal') return '';
  const quoted = String(value).match(/^"([\s\S]*)"$/);
  return quoted ? quoted[1] : '';
}

function hiddenBox(style) {
  return style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0;
}

function paintBorders(pdf, rect, style, origin) {
  const sides = [
    ['Top', rect.left, rect.top, rect.right, rect.top],
    ['Right', rect.right, rect.top, rect.right, rect.bottom],
    ['Bottom', rect.left, rect.bottom, rect.right, rect.bottom],
    ['Left', rect.left, rect.top, rect.left, rect.bottom],
  ];
  sides.forEach(([side, x1, y1, x2, y2]) => {
    const width = parseFloat(style[`border${side}Width`]) || 0;
    if (width < 0.4 || style[`border${side}Style`] === 'none') return;
    const color = pdfColor(style[`border${side}Color`]);
    if (!color) return;
    pdf.setDrawColor(color[0], color[1], color[2]);
    pdf.setLineWidth(width);
    pdf.line(x1 - origin.left, y1 - origin.top, x2 - origin.left, y2 - origin.top);
  });
}

function textLines(node) {
  const text = node.textContent.replace(/\u00a0/g, ' ');
  const lines = [];
  const range = document.createRange();
  let index = 0;
  while (index < text.length) {
    if (text[index] === '\n') { index += 1; continue; }
    range.setStart(node, index);
    range.setEnd(node, index + 1);
    const first = range.getClientRects()[0];
    if (!first || (first.width === 0 && first.height === 0)) { index += 1; continue; }
    let end = index + 1;
    while (end < text.length && text[end] !== '\n') {
      range.setStart(node, end);
      range.setEnd(node, end + 1);
      const next = range.getClientRects()[0];
      if (!next || Math.abs(next.top - first.top) > 1.5) break;
      end += 1;
    }
    if (end === index) end = index + 1;
    range.setStart(node, index);
    range.setEnd(node, end);
    const rect = range.getBoundingClientRect();
    const slice = text.slice(index, end);
    if (slice.trim() && rect.width > 0.2 && rect.height > 0.2) lines.push({ text: slice, rect });
    index = end;
  }
  return lines;
}

let glyphMeasure;

function paintTextRun(pdf, text, rect, style, origin) {
  const color = pdfColor(style.color) || [30, 41, 59];
  const { face, fontStyle } = pdfFace(style);
  const fontPx = parseFloat(style.fontSize) || 16;
  pdf.setFont(face, fontStyle);
  pdf.setFontSize((fontPx * 72) / 96);
  pdf.setTextColor(color[0], color[1], color[2]);
  if (!glyphMeasure) glyphMeasure = document.createElement('canvas').getContext('2d');
  glyphMeasure.font = `${style.fontStyle || 'normal'} ${style.fontWeight || '400'} ${style.fontSize} ${style.fontFamily}`;
  const measured = glyphMeasure.measureText(text);
  const descent = measured.actualBoundingBoxDescent || 0;
  const natural = pdf.getTextWidth(text);
  const scale = natural > 0 ? Math.min(2, Math.max(0.5, rect.width / natural)) : 1;
  const x = rect.left - origin.left;
  const y = rect.bottom - origin.top - descent;
  pdf.text(text, x, y, { baseline: 'alphabetic', horizontalScale: scale });
  const deco = style.textDecorationLine || '';
  if (deco.includes('underline') || deco.includes('line-through')) {
    pdf.setDrawColor(color[0], color[1], color[2]);
    pdf.setLineWidth(Math.max(0.6, fontPx / 16));
    if (deco.includes('underline')) pdf.line(x, y + Math.max(1, fontPx * 0.08), x + rect.width, y + Math.max(1, fontPx * 0.08));
    if (deco.includes('line-through')) pdf.line(x, y - fontPx * 0.28, x + rect.width, y - fontPx * 0.28);
  }
}

function paintBoxes(pdf, root) {
  const origin = root.getBoundingClientRect();
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, origin.width, origin.height, 'F');
  [root, ...root.querySelectorAll('*')].forEach((el) => {
    const style = getComputedStyle(el);
    if (hiddenBox(style)) return;
    const bg = pdfColor(style.backgroundColor);
    if (bg) {
      pdf.setFillColor(bg[0], bg[1], bg[2]);
      [...el.getClientRects()].forEach((rect) => {
        if (rect.width < 0.4 || rect.height < 0.4) return;
        pdf.rect(rect.left - origin.left, rect.top - origin.top, rect.width, rect.height, 'F');
      });
    }
    const box = el.getBoundingClientRect();
    if (box.width > 0.4 && box.height > 0.4) paintBorders(pdf, box, style, origin);
  });
}

function paintVectorPage(pdf, root) {
  const origin = root.getBoundingClientRect();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const parent = node.parentElement;
    const style = parent ? getComputedStyle(parent) : null;
    if (style && !hiddenBox(style)) {
      textLines(node).forEach((line) => paintTextRun(pdf, line.text, line.rect, style, origin));
    }
    node = walker.nextNode();
  }
  root.querySelectorAll('li, .wd-checklist li').forEach((el) => {
    const style = getComputedStyle(el);
    if (hiddenBox(style) || style.listStyleType === 'none' || style.listStylePosition === 'inside') return;
    const rect = el.getBoundingClientRect();
    const marker = style.listStyleType === 'decimal'
      ? `${[...el.parentElement.children].filter((item) => item.tagName === 'LI').indexOf(el) + 1}.`
      : '•';
    paintTextRun(pdf, marker, { left: rect.left - 16, top: rect.top, width: 14, height: rect.height, right: rect.left - 2, bottom: rect.bottom }, style, origin);
  });
  root.querySelectorAll('*').forEach((el) => {
    const before = getComputedStyle(el, '::before');
    const text = quotedContent(before.content);
    if (!text || hiddenBox(before)) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 0.4) return;
    paintTextRun(pdf, text, { left: rect.left, top: rect.top, width: Math.max(12, text.length * (parseFloat(before.fontSize) || 12) * 0.6), height: rect.height }, before, origin);
  });
  root.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('javascript:')) return;
    [...link.getClientRects()].forEach((rect) => {
      if (rect.width < 1 || rect.height < 1) return;
      pdf.link(rect.left - origin.left, rect.top - origin.top, rect.width, rect.height, { url: href });
    });
  });
}

async function paintGraphics(pdf, root) {
  const origin = root.getBoundingClientRect();
  const nodes = [...root.querySelectorAll('img, svg, canvas')].filter((el) => !el.closest('.wd-ink-layer'));
  for (const el of nodes) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;
    try {
      let url = '';
      if (el.tagName === 'CANVAS') url = el.toDataURL('image/png');
      else if (el.tagName === 'IMG') url = el.currentSrc || el.src;
      else url = await svgToPng(new XMLSerializer().serializeToString(el), rect.width, rect.height);
      if (!url) continue;
      const format = /jpe?g/i.test(url.slice(0, 40)) ? 'JPEG' : 'PNG';
      pdf.addImage(url, format, rect.left - origin.left, rect.top - origin.top, rect.width, rect.height, undefined, 'FAST');
    } catch {
      /* una imagen suelta no debe tumbar el texto del PDF */
    }
  }
}

/** PDF con texto real (no una foto de la página): letra nítida a cualquier zoom y el color tal como está en el documento. */
async function toPdf(pageNodes, doc) {
  const { jsPDF } = await import('jspdf');
  const metrics = pageMetrics(doc);
  const orientation = metrics.width > metrics.height ? 'landscape' : 'portrait';
  const container = document.createElement('div');
  container.className = 'wd-export-root';
  Object.assign(container.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: `${metrics.width}px`,
    zIndex: '-1',
    pointerEvents: 'none',
  });
  document.body.append(container);
  try {
    const pdf = new jsPDF({
      unit: 'px',
      format: [metrics.width, metrics.height],
      orientation,
      hotfixes: ['px_scaling'],
      compress: true,
    });
    for (let index = 0; index < pageNodes.length; index += 1) {
      if (index > 0) pdf.addPage([metrics.width, metrics.height], orientation);
      const clone = prepareExportPage(pageNodes[index], metrics);
      container.append(clone);
      paintBoxes(pdf, clone);
      await paintGraphics(pdf, clone);
      paintVectorPage(pdf, clone);
      clone.remove();
    }
    return pdf.output('blob');
  } finally {
    container.remove();
  }
}

export async function exportDocument(format, { pagesHtml, pageNodes, doc, title }) {
  const name = safeName(title);
  const html = exportHtml(pagesHtml);
  if (format === 'pdf') return download(await toPdf(pageNodes, doc), `${name}.pdf`);
  if (format === 'docx') return download(await toDocx(html, doc, title), `${name}.docx`);
  if (format === 'odt') return download(await toOdt(html, title), `${name}.odt`);
  if (format === 'rtf') return download(new Blob([toRtf(html)], { type: 'application/rtf' }), `${name}.rtf`);
  if (format === 'txt') return download(new Blob([toTxt(html)], { type: 'text/plain;charset=utf-8' }), `${name}.txt`);
  if (format === 'html') return download(new Blob([standaloneHtml(html, title)], { type: 'text/html;charset=utf-8' }), `${name}.html`);
  if (format === 'md') return download(new Blob([await toMarkdown(html)], { type: 'text/markdown;charset=utf-8' }), `${name}.md`);
  if (format === 'epub') return download(await toEpub(html, title, doc.properties?.author), `${name}.epub`);
  throw new Error('Formato de exportación desconocido.');
}

export { toTxt, toMarkdown };
