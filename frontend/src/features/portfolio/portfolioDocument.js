// El documento (schemaVersion 1) no depende del render.
// Konva dibuja la escena: React Flow ya está en el proyecto, pero modela grafos,
// no un lienzo libre con rotación, selección y texto. Fabric encaja peor con React 19.

import {
  arrowPath,
  bendFromPoint,
  cornerRadius,
  defaultBend,
  isConnector,
  syncConnectors,
} from './connectorGeometry';
import { normalizeDocModel } from './docs/model';
import { DOC_TEMPLATES } from './docs/docTemplates';

export {
  arrowPath,
  bendFromPoint,
  cornerRadius,
  defaultBend,
  isConnector,
  syncConnectors,
};

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
    radius: 0,
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

export const SLIDE_SIZE = { width: 1280, height: 720 };

export const TEMPLATE_GROUPS = [
  { id: 'foryou', label: 'Para ti' },
  { id: 'diagrams', label: 'Diagramas' },
  { id: 'slides', label: 'Presentaciones' },
  { id: 'documents', label: 'Documentos' },
  { id: 'interfaces', label: 'Interfaces' },
  { id: 'ideas', label: 'Ideación' },
];

export function emptyDocument() {
  return { schemaVersion: SCHEMA_VERSION, kind: 'canvas', elements: [], viewport: null, slides: null, doc: null };
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
  const kind = data?.kind === 'slides' || data?.kind === 'document' ? data.kind : 'canvas';
  return {
    schemaVersion: SCHEMA_VERSION,
    kind,
    elements,
    viewport,
    slides: kind === 'slides' ? normalizeSlides(data?.slides) : null,
    slideSize: {
      width: Number(data?.slideSize?.width) || SLIDE_SIZE.width,
      height: Number(data?.slideSize?.height) || SLIDE_SIZE.height,
    },
    doc: kind === 'document' ? normalizeDoc(data?.doc) : null,
  };
}

export function serializeDocument(elements, viewport) {
  if (isStudioSource(elements)) {
    const source = elements;
    const kind = source.kind === 'slides' || source.kind === 'document' ? source.kind : 'canvas';
    const body = {
      schemaVersion: SCHEMA_VERSION,
      kind,
      elements: kind === 'document'
        ? documentThumb(source.doc)
        : (kind === 'slides' ? (source.slides?.[0]?.elements || []) : (source.elements || [])),
      viewport: packViewport(source.viewport),
    };
    if (kind === 'slides') {
      body.slides = source.slides || [];
      body.slideSize = source.slideSize || SLIDE_SIZE;
    }
    if (kind === 'document') body.doc = normalizeDoc(source.doc);
    return JSON.stringify(body);
  }
  return JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    kind: 'canvas',
    elements: Array.isArray(elements) ? elements : [],
    viewport: packViewport(viewport),
  });
}

function isStudioSource(value) {
  return Boolean(value) && !Array.isArray(value) && typeof value === 'object' && ('kind' in value || 'slides' in value || 'doc' in value);
}

