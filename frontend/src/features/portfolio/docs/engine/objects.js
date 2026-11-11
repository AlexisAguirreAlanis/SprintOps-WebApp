// Objetos del documento (imagen, forma, gráfico, diagrama, cuadro de texto, texto decorado, icono):
// render, ajuste de texto, transformaciones, orden, alineación, agrupación y efectos de imagen.

import { escapeHtml } from '../sanitize';
import { shapeInnerHtml, SHAPES } from '../render/shapes';
import { renderChartSvg } from '../render/charts';
import { renderDiagramSvg } from '../render/diagrams';
import { uid } from '../model';

export const OBJECT_SELECTOR = 'figure.wd-obj, img';

export const WRAP_MODES = {
  inline: 'En línea con el texto',
  square: 'Cuadrado',
  tight: 'Estrecho',
  through: 'Transparente',
  topbottom: 'Arriba y abajo',
  behind: 'Detrás del texto',
  front: 'Delante del texto',
};

export const WORDART_STYLES = {
  gradient: { label: 'Degradado', css: 'background:linear-gradient(90deg,#2f6f5e,#67bfa1,#f8c76b);-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:900' },
  outline: { label: 'Contorno', css: '-webkit-text-stroke:2px #2f6f5e;color:transparent;font-weight:900' },
  shadow: { label: 'Sombra', css: 'color:#1f4e43;text-shadow:3px 3px 0 #b7e4d4,6px 6px 0 rgba(15,23,42,.18);font-weight:900' },
  neon: { label: 'Neón', css: 'color:#fff;text-shadow:0 0 6px #67bfa1,0 0 14px #67bfa1,0 0 28px #2f6f5e;font-weight:800' },
  retro: { label: 'Retro', css: 'color:#f97316;text-shadow:2px 2px 0 #be123c,4px 4px 0 #1e293b;font-weight:900;font-style:italic' },
  emboss: { label: 'Relieve', css: 'color:#e2e8f0;text-shadow:-1px -1px 0 #fff,2px 2px 2px rgba(0,0,0,.45);font-weight:900' },
};

export function encodeSpec(spec) {
  return escapeHtml(JSON.stringify(spec));
}

export function readSpec(el) {
  try {
    return JSON.parse(el?.dataset?.spec || '{}');
  } catch {
    return {};
  }
}

export function innerFor(kind, spec, id) {
  if (kind === 'shape') return shapeInnerHtml(spec, id);
  if (kind === 'chart') return renderChartSvg(spec);
  if (kind === 'diagram') return renderDiagramSvg(spec);
  if (kind === 'icon') return `<div class="wd-icon-svg" style="color:${escapeHtml(spec.color || '#2f6f5e')}">${spec.svg || ''}</div>`;
  if (kind === 'wordart') return `<div class="wd-wordart" style="${WORDART_STYLES[spec.style]?.css || WORDART_STYLES.gradient.css};font-size:${Number(spec.size) || 48}px;font-family:${escapeHtml(spec.font || 'inherit')}">${escapeHtml(spec.text || 'Texto')}</div>`;
  if (kind === 'textbox') return `<div class="wd-textbox-body" contenteditable="true">${spec.html || '<p>Escribe aquí</p>'}</div>`;
  if (kind === 'signature') return `<div class="wd-signature"><div class="wd-signature-x">✕</div><div class="wd-signature-line"></div><strong>${escapeHtml(spec.name || 'Nombre')}</strong><span>${escapeHtml(spec.title || 'Cargo')}</span>${spec.email ? `<span>${escapeHtml(spec.email)}</span>` : ''}</div>`;
  if (kind === 'image') return `<img src="${escapeHtml(spec.src)}" alt="${escapeHtml(spec.alt || '')}" loading="lazy" decoding="async">`;
  return '';
}

export function objectHtml(kind, spec, { width = 240, height = 160, wrap = 'inline', extraStyle = '' } = {}) {
  const id = uid('o');
  const aspect = kind === 'shape' && SHAPES[spec.type]?.square ? ' data-lock-ratio="true"' : '';
  return `<figure class="wd-obj wd-${kind}" contenteditable="false" data-kind="${kind}" data-id="${id}" data-wrap="${wrap}" data-spec="${encodeSpec(spec)}"${aspect} style="width:${Math.round(width)}px;height:${Math.round(height)}px;${extraStyle}">${innerFor(kind, spec, id)}</figure>`;
}

