// El documento (schemaVersion 1) no depende del render.
// Konva dibuja la escena: React Flow ya está en el proyecto, pero modela grafos,
// no un lienzo libre con rotación, selección y texto. Fabric encaja peor con React 19.

export const SCHEMA_VERSION = 1;

const INK = '#1e293b';
const MINT = '#b7e4d4';
const DEEP = '#2f6f5e';
const SAND = '#f6f1e8';
const LILAC = '#e3d4f6';
const YELLOW = '#f8e7a2';
const BLUE = '#d3eaf8';
const CORAL = '#f6d0c4';
const WHITE = '#ffffff';

let serial = 0;

export function createId() {
  serial += 1;
  return `el_${Date.now().toString(36)}_${serial.toString(36)}`;
}

export function createElement(partial) {
  return {
    id: createId(),
    type: 'rect',
    name: 'Rectángulo',
    x: 120,
    y: 120,
    width: 180,
    height: 110,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    fill: WHITE,
    stroke: 'transparent',
    strokeWidth: 0,
    radius: 16,
    text: '',
    textFill: '',
    fontSize: 16,
    fontWeight: 600,
    fontStyle: 'normal',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    align: 'center',
    points: null,
    ...partial,
  };
}

export function emptyDocument() {
  return { schemaVersion: SCHEMA_VERSION, elements: [], viewport: null };
}

export function parseDocument(raw) {
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }
  const elements = Array.isArray(data?.elements) ? data.elements.map(normalizeElement) : [];
  const viewport = data?.viewport && Number.isFinite(data.viewport.scale) ? data.viewport : null;
  return { schemaVersion: SCHEMA_VERSION, elements, viewport };
}

export function serializeDocument(elements, viewport) {
  return JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    elements,
    viewport: viewport
      ? { x: round(viewport.x), y: round(viewport.y), scale: round(viewport.scale) }
      : null,
  });
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function normalizeElement(raw) {
  return createElement({
    ...raw,
    id: raw?.id || createId(),
    points: Array.isArray(raw?.points) ? raw.points.map(Number) : null,
  });
}

export function textColor(element) {
  if (element.textFill) return element.textFill;
  if (element.type === 'text') return element.fill || INK;
  return INK;
}

export function isArrow(element) {
  return element?.type === 'line'
    && !element.closed
    && !element.brush
    && Array.isArray(element.points)
    && element.points.length === 4;
}

export function defaultBend(points) {
  const length = Math.hypot((points?.[2] || 0) - (points?.[0] || 0), (points?.[3] || 0) - (points?.[1] || 0));
  return Math.max(36, Math.min(140, length * 0.35));
}

function controlPoint(points, bend) {
  const [x1, y1, x2, y2] = points;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  return {
    x: (x1 + x2) / 2 + (-dy / length) * bend,
    y: (y1 + y2) / 2 + (dx / length) * bend,
  };
}

export function bendFromPoint(points, x, y) {
  const [x1, y1, x2, y2] = points;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  const px = -dy / length;
  const py = dx / length;
  return (x - (x1 + x2) / 2) * px + (y - (y1 + y2) / 2) * py;
}

export function arrowPath(element) {
  const [x1, y1, x2, y2] = element.points;
  const route = element.route || 'straight';
  if (route === 'elbow') {
    const mid = (x1 + x2) / 2;
    return { points: [x1, y1, mid, y1, mid, y2, x2, y2], tension: 0 };
  }
  if (route === 'curve') {
    const bend = Number.isFinite(element.bend) ? element.bend : defaultBend(element.points);
    const control = controlPoint(element.points, bend);
    return { points: [x1, y1, control.x, control.y, x2, y2], tension: 0.55, control };
  }
  return { points: [x1, y1, x2, y2], tension: 0 };
}

export function elementBounds(element) {
  if (element.type === 'line' && Array.isArray(element.points) && element.points.length >= 2) {
    const local = isArrow(element) ? arrowPath(element).points : element.points;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let index = 0; index < local.length; index += 2) {
      const x = element.x + local[index];
      const y = element.y + local[index + 1];
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
  }
  return { x: element.x, y: element.y, width: element.width, height: element.height };
}

export function sceneBounds(elements) {
  const visible = elements.filter((element) => element.visible !== false);
  if (visible.length === 0) return null;
  const boxes = visible.map(elementBounds);
  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x, y, width: right - x, height: bottom - y };
}