function packViewport(viewport) {
  if (!viewport || !Number.isFinite(viewport.scale)) return null;
  return { x: round(viewport.x), y: round(viewport.y), scale: round(viewport.scale) };
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function normalizeSlides(raw) {
  const slides = Array.isArray(raw) ? raw : [];
  const normalized = slides.map((slide, index) => ({
    id: slide?.id || createId(),
    name: slide?.name || `Diapositiva ${index + 1}`,
    background: slide?.background || '#ffffff',
    elements: Array.isArray(slide?.elements) ? slide.elements.map(normalizeElement) : [],
  }));
  if (normalized.length === 0) {
    normalized.push({ id: createId(), name: 'Diapositiva 1', background: '#ffffff', elements: [] });
  }
  return normalized;
}

function normalizeDoc(raw) {
  return normalizeDocModel(raw, createId);
}

function plainText(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function documentThumb(doc) {
  const model = normalizeDoc(doc);
  const text = plainText(model.pages.map((page) => page.html).join(' '));
  const title = (text.split(' ').slice(0, 4).join(' ') || 'Documento').slice(0, 28);
  const lines = [];
  for (let index = 0; index < 6; index += 1) {
    lines.push(createElement({
      type: 'rect',
      name: 'Línea',
      x: 36,
      y: 92 + index * 22,
      width: index === 5 ? 110 : 168,
      height: 7,
      radius: 4,
      fill: index === 0 ? '#67bfa1' : '#e6eef2',
      text: '',
    }));
  }
  return [
    createElement({ type: 'rect', name: 'Hoja', x: 16, y: 8, width: 208, height: 276, fill: '#ffffff', stroke: '#e5e7eb', strokeWidth: 1, radius: 8, text: '' }),
    createElement({ type: 'text', name: 'Título', x: 36, y: 32, width: 168, height: 44, text: title, textFill: INK, fill: 'transparent', fontSize: 16, fontWeight: 800, align: 'left' }),
    ...lines,
  ];
}

function slide(background, elements, name) {
  return { id: createId(), name: name || 'Diapositiva', background: background || '#ffffff', elements };
}

function titleBlock(text, x, y, width, height, extra) {
  return createElement({
    type: 'text',
    name: 'Texto',
    x,
    y,
    width,
    height,
    text,
    fill: INK,
    fontSize: 28,
    fontWeight: 700,
    align: 'left',
    ...extra,
  });
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
  return isConnector(element);
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
    kind: 'slides',
    category: 'slides',
    featured: true,
    popular: true,
    blurb: 'Diapositivas 16:9, una por vez.',
    buildSlides: () => [
      slide('#ffffff', [
        createElement({ type: 'rect', x: 0, y: 0, width: 16, height: 720, fill: DEEP, text: '' }),
        titleBlock('Título de la presentación', 72, 230, 1000, 110, { fontSize: 60, fontWeight: 800 }),
        titleBlock('Una idea, en una diapositiva.', 72, 360, 860, 56, { fontSize: 26, fontWeight: 500, fill: DEEP }),
      ], 'Portada'),
      slide('#ffffff', [
        titleBlock('Agenda', 72, 64, 800, 70, { fontSize: 44, fontWeight: 800 }),
        titleBlock('01   Contexto', 72, 200, 900, 56, { fontSize: 28, fontWeight: 650 }),
        titleBlock('02   Propuesta', 72, 280, 900, 56, { fontSize: 28, fontWeight: 650 }),
        titleBlock('03   Siguiente paso', 72, 360, 900, 56, { fontSize: 28, fontWeight: 650 }),
      ], 'Agenda'),
      slide(DEEP, [
        titleBlock('Gracias', 72, 260, 1000, 100, { fontSize: 64, fontWeight: 800, fill: '#ffffff' }),
        titleBlock('Preguntas y siguiente paso.', 72, 380, 800, 50, { fontSize: 24, fontWeight: 500, fill: MINT }),
      ], 'Cierre'),
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
  {
    id: 'slides-blank',
    name: 'Presentación en blanco',
    kind: 'slides',
    category: 'slides',
    strip: false,
    blurb: 'Una diapositiva vacía, lista para presentar.',
    buildSlides: () => [slide('#ffffff', [], 'Diapositiva 1')],
  },
  {
    id: 'slides-pitch',
    name: 'Pitch',
    kind: 'slides',
    category: 'slides',
    featured: true,
    popular: true,
    strip: false,
    blurb: 'Problema, propuesta y pedido.',
    buildSlides: () => [
      slide('#ffffff', [
        titleBlock('El problema', 72, 80, 1000, 80, { fontSize: 48, fontWeight: 800 }),
        titleBlock('A quién le duele y qué cuesta hoy no resolverlo.', 72, 190, 980, 80, { fontSize: 26, fontWeight: 500, fill: DEEP }),
      ]),
      slide('#ffffff', [
        titleBlock('La propuesta', 72, 80, 1000, 80, { fontSize: 48, fontWeight: 800 }),
        createElement({ type: 'rect', x: 72, y: 220, width: 340, height: 360, fill: MINT, radius: 18, text: 'Qué hacemos', fontSize: 22, fontWeight: 700 }),
        createElement({ type: 'rect', x: 440, y: 220, width: 340, height: 360, fill: SAND, radius: 18, text: 'Cómo', fontSize: 22, fontWeight: 700 }),
        createElement({ type: 'rect', x: 808, y: 220, width: 400, height: 360, fill: BLUE, radius: 18, text: 'Por qué ahora', fontSize: 22, fontWeight: 700 }),
      ]),
      slide('#fffaf3', [
        titleBlock('El pedido', 72, 240, 1000, 90, { fontSize: 52, fontWeight: 800 }),
        titleBlock('Qué decisión necesitamos en esta reunión.', 72, 350, 900, 60, { fontSize: 26, fontWeight: 500 }),
      ]),
    ],
  },
  {
    id: 'slides-class',
    name: 'Clase',
    kind: 'slides',
    category: 'slides',
    strip: false,
    blurb: 'Objetivo, explicación y ejercicio.',
    buildSlides: () => [
      slide('#ffffff', [
        createElement({ type: 'rect', x: 0, y: 600, width: 1280, height: 120, fill: MINT, text: '' }),
        titleBlock('Tema de la clase', 72, 220, 1000, 90, { fontSize: 54, fontWeight: 800 }),
        titleBlock('Sesión  ·  45 min', 72, 330, 600, 48, { fontSize: 22, fontWeight: 600, fill: DEEP }),
      ]),
      slide('#ffffff', [
        titleBlock('Al terminar vas a poder…', 72, 64, 1100, 70, { fontSize: 40, fontWeight: 800 }),
        titleBlock('1.  Explicar la idea con tus palabras.', 88, 200, 1000, 56, { fontSize: 26, fontWeight: 600 }),
        titleBlock('2.  Aplicarla en un ejemplo.', 88, 280, 1000, 56, { fontSize: 26, fontWeight: 600 }),
        titleBlock('3.  Saber qué practicar después.', 88, 360, 1000, 56, { fontSize: 26, fontWeight: 600 }),
      ]),
      slide('#ffffff', [
        titleBlock('Ejercicio', 72, 64, 800, 70, { fontSize: 44, fontWeight: 800 }),
        titleBlock('En parejas, 8 minutos. Una persona explica y la otra pregunta.', 72, 180, 1000, 100, { fontSize: 26, fontWeight: 500 }),
      ]),
    ],
  },
  {
    id: 'slides-sprint',
    name: 'Informe de sprint',
    kind: 'slides',
    category: 'slides',
    popular: true,
    strip: false,
    blurb: 'Cierre de sprint para el equipo.',
    buildSlides: () => [
      slide('#ffffff', [
        titleBlock('Sprint', 72, 220, 800, 90, { fontSize: 64, fontWeight: 800 }),
        titleBlock('Qué salió, qué sigue y qué aprendimos.', 72, 330, 900, 56, { fontSize: 24, fontWeight: 500, fill: DEEP }),
      ]),
      slide('#ffffff', [
        titleBlock('Hecho', 72, 56, 500, 60, { fontSize: 36, fontWeight: 800 }),
        titleBlock('Siguiente', 680, 56, 500, 60, { fontSize: 36, fontWeight: 800 }),
        createElement({ type: 'rect', x: 72, y: 150, width: 540, height: 480, fill: MINT, radius: 16, text: '' }),
        createElement({ type: 'rect', x: 668, y: 150, width: 540, height: 480, fill: SAND, radius: 16, text: '' }),
      ]),
    ],
  },
  {
    id: 'doc-blank',
    name: 'Documento en blanco',
    kind: 'document',
    category: 'documents',
    featured: true,
    strip: true,
    blurb: 'Página tamaño carta, como un procesador de texto.',
    buildDoc: () => ({
      pageSize: 'letter',
      margin: 72,
      header: '',
      footer: '',
      pageNumbers: true,
      pages: [{ id: 'page-1', html: '<p><br></p>' }],
    }),
  },
  {
    id: 'doc-report',
    name: 'Informe',
    kind: 'document',
    category: 'documents',
    featured: true,
    popular: true,
    strip: false,
    blurb: 'Resumen, hallazgos y siguiente paso.',
    buildDoc: () => docPages(`
      <h1>Informe</h1>
      <p>Resumen para quien tiene un minuto.</p>
      <h2>Contexto</h2>
      <p>Qué ocurrió, a quién afecta y por qué se escribe este informe.</p>
      <h2>Hallazgos</h2>
      <ul><li>Primer hallazgo, con el dato que lo sostiene.</li><li>Segundo hallazgo.</li><li>Riesgo o límite de lo que sabemos.</li></ul>
      <h2>Siguiente paso</h2>
      <p>La decisión, quién la toma y para cuándo.</p>
    `),
  },
  {
    id: 'doc-minutes',
    name: 'Acta de reunión',
    kind: 'document',
    category: 'documents',
    popular: true,
    strip: false,
    blurb: 'Asistentes, temas, acuerdos y pendientes.',
    buildDoc: () => docPages(`
      <h1>Acta de reunión</h1>
      <p><strong>Fecha:</strong> </p>
      <p><strong>Asistentes:</strong> </p>
      <h2>Temas</h2>
      <ol><li>Primer tema y la conclusión.</li><li>Segundo tema.</li></ol>
      <h2>Acuerdos</h2>
      <ul><li>Qué se decidió.</li></ul>
      <h2>Pendientes</h2>
      <table><tbody>
        <tr><th>Acción</th><th>Responsable</th><th>Fecha</th></tr>
        <tr><td><br></td><td><br></td><td><br></td></tr>
        <tr><td><br></td><td><br></td><td><br></td></tr>
      </tbody></table>
    `),
  },
  {
    id: 'doc-proposal',
    name: 'Propuesta de proyecto',
    kind: 'document',
    category: 'documents',
    strip: false,
    blurb: 'Problema, alcance, plan y pedido.',
    buildDoc: () => docPages(`
      <h1>Propuesta</h1>
      <p>Para quién es y qué se pide aprobar.</p>
      <h2>Problema</h2>
      <p>La situación actual y el costo de dejarla igual.</p>
      <h2>Alcance</h2>
      <ul><li>Qué incluye.</li><li>Qué queda fuera.</li></ul>
      <h2>Plan</h2>
      <ol><li>Primera entrega.</li><li>Segunda entrega.</li></ol>
      <h2>Pedido</h2>
      <p>La decisión concreta y la fecha.</p>
    `),
  },
  {
    id: 'doc-spec',
    name: 'Especificación',
    kind: 'document',
    category: 'documents',
    strip: false,
    blurb: 'Objetivo, reglas y criterios de aceptación.',
    buildDoc: () => docPages(`
      <h1>Especificación</h1>
      <p><strong>Estado:</strong> Borrador</p>
      <h2>Objetivo</h2>
      <p>Qué tiene que lograr quien usa esto.</p>
      <h2>Reglas</h2>
      <ol><li>La regla principal.</li><li>El caso límite.</li></ol>
      <h2>Criterios de aceptación</h2>
      <ul><li>Dado un caso, cuando pasa esto, se espera aquello.</li></ul>
      <h2>Fuera de alcance</h2>
      <p>Lo que esta versión no cubre.</p>
    `),
  },
  ...DOC_TEMPLATES,
];

const TEMPLATE_META = {
  blank: { category: 'diagrams', featured: true, blurb: 'Un lienzo vacío para diagramar con libertad.', strip: true },
  mindmap: { category: 'diagrams', featured: true, popular: true, blurb: 'Una idea al centro y ramas alrededor.', strip: true },
  journey: { category: 'interfaces', popular: true, blurb: 'El recorrido de una persona, de punta a punta.', strip: true },
  wireframes: { category: 'interfaces', featured: true, blurb: 'La estructura de una pantalla, sin estilo final.', strip: true },
  roadmap: { category: 'diagrams', popular: true, blurb: 'Ahora, siguiente y después.', strip: true },
  brainstorm: { category: 'ideas', blurb: 'Notas para sacar ideas y agruparlas.', strip: true },
  architecture: { category: 'diagrams', blurb: 'Cliente, servicio y datos.', strip: true },
  flow: { category: 'diagrams', featured: true, popular: true, blurb: 'Decisiones y pasos de un proceso.', strip: true },
  moodboard: { category: 'ideas', popular: true, blurb: 'Color, tipo y referencias en una sola hoja.', strip: true },
  ui: { category: 'interfaces', blurb: 'Una pantalla de teléfono para probar la interfaz.', strip: true },
};

function docPages(html) {
  return {
    pageSize: 'letter',
    margin: 72,
    header: '',
    footer: '',
    pageNumbers: true,
    pages: [{ id: 'page-1', html }],
  };
}

function templateById(templateId) {
  return TEMPLATES.find((item) => item.id === templateId) || TEMPLATES[0];
}

function describeTemplate(template) {
  const meta = TEMPLATE_META[template.id] || {};
  const kind = template.kind || 'canvas';
  const described = {
    id: template.id,
    name: template.name,
    kind,
    category: template.category || meta.category || 'diagrams',
    blurb: template.blurb || meta.blurb || '',
    featured: Boolean(template.featured ?? meta.featured),
    popular: Boolean(template.popular ?? meta.popular),
    strip: template.strip !== false && meta.strip !== false,
    elements: [],
  };
  if (kind === 'slides') {
    described.elements = template.buildSlides()[0]?.elements || [];
  } else if (kind === 'document') {
    described.elements = documentThumb(template.buildDoc());
  } else {
    described.elements = template.build();
  }
  return described;
}

export function buildTemplate(templateId) {
  const template = templateById(templateId);
  if (template.kind === 'slides' || template.kind === 'document' || !template.build) return [];
  return template.build();
}

export function listTemplates() {
  return TEMPLATES.filter((item) => !item.kind || item.kind === 'canvas').map(describeTemplate);
}

export function listStripTemplates() {
  return TEMPLATES.map(describeTemplate).filter((item) => item.strip);
}

export function listTemplateCatalog() {
  return TEMPLATES.map(describeTemplate);
}

export function templateDocument(templateId) {
  const template = templateById(templateId);
  if (template.kind === 'slides') {
    const slides = template.buildSlides();
    return {
      name: template.name,
      document: serializeDocument({ kind: 'slides', slides, slideSize: SLIDE_SIZE }),
    };
  }
  if (template.kind === 'document') {
    return {
      name: template.name,
      document: serializeDocument({ kind: 'document', doc: template.buildDoc() }),
    };
  }
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