export function updateObject(el, spec) {
  const kind = el.dataset.kind;
  el.dataset.spec = JSON.stringify(spec);
  const keepText = kind === 'textbox' ? el.querySelector('.wd-textbox-body')?.innerHTML : null;
  el.innerHTML = innerFor(kind, keepText ? { ...spec, html: keepText } : spec, el.dataset.id || uid('o'));
  applyTransform(el);
}

export function objectKind(el) {
  if (!el) return null;
  if (el.tagName === 'IMG') return 'image';
  return el.dataset.kind || null;
}

export function imageOf(el) {
  return el?.tagName === 'IMG' ? el : el?.querySelector?.('img');
}

/** Ajuste de texto. Detrás/delante usan posición absoluta dentro de la página; los demás se mueven con el texto. */
export function setWrap(el, mode, side = 'left') {
  const body = el.closest('[data-page-body]');
  const distance = Number(el.dataset.distance || 12);
  const rectBody = body?.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  const scale = body ? rectBody.width / (body.offsetWidth || 1) : 1;
  Object.assign(el.style, { position: '', left: '', top: '', float: '', zIndex: '', display: '', margin: '', shapeOutside: '', shapeMargin: '', clear: '' });
  el.dataset.wrap = mode;
  if (mode === 'behind' || mode === 'front') {
    Object.assign(el.style, {
      position: 'absolute',
      left: `${Math.round((rect.left - rectBody.left) / scale)}px`,
      top: `${Math.round((rect.top - rectBody.top) / scale)}px`,
      zIndex: mode === 'behind' ? '-1' : '5',
      margin: '0',
    });
  } else if (mode === 'square' || mode === 'tight' || mode === 'through') {
    el.style.float = side;
    el.style.margin = side === 'left' ? `0 ${distance}px ${distance}px 0` : `0 0 ${distance}px ${distance}px`;
    const img = imageOf(el);
    if (mode !== 'square' && img) {
      el.style.shapeOutside = `url("${img.src}")`;
      el.style.shapeMargin = `${Math.round(distance / 2)}px`;
    }
  } else if (mode === 'topbottom') {
    Object.assign(el.style, { display: 'block', clear: 'both', margin: `${distance}px auto` });
  } else {
    el.style.display = 'inline-block';
    el.style.margin = '0 4px';
  }
}

export function setDistance(el, distance) {
  el.dataset.distance = String(distance);
  if (el.dataset.wrap && el.dataset.wrap !== 'behind' && el.dataset.wrap !== 'front') setWrap(el, el.dataset.wrap, el.style.float || 'left');
}

export function applyTransform(el) {
  const rotate = Number(el.dataset.rotate || 0);
  const flipH = el.dataset.flipH === 'true' ? -1 : 1;
  const flipV = el.dataset.flipV === 'true' ? -1 : 1;
  el.style.transform = rotate || flipH < 0 || flipV < 0 ? `rotate(${rotate}deg) scale(${flipH}, ${flipV})` : '';
}

export function rotateBy(el, degrees) {
  el.dataset.rotate = String(((Number(el.dataset.rotate || 0) + degrees) % 360 + 360) % 360);
  applyTransform(el);
}

export function flip(el, axis) {
  const key = axis === 'h' ? 'flipH' : 'flipV';
  el.dataset[key] = el.dataset[key] === 'true' ? 'false' : 'true';
  applyTransform(el);
}

export const IMAGE_FILTERS = {
  none: { label: 'Sin filtro', css: '' },
  grayscale: { label: 'Escala de grises', css: 'grayscale(1)' },
  sepia: { label: 'Sepia', css: 'sepia(0.85)' },
  vivid: { label: 'Vívido', css: 'saturate(1.6) contrast(1.1)' },
  cool: { label: 'Frío', css: 'hue-rotate(190deg) saturate(1.1)' },
  warm: { label: 'Cálido', css: 'sepia(0.3) saturate(1.4) hue-rotate(-12deg)' },
  blur: { label: 'Desenfoque', css: 'blur(2px)' },
  invert: { label: 'Invertir', css: 'invert(1)' },
};

