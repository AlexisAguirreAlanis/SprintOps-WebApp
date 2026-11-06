// Formas vectoriales en una caja 100x100. Se estiran al tamaño del objeto (preserveAspectRatio="none").

import { escapeHtml } from '../sanitize';

const poly = (points) => ({ tag: 'polygon', attrs: { points } });
const path = (d, open = false) => ({ tag: 'path', attrs: { d }, open });

export const SHAPES = {
  rect: { label: 'Rectángulo', group: 'Básicas', el: { tag: 'rect', attrs: { x: 1, y: 1, width: 98, height: 98 } } },
  rounded: { label: 'Rect. redondeado', group: 'Básicas', el: { tag: 'rect', attrs: { x: 1, y: 1, width: 98, height: 98, rx: 16 } } },
  circle: { label: 'Círculo', group: 'Básicas', square: true, el: { tag: 'ellipse', attrs: { cx: 50, cy: 50, rx: 49, ry: 49 } } },
  ellipse: { label: 'Elipse', group: 'Básicas', el: { tag: 'ellipse', attrs: { cx: 50, cy: 50, rx: 49, ry: 49 } } },
  triangle: { label: 'Triángulo', group: 'Básicas', el: poly('50,2 98,98 2,98') },
  rtriangle: { label: 'Triángulo rectángulo', group: 'Básicas', el: poly('2,2 98,98 2,98') },
  diamond: { label: 'Rombo', group: 'Básicas', el: poly('50,1 99,50 50,99 1,50') },
  pentagon: { label: 'Pentágono', group: 'Polígonos', el: poly('50,2 98,38 80,98 20,98 2,38') },
  hexagon: { label: 'Hexágono', group: 'Polígonos', el: poly('25,3 75,3 99,50 75,97 25,97 1,50') },
  octagon: { label: 'Octágono', group: 'Polígonos', el: poly('30,1 70,1 99,30 99,70 70,99 30,99 1,70 1,30') },
  parallelogram: { label: 'Paralelogramo', group: 'Polígonos', el: poly('22,2 99,2 78,98 1,98') },
  trapezoid: { label: 'Trapecio', group: 'Polígonos', el: poly('22,2 78,2 99,98 1,98') },
  star5: { label: 'Estrella 5', group: 'Estrellas', square: true, el: poly('50,2 61,37 98,37 68,59 79,96 50,74 21,96 32,59 2,37 39,37') },
  star6: { label: 'Estrella 6', group: 'Estrellas', square: true, el: poly('50,1 62,27 93,25 75,50 93,75 62,73 50,99 38,73 7,75 25,50 7,25 38,27') },
  star8: { label: 'Explosión', group: 'Estrellas', square: true, el: poly('50,1 58,24 80,10 74,35 99,38 79,54 94,76 68,72 64,99 50,78 36,99 32,72 6,76 21,54 1,38 26,35 20,10 42,24') },
  arrowRight: { label: 'Flecha derecha', group: 'Flechas', el: poly('1,30 60,30 60,4 99,50 60,96 60,70 1,70') },
  arrowLeft: { label: 'Flecha izquierda', group: 'Flechas', el: poly('99,30 40,30 40,4 1,50 40,96 40,70 99,70') },
  arrowUp: { label: 'Flecha arriba', group: 'Flechas', el: poly('30,99 30,40 4,40 50,1 96,40 70,40 70,99') },
  arrowDown: { label: 'Flecha abajo', group: 'Flechas', el: poly('30,1 30,60 4,60 50,99 96,60 70,60 70,1') },
  arrowBoth: { label: 'Flecha doble', group: 'Flechas', el: poly('1,50 25,10 25,32 75,32 75,10 99,50 75,90 75,68 25,68 25,90') },
  chevron: { label: 'Cheurón', group: 'Flechas', el: poly('1,1 70,1 99,50 70,99 1,99 30,50') },
  line: { label: 'Línea', group: 'Líneas', line: true, el: path('M 0 50 L 100 50', true) },
  arrowLine: { label: 'Flecha', group: 'Líneas', line: true, arrow: true, el: path('M 0 50 L 96 50', true) },
  elbow: { label: 'Conector angular', group: 'Líneas', line: true, arrow: true, el: path('M 0 8 L 50 8 L 50 92 L 96 92', true) },
  curve: { label: 'Conector curvo', group: 'Líneas', line: true, arrow: true, el: path('M 0 90 C 50 90 50 10 96 10', true) },
  braceLeft: { label: 'Llave izquierda', group: 'Llaves y corchetes', line: true, el: path('M 80 2 Q 50 2 50 20 L 50 40 Q 50 50 20 50 Q 50 50 50 60 L 50 80 Q 50 98 80 98', true) },
  braceRight: { label: 'Llave derecha', group: 'Llaves y corchetes', line: true, el: path('M 20 2 Q 50 2 50 20 L 50 40 Q 50 50 80 50 Q 50 50 50 60 L 50 80 Q 50 98 20 98', true) },
  bracketLeft: { label: 'Corchete izquierdo', group: 'Llaves y corchetes', line: true, el: path('M 75 2 L 30 2 L 30 98 L 75 98', true) },
  bracketRight: { label: 'Corchete derecho', group: 'Llaves y corchetes', line: true, el: path('M 25 2 L 70 2 L 70 98 L 25 98', true) },
  process: { label: 'Proceso', group: 'Diagrama de flujo', el: { tag: 'rect', attrs: { x: 1, y: 1, width: 98, height: 98 } } },
  decision: { label: 'Decisión', group: 'Diagrama de flujo', el: poly('50,1 99,50 50,99 1,50') },
  terminator: { label: 'Terminador', group: 'Diagrama de flujo', el: { tag: 'rect', attrs: { x: 1, y: 1, width: 98, height: 98, rx: 49 } } },
  data: { label: 'Datos', group: 'Diagrama de flujo', el: poly('20,2 99,2 80,98 1,98') },
  document: { label: 'Documento', group: 'Diagrama de flujo', el: path('M 1 1 L 99 1 L 99 82 Q 75 70 50 84 Q 25 98 1 86 Z') },
  predefined: { label: 'Proceso predefinido', group: 'Diagrama de flujo', el: path('M 1 1 L 99 1 L 99 99 L 1 99 Z M 12 1 L 12 99 M 88 1 L 88 99') },
  database: { label: 'Base de datos', group: 'Diagrama de flujo', el: path('M 1 14 Q 50 -6 99 14 L 99 86 Q 50 106 1 86 Z M 1 14 Q 50 34 99 14') },
  manualInput: { label: 'Entrada manual', group: 'Diagrama de flujo', el: poly('1,25 99,2 99,98 1,98') },
  delay: { label: 'Retraso', group: 'Diagrama de flujo', el: path('M 1 1 L 60 1 Q 99 1 99 50 Q 99 99 60 99 L 1 99 Z') },
  connectorCircle: { label: 'Conector', group: 'Diagrama de flujo', square: true, el: { tag: 'ellipse', attrs: { cx: 50, cy: 50, rx: 49, ry: 49 } } },
  callout: { label: 'Bocadillo', group: 'Otras', el: path('M 4 2 L 96 2 Q 99 2 99 6 L 99 66 Q 99 70 96 70 L 40 70 L 22 96 L 26 70 L 4 70 Q 1 70 1 66 L 1 6 Q 1 2 4 2 Z') },
  heart: { label: 'Corazón', group: 'Otras', square: true, el: path('M 50 92 C 10 64 1 42 1 26 C 1 10 14 2 27 2 C 38 2 46 9 50 18 C 54 9 62 2 73 2 C 86 2 99 10 99 26 C 99 42 90 64 50 92 Z') },
  cloud: { label: 'Nube', group: 'Otras', el: path('M 25 85 C 8 85 1 72 6 60 C 0 46 12 32 26 36 C 28 18 48 10 60 22 C 70 10 92 16 90 36 C 101 40 101 62 90 68 C 94 80 82 88 72 84 C 64 94 36 94 25 85 Z') },
  lightning: { label: 'Rayo', group: 'Otras', el: poly('58,1 18,56 46,56 36,99 84,38 54,38 70,1') },
  moon: { label: 'Luna', group: 'Otras', square: true, el: path('M 70 4 A 48 48 0 1 0 96 70 A 38 38 0 1 1 70 4 Z') },
  plus: { label: 'Cruz', group: 'Otras', square: true, el: poly('35,1 65,1 65,35 99,35 99,65 65,65 65,99 35,99 35,65 1,65 1,35 35,35') },
};

