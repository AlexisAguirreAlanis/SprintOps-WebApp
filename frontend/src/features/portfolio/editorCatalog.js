function svg(body) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`)}`;
}

export const STICKERS = [
  { name: 'Estrella', src: svg('<path fill="#f8e7a2" stroke="#1e293b" stroke-width="2" d="M32 6l7 16 17 2-13 11 4 17-15-9-15 9 4-17L8 24l17-2z"/>') },
  { name: 'Corazón', src: svg('<path fill="#f6d0c4" stroke="#1e293b" stroke-width="2" d="M32 54C14 40 6 30 6 20a12 12 0 0 1 22-6 12 12 0 0 1 22 6c0 10-8 20-18 34z"/>') },
  { name: 'Flecha', src: svg('<path fill="#b7e4d4" stroke="#1e293b" stroke-width="2" d="M8 28h32l-8-10 6-4 18 18-18 18-6-4 8-10H8z"/>') },
  { name: 'Check', src: svg('<circle cx="32" cy="32" r="24" fill="#b7e4d4" stroke="#1e293b" stroke-width="2"/><path d="M20 33l8 8 16-18" fill="none" stroke="#1e293b" stroke-width="4" stroke-linecap="round"/>') },
  { name: 'Globo', src: svg('<path fill="#d3eaf8" stroke="#1e293b" stroke-width="2" d="M12 12h40v28H28l-10 12v-12H12z"/>') },
  { name: 'Rayo', src: svg('<path fill="#f8e7a2" stroke="#1e293b" stroke-width="2" d="M36 4L14 36h14l-4 24 26-36H34z"/>') },
  { name: 'Pin', src: svg('<path fill="#e3d4f6" stroke="#1e293b" stroke-width="2" d="M32 4a14 14 0 0 1 14 14c0 10-14 26-14 26S18 28 18 18A14 14 0 0 1 32 4z"/><circle cx="32" cy="18" r="5" fill="#fff"/>') },
  { name: 'Sol', src: svg('<circle cx="32" cy="32" r="12" fill="#f8e7a2" stroke="#1e293b" stroke-width="2"/><g stroke="#1e293b" stroke-width="3" stroke-linecap="round"><path d="M32 6v8M32 50v8M6 32h8M50 32h8M12 12l6 6M46 46l6 6M52 12l-6 6M18 46l-6 6"/></g>') },
  { name: 'Luna', src: svg('<path fill="#e3d4f6" stroke="#1e293b" stroke-width="2" d="M36 8a20 20 0 1 0 16 32 16 16 0 1 1-16-32z"/>') },
  { name: 'Nube', src: svg('<path fill="#d3eaf8" stroke="#1e293b" stroke-width="2" d="M20 46h28a12 12 0 0 0 2-24 16 16 0 0 0-30-4A12 12 0 0 0 20 46z"/>') },
  { name: 'Flor', src: svg('<g fill="#f6d0c4" stroke="#1e293b" stroke-width="2"><circle cx="32" cy="18" r="8"/><circle cx="46" cy="32" r="8"/><circle cx="32" cy="46" r="8"/><circle cx="18" cy="32" r="8"/><circle cx="32" cy="32" r="7" fill="#f8e7a2"/></g>') },
  { name: 'Hoja', src: svg('<path fill="#b7e4d4" stroke="#1e293b" stroke-width="2" d="M12 40C12 18 30 8 54 10 50 36 32 52 12 40z"/><path d="M18 38c10-2 18-12 24-22" fill="none" stroke="#1e293b" stroke-width="2"/>') },
  { name: 'Fuego', src: svg('<path fill="#f6d0c4" stroke="#1e293b" stroke-width="2" d="M32 6c6 10 4 14 8 18 6 6 10 12 10 20a18 18 0 0 1-36 0c0-8 6-14 10-20 2-4 4-8 8-18z"/><path fill="#f8e7a2" d="M32 28c4 6 4 10 6 12a8 8 0 1 1-14 0c2-4 4-8 8-12z"/>') },
  { name: 'Escudo', src: svg('<path fill="#d3eaf8" stroke="#1e293b" stroke-width="2" d="M32 6l20 8v16c0 14-8 22-20 28C20 52 12 44 12 30V14z"/>') },
  { name: 'Corona', src: svg('<path fill="#f8e7a2" stroke="#1e293b" stroke-width="2" d="M8 44l6-22 10 12 8-20 8 20 10-12 6 22z"/>') },
  { name: 'Trofeo', src: svg('<path fill="#f8e7a2" stroke="#1e293b" stroke-width="2" d="M18 12h28v14a14 14 0 0 1-28 0zM14 14h-4c0 10 6 14 10 14M50 14h4c0 10-6 14-10 14M26 40h12M22 50h20v-6H22z"/>') },
  { name: 'Bombilla', src: svg('<path fill="#f8e7a2" stroke="#1e293b" stroke-width="2" d="M32 6a16 16 0 0 1 8 30c-1 2-2 4-2 6H26c0-2-1-4-2-6A16 16 0 0 1 32 6z"/><path d="M26 46h12M28 52h8" stroke="#1e293b" stroke-width="2" stroke-linecap="round"/>') },
  { name: 'Cohete', src: svg('<path fill="#d3eaf8" stroke="#1e293b" stroke-width="2" d="M32 6c10 8 14 20 14 32H18C18 26 22 14 32 6z"/><path fill="#f6d0c4" stroke="#1e293b" stroke-width="2" d="M18 32l-8 8 8 2zM46 32l8 8-8 2z"/><circle cx="32" cy="24" r="4" fill="#fff" stroke="#1e293b" stroke-width="2"/>') },
  { name: 'Bandera', src: svg('<path stroke="#1e293b" stroke-width="2" d="M16 8v48"/><path fill="#f6d0c4" stroke="#1e293b" stroke-width="2" d="M16 10h30l-6 10 6 10H16z"/>') },
  { name: 'Megáfono', src: svg('<path fill="#e3d4f6" stroke="#1e293b" stroke-width="2" d="M10 26h12l26-12v36L22 38H10z"/><path d="M16 38v10h8" fill="none" stroke="#1e293b" stroke-width="2"/>') },
  { name: 'Reloj', src: svg('<circle cx="32" cy="32" r="22" fill="#fff" stroke="#1e293b" stroke-width="2"/><path d="M32 18v16l10 6" fill="none" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>') },
  { name: 'Cámara', src: svg('<path fill="#1e293b" d="M10 22h8l4-6h20l4 6h8v26H10z"/><circle cx="32" cy="34" r="8" fill="#d3eaf8" stroke="#fff" stroke-width="2"/>') },
  { name: 'Usuario', src: svg('<circle cx="32" cy="22" r="10" fill="#d3eaf8" stroke="#1e293b" stroke-width="2"/><path fill="#b7e4d4" stroke="#1e293b" stroke-width="2" d="M12 52c2-12 10-16 20-16s18 4 20 16z"/>') },
  { name: 'Gráfico', src: svg('<path stroke="#1e293b" stroke-width="2" d="M10 52h44"/><rect x="16" y="32" width="8" height="20" fill="#b7e4d4" stroke="#1e293b" stroke-width="2"/><rect x="28" y="18" width="8" height="34" fill="#2f6f5e" stroke="#1e293b" stroke-width="2"/><rect x="40" y="26" width="8" height="26" fill="#d3eaf8" stroke="#1e293b" stroke-width="2"/>') },
  { name: 'Calendario', src: svg('<rect x="10" y="14" width="44" height="38" rx="4" fill="#fff" stroke="#1e293b" stroke-width="2"/><path stroke="#1e293b" stroke-width="2" d="M10 26h44M22 8v10M42 8v10"/><rect x="18" y="32" width="8" height="8" fill="#b7e4d4"/><rect x="30" y="32" width="8" height="8" fill="#f8e7a2"/>') },
  { name: 'Libro', src: svg('<path fill="#f6f1e8" stroke="#1e293b" stroke-width="2" d="M10 14h18c4 0 6 2 6 6v32H16c-4 0-6-2-6-6z"/><path fill="#d3eaf8" stroke="#1e293b" stroke-width="2" d="M54 14H36c-4 0-6 2-6 6v32h18c4 0 6-2 6-6z"/>') },
  { name: 'Música', src: svg('<path fill="#e3d4f6" stroke="#1e293b" stroke-width="2" d="M26 46V16l24-6v28"/><circle cx="20" cy="46" r="8" fill="#e3d4f6" stroke="#1e293b" stroke-width="2"/><circle cx="44" cy="38" r="8" fill="#e3d4f6" stroke="#1e293b" stroke-width="2"/>') },
  { name: 'Chat', src: svg('<path fill="#b7e4d4" stroke="#1e293b" stroke-width="2" d="M10 12h44v28H26L14 52V40h-4z"/>') },
  { name: 'Like', src: svg('<path fill="#f6d0c4" stroke="#1e293b" stroke-width="2" d="M16 28h10v22H16zM26 28l8-16a6 6 0 0 1 6 6v10h10l-4 22H26z"/>') },
];