export function applyAdjustments(el) {
  const adj = readAdjust(el);
  const target = imageOf(el) || el;
  const filter = [
    adj.brightness !== 100 ? `brightness(${adj.brightness}%)` : '',
    adj.contrast !== 100 ? `contrast(${adj.contrast}%)` : '',
    adj.saturation !== 100 ? `saturate(${adj.saturation}%)` : '',
    IMAGE_FILTERS[adj.filter]?.css || '',
    adj.shadow ? 'drop-shadow(0 8px 14px rgba(15,23,42,.35))' : '',
    adj.glow ? `drop-shadow(0 0 10px ${adj.glow})` : '',
  ].filter(Boolean).join(' ');
  target.style.filter = filter;
  el.style.opacity = adj.opacity === 100 ? '' : String(adj.opacity / 100);
  el.style.webkitBoxReflect = adj.reflection ? 'below 4px linear-gradient(transparent 60%, rgba(255,255,255,.35))' : '';
  target.style.border = adj.border ? `${adj.borderWidth || 2}px solid ${adj.border}` : '';
  target.style.borderRadius = adj.radius ? `${adj.radius}px` : '';
  target.style.clipPath = CLIP_SHAPES[adj.clip]?.css || '';
}

export function readAdjust(el) {
  let data = {};
  try {
    data = JSON.parse(el.dataset.adjust || '{}');
  } catch {
    data = {};
  }
  return { brightness: 100, contrast: 100, saturation: 100, opacity: 100, filter: 'none', shadow: false, reflection: false, glow: '', border: '', borderWidth: 2, radius: 0, clip: 'none', ...data };
}

export function writeAdjust(el, patch) {
  el.dataset.adjust = JSON.stringify({ ...readAdjust(el), ...patch });
  applyAdjustments(el);
}

export const CLIP_SHAPES = {
  none: { label: 'Sin recorte', css: '' },
  circle: { label: 'Círculo', css: 'circle(50% at 50% 50%)' },
  ellipse: { label: 'Elipse', css: 'ellipse(50% 50% at 50% 50%)' },
  rounded: { label: 'Redondeado', css: 'inset(0 round 12%)' },
  triangle: { label: 'Triángulo', css: 'polygon(50% 0, 100% 100%, 0 100%)' },
  diamond: { label: 'Rombo', css: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)' },
  hexagon: { label: 'Hexágono', css: 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)' },
  star: { label: 'Estrella', css: 'polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' },
  arrow: { label: 'Flecha', css: 'polygon(0 30%, 60% 30%, 60% 0, 100% 50%, 60% 100%, 60% 70%, 0 70%)' },
};

export function setZ(el, mode) {
  const body = el.closest('[data-page-body]');
  const others = [...(body?.querySelectorAll('figure.wd-obj, img') || [])].map((item) => Number(item.style.zIndex || 0));
  const max = Math.max(1, ...others);
  const min = Math.min(0, ...others);
  if (el.style.position !== 'absolute') {
    el.style.position = 'relative';
  }
  if (mode === 'front') el.style.zIndex = String(max + 1);
  else if (mode === 'back') el.style.zIndex = String(min - 1);
  else if (mode === 'forward') el.style.zIndex = String(Number(el.style.zIndex || 0) + 1);
  else el.style.zIndex = String(Number(el.style.zIndex || 0) - 1);
}

