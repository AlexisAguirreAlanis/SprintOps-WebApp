// Modelo del documento de texto. Todo lo que no es contenido de página vive aquí,
// separado del render: el editor lee y escribe este objeto y el backend lo guarda como JSON.

const INCH = 96;

export const PAGE_SIZES = {
  letter: { label: 'Carta', width: 8.5 * INCH, height: 11 * INCH },
  legal: { label: 'Oficio', width: 8.5 * INCH, height: 14 * INCH },
  a4: { label: 'A4', width: 794, height: 1123 },
  a3: { label: 'A3', width: 1123, height: 1587 },
  a5: { label: 'A5', width: 559, height: 794 },
  envelope: { label: 'Sobre #10', width: 9.5 * INCH, height: 4.125 * INCH },
};

export const MARGIN_PRESETS = {
  normal: { label: 'Normales', top: INCH, right: INCH, bottom: INCH, left: INCH },
  narrow: { label: 'Estrechos', top: INCH / 2, right: INCH / 2, bottom: INCH / 2, left: INCH / 2 },
  moderate: { label: 'Moderados', top: INCH, right: INCH * 0.75, bottom: INCH, left: INCH * 0.75 },
  wide: { label: 'Amplios', top: INCH, right: INCH * 2, bottom: INCH, left: INCH * 2 },
};

export const THEMES = [
  { id: 'pistache', name: 'Pistache', colors: { primary: '#2f6f5e', accent: '#67bfa1', text: '#1e293b', heading: '#1f4e43', muted: '#64748b' }, fonts: { heading: '"Avenir Next", Avenir, "Segoe UI", sans-serif', body: 'Georgia, "Times New Roman", serif' } },
  { id: 'office', name: 'Office', colors: { primary: '#1f4e79', accent: '#2e75b6', text: '#1f2937', heading: '#1f4e79', muted: '#6b7280' }, fonts: { heading: 'Calibri, "Segoe UI", sans-serif', body: 'Calibri, "Segoe UI", sans-serif' } },
  { id: 'classic', name: 'Clásico', colors: { primary: '#7c2d12', accent: '#b45309', text: '#292524', heading: '#7c2d12', muted: '#78716c' }, fonts: { heading: '"Iowan Old Style", Palatino, serif', body: '"Iowan Old Style", Palatino, serif' } },
  { id: 'modern', name: 'Moderno', colors: { primary: '#4338ca', accent: '#7c3aed', text: '#111827', heading: '#312e81', muted: '#6b7280' }, fonts: { heading: '"Helvetica Neue", Helvetica, Arial, sans-serif', body: '"Helvetica Neue", Helvetica, Arial, sans-serif' } },
  { id: 'ocean', name: 'Océano', colors: { primary: '#0e7490', accent: '#06b6d4', text: '#0f172a', heading: '#155e75', muted: '#64748b' }, fonts: { heading: '"Avenir Next", Avenir, sans-serif', body: 'ui-sans-serif, system-ui, sans-serif' } },
  { id: 'sunset', name: 'Atardecer', colors: { primary: '#be123c', accent: '#f97316', text: '#1c1917', heading: '#9f1239', muted: '#78716c' }, fonts: { heading: 'Georgia, serif', body: 'ui-sans-serif, system-ui, sans-serif' } },
  { id: 'mono', name: 'Monocromo', colors: { primary: '#111827', accent: '#4b5563', text: '#111827', heading: '#000000', muted: '#6b7280' }, fonts: { heading: 'ui-monospace, Menlo, monospace', body: 'Georgia, serif' } },
];

export const STYLE_SETS = {
  default: { label: 'Predeterminado', after: 10, line: 1.5, h1: 30, h2: 23, h3: 18 },
  compact: { label: 'Compacto', after: 4, line: 1.2, h1: 26, h2: 20, h3: 16 },
  airy: { label: 'Espacioso', after: 16, line: 1.8, h1: 34, h2: 25, h3: 19 },
  formal: { label: 'Formal', after: 12, line: 2, h1: 28, h2: 22, h3: 17 },
};