export const SHAPE_GROUPS = [...new Set(Object.values(SHAPES).map((shape) => shape.group))];

export function defaultShapeSpec(type) {
  const shape = SHAPES[type] || SHAPES.rect;
  return {
    type,
    fill: shape.line ? 'none' : '#b7e4d4',
    stroke: shape.line ? '#1e293b' : '#2f6f5e',
    strokeWidth: shape.line ? 3 : 2,
    dash: 'solid',
    opacity: 1,
    text: '',
    textColor: '#1e293b',
    fontSize: 16,
    gradient: false,
    gradientTo: '#ffffff',
  };
}

const DASH = { solid: '', dashed: '8 6', dotted: '2 5', dashdot: '10 5 2 5' };

export function renderShapeSvg(spec, id = 's') {
  const shape = SHAPES[spec.type] || SHAPES.rect;
  const attrs = Object.entries(shape.el.attrs).map(([key, value]) => `${key}="${value}"`).join(' ');
  const gradientId = `g-${id}`;
  const markerId = `m-${id}`;
  const fill = shape.line ? 'none' : (spec.gradient ? `url(#${gradientId})` : spec.fill || 'none');
  const defs = [
    spec.gradient && !shape.line ? `<linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${escapeHtml(spec.fill)}"/><stop offset="1" stop-color="${escapeHtml(spec.gradientTo || '#ffffff')}"/></linearGradient>` : '',
    shape.arrow ? `<marker id="${markerId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${escapeHtml(spec.stroke)}"/></marker>` : '',
  ].join('');
  const dash = DASH[spec.dash] ? ` stroke-dasharray="${DASH[spec.dash]}"` : '';
  const marker = shape.arrow ? ` marker-end="url(#${markerId})"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true">${defs ? `<defs>${defs}</defs>` : ''}<${shape.el.tag} ${attrs} fill="${escapeHtml(fill)}" stroke="${escapeHtml(spec.stroke || 'none')}" stroke-width="${Number(spec.strokeWidth) || 0}" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"${dash}${marker}/></svg>`;
}

export function shapeInnerHtml(spec, id) {
  const text = spec.text ? `<div class="wd-obj-text" style="color:${escapeHtml(spec.textColor || '#1e293b')};font-size:${Number(spec.fontSize) || 16}px">${escapeHtml(spec.text).replace(/\n/g, '<br>')}</div>` : '';
  return renderShapeSvg(spec, id) + text;
}

export function shapePreviewSvg(type) {
  return renderShapeSvg({ ...defaultShapeSpec(type), fill: SHAPES[type]?.line ? 'none' : '#d7efe6', stroke: '#2f6f5e', strokeWidth: 1.5 }, `p-${type}`);
}