function box(el) {
  return { el, x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
}

/** Alinea objetos con posición absoluta entre sí, o respecto a la página si hay uno solo. */
export function alignObjects(els, mode) {
  const items = els.map((el) => {
    if (el.style.position !== 'absolute') setWrap(el, 'front');
    return box(el);
  });
  if (!items.length) return;
  const body = items[0].el.closest('[data-page-body]');
  const bounds = items.length === 1
    ? { x: 0, y: 0, r: body.clientWidth, b: body.clientHeight }
    : { x: Math.min(...items.map((i) => i.x)), y: Math.min(...items.map((i) => i.y)), r: Math.max(...items.map((i) => i.x + i.w)), b: Math.max(...items.map((i) => i.y + i.h)) };
  items.forEach((item) => {
    if (mode === 'left') item.el.style.left = `${bounds.x}px`;
    if (mode === 'center') item.el.style.left = `${(bounds.x + bounds.r) / 2 - item.w / 2}px`;
    if (mode === 'right') item.el.style.left = `${bounds.r - item.w}px`;
    if (mode === 'top') item.el.style.top = `${bounds.y}px`;
    if (mode === 'middle') item.el.style.top = `${(bounds.y + bounds.b) / 2 - item.h / 2}px`;
    if (mode === 'bottom') item.el.style.top = `${bounds.b - item.h}px`;
  });
}

export function distributeObjects(els, axis) {
  if (els.length < 3) return;
  const items = els.map((el) => {
    if (el.style.position !== 'absolute') setWrap(el, 'front');
    return box(el);
  });
  const key = axis === 'h' ? 'x' : 'y';
  const size = axis === 'h' ? 'w' : 'h';
  items.sort((a, b) => a[key] - b[key]);
  const start = items[0][key];
  const end = items[items.length - 1][key] + items[items.length - 1][size];
  const used = items.reduce((sum, item) => sum + item[size], 0);
  const gap = (end - start - used) / (items.length - 1);
  let cursor = start;
  items.forEach((item) => {
    item.el.style[axis === 'h' ? 'left' : 'top'] = `${cursor}px`;
    cursor += item[size] + gap;
  });
}

export function groupObjects(els) {
  if (els.length < 2) return null;
  const body = els[0].closest('[data-page-body]');
  const items = els.map((el) => {
    if (el.style.position !== 'absolute') setWrap(el, 'front');
    return box(el);
  });
  const x = Math.min(...items.map((i) => i.x));
  const y = Math.min(...items.map((i) => i.y));
  const r = Math.max(...items.map((i) => i.x + i.w));
  const b = Math.max(...items.map((i) => i.y + i.h));
  const group = document.createElement('figure');
  group.className = 'wd-obj wd-group';
  group.contentEditable = 'false';
  group.dataset.kind = 'group';
  group.dataset.id = uid('o');
  group.dataset.wrap = 'front';
  Object.assign(group.style, { position: 'absolute', left: `${x}px`, top: `${y}px`, width: `${r - x}px`, height: `${b - y}px`, zIndex: '5', margin: '0' });
  items.forEach((item) => {
    item.el.style.left = `${item.x - x}px`;
    item.el.style.top = `${item.y - y}px`;
    item.el.style.zIndex = '';
    group.append(item.el);
  });
  body.append(group);
  return group;
}

export function ungroupObjects(group) {
  const x = group.offsetLeft;
  const y = group.offsetTop;
  const children = [...group.children];
  children.forEach((child) => {
    child.style.left = `${child.offsetLeft + x}px`;
    child.style.top = `${child.offsetTop + y}px`;
    child.style.zIndex = '5';
    group.before(child);
  });
  group.remove();
  return children;
}

// ---- Operaciones de imagen en canvas ----

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
    image.src = src;
  });
}

export async function cropImage(src, { top = 0, right = 0, bottom = 0, left = 0 }) {
  const image = await loadImage(src);
  const sx = (image.naturalWidth * left) / 100;
  const sy = (image.naturalHeight * top) / 100;
  const sw = image.naturalWidth * (1 - (left + right) / 100);
  const sh = image.naturalHeight * (1 - (top + bottom) / 100);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw));
  canvas.height = Math.max(1, Math.round(sh));
  canvas.getContext('2d').drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return { src: canvas.toDataURL('image/png'), ratio: canvas.height / canvas.width };
}

export async function compressImage(src, maxSide = 1400, quality = 0.72) {
  const image = await loadImage(src);
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Quita el fondo por inundación desde los bordes, usando el color de las esquinas como referencia. */
export async function removeBackground(src, tolerance = 42) {
  const image = await loadImage(src);
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { width, height } = canvas;
  const px = data.data;
  const seen = new Uint8Array(width * height);
  const stack = [];
  const corners = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
  const refs = corners.map(([x, y]) => { const i = (y * width + x) * 4; return [px[i], px[i + 1], px[i + 2]]; });
  const close = (i) => refs.some(([r, g, b]) => Math.abs(px[i] - r) + Math.abs(px[i + 1] - g) + Math.abs(px[i + 2] - b) < tolerance * 3);
  for (let x = 0; x < width; x += 1) { stack.push(x, (height - 1) * width + x); }
  for (let y = 0; y < height; y += 1) { stack.push(y * width, y * width + width - 1); }
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    if (!close(i)) continue;
    px[i + 3] = 0;
    const x = p % width;
    if (x > 0) stack.push(p - 1);
    if (x < width - 1) stack.push(p + 1);
    if (p >= width) stack.push(p - width);
    if (p < width * (height - 1)) stack.push(p + width);
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL('image/png');
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}