export function intersects(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function cloneElement(element, offset = 0) {
  return {
    ...element,
    id: createId(),
    x: element.x + offset,
    y: element.y + offset,
    points: element.points ? [...element.points] : null,
  };
}

export function alignElements(elements, ids, mode) {
  const selected = elements.filter((element) => ids.includes(element.id));
  if (selected.length < 2) return elements;
  const boxes = selected.map((element) => ({ element, box: elementBounds(element) }));
  const left = Math.min(...boxes.map((item) => item.box.x));
  const top = Math.min(...boxes.map((item) => item.box.y));
  const right = Math.max(...boxes.map((item) => item.box.x + item.box.width));
  const bottom = Math.max(...boxes.map((item) => item.box.y + item.box.height));
  const midX = (left + right) / 2;
  const midY = (top + bottom) / 2;
  const next = new Map(selected.map((element) => [element.id, { ...element }]));
  boxes.forEach(({ element, box }) => {
    const copy = next.get(element.id);
    if (mode === 'left') copy.x += left - box.x;
    if (mode === 'right') copy.x += right - (box.x + box.width);
    if (mode === 'center') copy.x += midX - (box.x + box.width / 2);
    if (mode === 'top') copy.y += top - box.y;
    if (mode === 'bottom') copy.y += bottom - (box.y + box.height);
    if (mode === 'middle') copy.y += midY - (box.y + box.height / 2);
  });
  return elements.map((element) => next.get(element.id) || element);
}

function box(x, y, width, height, text, fill, extra = {}) {
  return createElement({
    name: text || 'Bloque',
    x,
    y,
    width,
    height,
    text,
    fill,
    ...extra,
  });
}

function link(x1, y1, x2, y2) {
  return createElement({
    type: 'line',
    name: 'Flecha',
    route: 'straight',
    x: x1,
    y: y1,
    width: 1,
    height: 1,
    points: [0, 0, x2 - x1, y2 - y1],
    stroke: INK,
    strokeWidth: 2,
    fill: 'transparent',
    text: '',
  });
}

const TEMPLATES = [
  { id: 'blank', name: 'Lienzo en blanco', build: () => [] },
  {
    id: 'mindmap',
    name: 'Mapa mental',
    build: () => [
      createElement({ type: 'ellipse', name: 'Idea central', x: 430, y: 250, width: 220, height: 120, text: 'Idea central', fill: MINT, fontSize: 20 }),
      box(120, 120, 180, 80, 'Tema 1', SAND),
      box(780, 120, 180, 80, 'Tema 2', LILAC),
      box(120, 420, 180, 80, 'Tema 3', BLUE),
      box(780, 420, 180, 80, 'Tema 4', CORAL),
      link(300, 160, 430, 280),
      link(780, 160, 650, 280),
      link(300, 460, 430, 340),
      link(780, 460, 650, 340),
    ],
  },
  {
    id: 'journey',
    name: 'User Journey',
    build: () => ['Descubrir', 'Considerar', 'Probar', 'Quedarse'].map((label, index) => box(80 + index * 230, 160, 200, 260, label, index % 2 ? BLUE : SAND, { align: 'center', fontSize: 18 })),
  },
  {
    id: 'wireframes',
    name: 'Wireframes',
    build: () => [
      box(80, 80, 760, 480, '', WHITE, { name: 'Pantalla', stroke: INK, strokeWidth: 2, radius: 20 }),
      box(110, 110, 700, 56, 'Barra', SAND, { fontSize: 14 }),
      box(110, 190, 200, 320, 'Menú', LILAC),
      box(330, 190, 480, 140, 'Contenido', BLUE),
      box(330, 350, 480, 160, 'Detalle', MINT),
    ],
  },
  {
    id: 'roadmap',
    name: 'Roadmap',
    build: () => [
      box(80, 140, 220, 70, 'Ahora', MINT),
      box(340, 140, 260, 70, 'Siguiente', YELLOW),
      box(640, 140, 240, 70, 'Después', LILAC),
      box(80, 260, 180, 54, 'Investigar', WHITE, { stroke: INK, strokeWidth: 1.5, fontSize: 14 }),
      box(280, 260, 180, 54, 'Diseñar', WHITE, { stroke: INK, strokeWidth: 1.5, fontSize: 14 }),
      box(480, 260, 180, 54, 'Construir', WHITE, { stroke: INK, strokeWidth: 1.5, fontSize: 14 }),
      box(680, 260, 180, 54, 'Medir', WHITE, { stroke: INK, strokeWidth: 1.5, fontSize: 14 }),
    ],
  },
  {
    id: 'brainstorm',
    name: 'Lluvia de ideas',
    build: () => ['Notar', 'Agrupar', 'Priorizar', 'Probar', 'Medir', 'Aprender'].map((label, index) => box(
      90 + (index % 3) * 230,
      100 + Math.floor(index / 3) * 170,
      190,
      130,
      label,
      [YELLOW, CORAL, BLUE, LILAC, MINT, SAND][index],
      { radius: 8, fontSize: 18 },
    )),
  },
  {
    id: 'architecture',
    name: 'Arquitectura de software',
    build: () => [
      box(360, 60, 200, 70, 'Cliente', BLUE),
      box(360, 210, 200, 70, 'API', MINT),
      box(120, 380, 200, 70, 'Base de datos', SAND),
      box(600, 380, 200, 70, 'Archivos', LILAC),
      link(460, 130, 460, 210),
      link(400, 280, 220, 380),
      link(520, 280, 700, 380),
    ],
  },
  {
    id: 'flow',
    name: 'Diagrama de flujo',
    build: () => [
      createElement({ type: 'ellipse', name: 'Inicio', x: 360, y: 60, width: 180, height: 80, text: 'Inicio', fill: MINT }),
      box(340, 200, 220, 80, '¿Listo?', YELLOW),
      box(340, 360, 220, 80, 'Continuar', BLUE),
      link(450, 140, 450, 200),
      link(450, 280, 450, 360),
    ],
  },
  {
    id: 'presentation',
    name: 'Presentación',
    build: () => [
      createElement({ type: 'frame', name: 'Diapositiva', x: 80, y: 80, width: 960, height: 540, text: '', fill: WHITE, stroke: INK, strokeWidth: 2, radius: 18 }),
      createElement({ type: 'text', name: 'Título', x: 140, y: 180, width: 760, height: 80, text: 'Título de la presentación', fill: INK, fontSize: 42, fontWeight: 800, align: 'left' }),
      createElement({ type: 'text', name: 'Subtítulo', x: 140, y: 280, width: 640, height: 50, text: 'Una idea, en una hoja.', fill: DEEP, fontSize: 22, fontWeight: 500, align: 'left' }),
    ],
  },
  {
    id: 'moodboard',
    name: 'Moodboard',
    build: () => [
      box(60, 60, 280, 220, '', MINT, { name: 'Color', text: '' }),
      box(360, 60, 180, 140, '', CORAL, { text: '' }),
      box(560, 60, 240, 300, '', LILAC, { text: '' }),
      box(60, 300, 180, 180, 'Tipo', SAND, { fontSize: 22 }),
      box(260, 220, 280, 260, 'Textura', YELLOW, { text: '' }),
    ],
  },
  {
    id: 'ui',
    name: 'Diseño de interfaces',
    build: () => [
      createElement({ type: 'frame', name: 'Teléfono', x: 180, y: 40, width: 280, height: 560, fill: WHITE, stroke: INK, strokeWidth: 3, radius: 36, text: '' }),
      box(200, 80, 240, 48, 'Inicio', MINT, { radius: 14, fontSize: 14 }),
      box(200, 148, 240, 120, 'Card', SAND, { radius: 16 }),
      box(200, 284, 240, 120, 'Card', BLUE, { radius: 16 }),
      box(200, 500, 240, 56, 'Acción', DEEP, { radius: 16, textFill: '#ffffff' }),
    ],
  },
];

export function buildTemplate(templateId) {
  const template = TEMPLATES.find((item) => item.id === templateId) || TEMPLATES[0];
  return template.build();
}

export function listTemplates() {
  return TEMPLATES.map((template) => ({
    id: template.id,
    name: template.name,
    elements: template.build(),
  }));
}

export function templateDocument(templateId) {
  const template = TEMPLATES.find((item) => item.id === templateId) || TEMPLATES[0];
  return {
    name: template.name,
    document: serializeDocument(template.build(), null),
  };
}

export function editedLabel(iso) {
  if (!iso) return 'Sin cambios';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'Sin cambios';
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return 'Editado ahora';
  if (minutes < 60) return `Editado hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Editado hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Editado ayer';
  if (days < 30) return `Editado hace ${days} días`;
  return `Editado el ${new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(new Date(iso))}`;
}