let serial = 0;
export function uid(prefix = 'id') {
  serial += 1;
  return `${prefix}_${Date.now().toString(36)}_${serial.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const arr = (value) => (Array.isArray(value) ? value : []);
const str = (value, fallback = '') => (typeof value === 'string' ? value : fallback);
const num = (value, fallback) => (Number.isFinite(Number(value)) && value !== null && value !== '' ? Number(value) : fallback);

function normalizeMargins(raw) {
  if (isObject(raw?.margins)) {
    const m = raw.margins;
    return { top: num(m.top, INCH), right: num(m.right, INCH), bottom: num(m.bottom, INCH), left: num(m.left, INCH) };
  }
  const legacy = num(raw?.margin, 72);
  return { top: legacy, right: legacy, bottom: legacy, left: legacy };
}

export function normalizeDocModel(raw, makeId = () => uid('page')) {
  const pages = arr(raw?.pages).length
    ? raw.pages.map((page) => ({ id: page?.id || makeId(), html: str(page?.html, '<p><br></p>') }))
    : [{ id: makeId(), html: '<p><br></p>' }];
  const theme = THEMES.find((item) => item.id === raw?.theme?.id) || THEMES[0];
  return {
    pageSize: (PAGE_SIZES[raw?.pageSize] || raw?.pageSize === 'custom') ? raw.pageSize : 'letter',
    customSize: { width: num(raw?.customSize?.width, 816), height: num(raw?.customSize?.height, 1056) },
    orientation: raw?.orientation === 'landscape' ? 'landscape' : 'portrait',
    margins: normalizeMargins(raw),
    columns: { count: Math.min(4, Math.max(1, num(raw?.columns?.count, 1))), gap: num(raw?.columns?.gap, 36), divider: Boolean(raw?.columns?.divider) },
    header: str(raw?.header),
    footer: str(raw?.footer),
    headerFirst: str(raw?.headerFirst),
    footerFirst: str(raw?.footerFirst),
    headerEven: str(raw?.headerEven),
    footerEven: str(raw?.footerEven),
    differentFirst: Boolean(raw?.differentFirst),
    differentOddEven: Boolean(raw?.differentOddEven),
    pageNumbers: raw?.pageNumbers !== false,
    pageNumberFormat: str(raw?.pageNumberFormat, 'arabic'),
    pageNumberStart: num(raw?.pageNumberStart, 1),
    pageNumberAlign: str(raw?.pageNumberAlign, 'right'),
    theme: { ...theme, ...(isObject(raw?.theme) ? raw.theme : {}), colors: { ...theme.colors, ...(raw?.theme?.colors || {}) }, fonts: { ...theme.fonts, ...(raw?.theme?.fonts || {}) } },
    styleSet: STYLE_SETS[raw?.styleSet] ? raw.styleSet : 'default',
    customStyles: arr(raw?.customStyles).filter((style) => style?.id && style?.name),
    defaultFont: { family: str(raw?.defaultFont?.family), size: num(raw?.defaultFont?.size, 16) },
    background: isObject(raw?.background) ? raw.background : { type: 'none', value: '' },
    watermark: isObject(raw?.watermark) ? raw.watermark : { type: 'none' },
    pageBorder: isObject(raw?.pageBorder) ? raw.pageBorder : { style: 'none', color: '#1e293b', width: 2, offset: 24 },
    lineNumbers: Boolean(raw?.lineNumbers),
    hyphenation: ['auto', 'manual'].includes(raw?.hyphenation) ? raw.hyphenation : 'none',
    comments: arr(raw?.comments),
    sources: arr(raw?.sources),
    notes: arr(raw?.notes).filter((note) => note?.id),
    noteSettings: isObject(raw?.noteSettings) ? raw.noteSettings : {},
    citationStyle: str(raw?.citationStyle, 'apa'),
    recipients: isObject(raw?.recipients) ? { fields: arr(raw.recipients.fields), rows: arr(raw.recipients.rows), filter: raw.recipients.filter || null, sort: raw.recipients.sort || null, excluded: arr(raw.recipients.excluded) } : { fields: [], rows: [], filter: null, sort: null, excluded: [] },
    mailType: str(raw?.mailType, 'letter'),
    ink: isObject(raw?.ink) ? raw.ink : {},
    links: { sprintIds: arr(raw?.links?.sprintIds), issueIds: arr(raw?.links?.issueIds), userIds: arr(raw?.links?.userIds), meetingIds: arr(raw?.links?.meetingIds) },
    tracking: Boolean(raw?.tracking),
    protection: isObject(raw?.protection) ? raw.protection : { mode: 'none' },
    lock: isObject(raw?.lock) ? raw.lock : null,
    language: str(raw?.language, 'es'),
    dictionary: arr(raw?.dictionary),
    autocorrect: raw?.autocorrect !== false,
    properties: isObject(raw?.properties) ? raw.properties : {},
    pages,
  };
}

export function pageMetrics(doc) {
  const base = doc.pageSize === 'custom' ? doc.customSize : (PAGE_SIZES[doc.pageSize] || PAGE_SIZES.letter);
  const portrait = { width: Math.round(base.width), height: Math.round(base.height) };
  return doc.orientation === 'landscape' ? { width: portrait.height, height: portrait.width } : portrait;
}

export const HEADER_SPACE = 34;

export function bodyHeight(doc) {
  const { height } = pageMetrics(doc);
  return Math.max(120, height - doc.margins.top - doc.margins.bottom - HEADER_SPACE * 2);
}

export function formatPageNumber(n, format) {
  if (format === 'roman' || format === 'ROMAN') {
    const map = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
    let rest = n;
    let out = '';
    map.forEach(([value, glyph]) => { while (rest >= value) { out += glyph; rest -= value; } });
    return format === 'ROMAN' ? out.toUpperCase() : out;
  }
  if (format === 'alpha') {
    let out = '';
    let rest = n;
    while (rest > 0) { rest -= 1; out = String.fromCharCode(97 + (rest % 26)) + out; rest = Math.floor(rest / 26); }
    return out;
  }
  if (format === 'dash') return `- ${n} -`;
  return String(n);
}

export function plainText(html) {
  return String(html || '')
    .replace(/<\/(p|h[1-6]|li|tr|div|blockquote|pre)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*/g, '\n')
    .trim();
}