export const TEXT_PRESETS = [
  { name: 'Título', text: 'Título', fontSize: 48, fontWeight: 800, width: 420, height: 64 },
  { name: 'Subtítulo', text: 'Subtítulo', fontSize: 28, fontWeight: 700, width: 360, height: 44 },
  { name: 'Párrafo', text: 'Escribe un párrafo claro y corto.', fontSize: 18, fontWeight: 500, width: 320, height: 80 },
  { name: 'Cita', text: 'Una idea, en una frase.', fontSize: 22, fontWeight: 600, width: 340, height: 72, fontStyle: 'italic' },
];

const BLUE = '#d3eaf8';
const MINT = '#b7e4d4';
const SAND = '#f6f1e8';
const LILAC = '#e3d4f6';
const CORAL = '#f6d0c4';
const YELLOW = '#f8e7a2';
const INK = '#1e293b';

function regularPoints(sides, radius, cx, cy, spin) {
  const points = [];
  for (let index = 0; index < sides; index += 1) {
    const angle = spin + (index * 2 * Math.PI) / sides;
    points.push(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  }
  return points;
}

function starPoints(count, outer, inner, cx, cy) {
  const points = [];
  for (let index = 0; index < count * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / count;
    points.push(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  }
  return points;
}

function polygonElement(name, points, fill) {
  const xs = [];
  const ys = [];
  for (let index = 0; index < points.length; index += 2) {
    xs.push(points[index]);
    ys.push(points[index + 1]);
  }
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return [{
    type: 'line',
    name,
    width: Math.max(16, Math.max(...xs) - minX),
    height: Math.max(16, Math.max(...ys) - minY),
    points: points.map((value, index) => value - (index % 2 === 0 ? minX : minY)),
    closed: true,
    fill,
    stroke: INK,
    strokeWidth: 2,
    text: '',
  }];
}

export const SHAPES = [
  { id: 'rect', name: 'Rectángulo' },
  { id: 'square', name: 'Cuadrado' },
  { id: 'ellipse', name: 'Círculo' },
  { id: 'oval', name: 'Óvalo' },
  { id: 'triangle', name: 'Triángulo' },
  { id: 'triangle-right', name: 'Triángulo recto' },
  { id: 'diamond', name: 'Diamante' },
  { id: 'pentagon', name: 'Pentágono' },
  { id: 'hexagon', name: 'Hexágono' },
  { id: 'octagon', name: 'Octágono' },
  { id: 'star', name: 'Estrella' },
  { id: 'star4', name: 'Estrella 4' },
  { id: 'arrow', name: 'Flecha bloque' },
  { id: 'arrow-double', name: 'Flecha doble' },
  { id: 'chevron', name: 'Cheurón' },
  { id: 'cross', name: 'Cruz' },
  { id: 'parallelogram', name: 'Paralelogramo' },
  { id: 'trapezoid', name: 'Trapecio' },
  { id: 'pill', name: 'Cápsula' },
  { id: 'ring', name: 'Anillo' },
  { id: 'burst', name: 'Explosión' },
  { id: 'line', name: 'Flecha' },
];

export function shapeElements(id) {
  if (id === 'ellipse') return [{ type: 'ellipse', name: 'Círculo', width: 150, height: 150, fill: BLUE, text: '' }];
  if (id === 'oval') return [{ type: 'ellipse', name: 'Óvalo', width: 190, height: 118, fill: BLUE, text: '' }];
  if (id === 'square') return [{ type: 'rect', name: 'Cuadrado', width: 150, height: 150, fill: '#ffffff', radius: 0, text: '' }];
  if (id === 'pill') return [{ type: 'rect', name: 'Cápsula', width: 190, height: 72, radius: 999, fill: MINT, text: '' }];
  if (id === 'ring') return [{ type: 'ellipse', name: 'Anillo', width: 150, height: 150, fill: 'transparent', stroke: INK, strokeWidth: 14, text: '' }];
  if (id === 'line') return [{ type: 'line', name: 'Flecha', width: 180, height: 56, points: [0, 28, 180, 28], stroke: INK, strokeWidth: 3, fill: INK, route: 'straight', text: '' }];
  if (id === 'triangle') return polygonElement('Triángulo', regularPoints(3, 78, 80, 88, -Math.PI / 2), SAND);
  if (id === 'triangle-right') return polygonElement('Triángulo recto', [0, 0, 0, 140, 156, 140], CORAL);
  if (id === 'diamond') return polygonElement('Diamante', [80, 4, 152, 80, 80, 156, 8, 80], LILAC);
  if (id === 'pentagon') return polygonElement('Pentágono', regularPoints(5, 74, 80, 82, -Math.PI / 2), MINT);
  if (id === 'hexagon') return polygonElement('Hexágono', regularPoints(6, 74, 80, 80, 0), BLUE);
  if (id === 'octagon') return polygonElement('Octágono', regularPoints(8, 74, 80, 80, Math.PI / 8), SAND);
  if (id === 'star') return polygonElement('Estrella', starPoints(5, 76, 32, 80, 82), YELLOW);
  if (id === 'star4') return polygonElement('Estrella 4', starPoints(4, 74, 28, 80, 80), YELLOW);
  if (id === 'arrow') return polygonElement('Flecha bloque', [0, 48, 104, 48, 104, 18, 176, 78, 104, 138, 104, 108, 0, 108], MINT);
  if (id === 'arrow-double') return polygonElement('Flecha doble', [0, 78, 42, 28, 42, 56, 134, 56, 134, 28, 176, 78, 134, 128, 134, 100, 42, 100, 42, 128], BLUE);
  if (id === 'chevron') return polygonElement('Cheurón', [0, 28, 112, 28, 156, 72, 112, 116, 0, 116, 44, 72], LILAC);
  if (id === 'cross') return polygonElement('Cruz', [52, 0, 104, 0, 104, 52, 156, 52, 156, 104, 104, 104, 104, 156, 52, 156, 52, 104, 0, 104, 0, 52, 52, 52], CORAL);
  if (id === 'parallelogram') return polygonElement('Paralelogramo', [40, 0, 176, 0, 136, 104, 0, 104], SAND);
  if (id === 'trapezoid') return polygonElement('Trapecio', [40, 0, 136, 0, 176, 104, 0, 104], MINT);
  if (id === 'burst') return polygonElement('Explosión', starPoints(12, 76, 58, 80, 80), YELLOW);
  return [{ type: 'rect', name: 'Rectángulo', width: 180, height: 120, fill: '#ffffff', radius: 0, text: '' }];
}

export function deviceElements(id) {
  if (id === 'phone') {
    return [
      { type: 'frame', name: 'Teléfono', x: 0, y: 0, width: 220, height: 440, radius: 32, fill: '#1e293b', stroke: '#1e293b', strokeWidth: 0, text: '' },
      { type: 'rect', name: 'Pantalla', x: 14, y: 48, width: 192, height: 344, radius: 8, fill: '#ffffff', text: '' },
    ];
  }
  if (id === 'tablet') {
    return [
      { type: 'frame', name: 'Tablet', x: 0, y: 0, width: 460, height: 320, radius: 24, fill: '#1e293b', text: '' },
      { type: 'rect', name: 'Pantalla', x: 22, y: 22, width: 416, height: 276, radius: 6, fill: '#ffffff', text: '' },
    ];
  }
  return [
    { type: 'rect', name: 'Laptop', x: 0, y: 0, width: 520, height: 320, radius: 16, fill: '#1e293b', text: '' },
    { type: 'rect', name: 'Pantalla', x: 18, y: 16, width: 484, height: 270, radius: 6, fill: '#ffffff', text: '' },
    { type: 'rect', name: 'Base', x: -30, y: 318, width: 580, height: 16, radius: 8, fill: '#334155', text: '' },
  ];
}

export function kitElements(id) {
  if (id === 'button') return [{ type: 'rect', name: 'Botón', width: 160, height: 48, radius: 14, fill: '#2f6f5e', text: 'Continuar', textFill: '#ffffff', fontSize: 16 }];
  if (id === 'input') return [{ type: 'rect', name: 'Campo', width: 240, height: 48, radius: 12, fill: '#ffffff', stroke: '#cbd5e1', strokeWidth: 2, text: 'Escribe aquí', textFill: '#64748b', align: 'left', fontWeight: 500 }];
  if (id === 'chip') return [{ type: 'rect', name: 'Chip', width: 120, height: 36, radius: 999, fill: '#b7e4d4', text: 'Etiqueta', fontSize: 14 }];
  if (id === 'glass') return [{ type: 'rect', name: 'Vidrio', width: 260, height: 140, radius: 22, fill: 'rgba(255,255,255,0.72)', stroke: 'rgba(255,255,255,0.9)', strokeWidth: 2, shadow: 18, text: 'Tarjeta', fontSize: 18 }];
  return [
    { type: 'rect', name: 'Tarjeta', x: 0, y: 0, width: 260, height: 160, radius: 18, fill: '#ffffff', shadow: 12, text: '' },
    { type: 'rect', name: 'Título de tarjeta', x: 16, y: 20, width: 228, height: 36, fill: 'transparent', text: 'Tarjeta', align: 'left', fontSize: 20, fontWeight: 800 },
    { type: 'rect', name: 'Texto de tarjeta', x: 16, y: 64, width: 228, height: 64, fill: 'transparent', text: 'Un bloque listo para editar.', align: 'left', fontSize: 15, fontWeight: 500 },
  ];
}

export function appElements(id) {
  if (id === 'bars') {
    return [
      { type: 'rect', name: 'Eje', x: 0, y: 120, width: 220, height: 4, radius: 2, fill: '#cbd5e1', text: '' },
      { type: 'rect', name: 'Barra 1', x: 16, y: 50, width: 36, height: 70, radius: 8, fill: '#b7e4d4', text: '' },
      { type: 'rect', name: 'Barra 2', x: 70, y: 24, width: 36, height: 96, radius: 8, fill: '#2f6f5e', text: '' },
      { type: 'rect', name: 'Barra 3', x: 124, y: 64, width: 36, height: 56, radius: 8, fill: '#d3eaf8', text: '' },
    ];
  }
  if (id === 'tasks') {
    return [{ type: 'sticky', name: 'Tareas', width: 220, height: 180, fill: '#f8e7a2', text: '☐ Primer paso\n☐ Segundo paso\n☐ Tercer paso', align: 'left', fontSize: 16, fontWeight: 650 }];
  }
  return [{ type: 'sticky', name: 'Nota', width: 200, height: 160, fill: '#f8e7a2', text: 'Anota una idea', fontSize: 18 }];
}
