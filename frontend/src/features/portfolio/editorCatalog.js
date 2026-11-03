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
];

export const TEXT_PRESETS = [
  { name: 'Título', text: 'Título', fontSize: 48, fontWeight: 800, width: 420, height: 64 },
  { name: 'Subtítulo', text: 'Subtítulo', fontSize: 28, fontWeight: 700, width: 360, height: 44 },
  { name: 'Párrafo', text: 'Escribe un párrafo claro y corto.', fontSize: 18, fontWeight: 500, width: 320, height: 80 },
  { name: 'Cita', text: 'Una idea, en una frase.', fontSize: 22, fontWeight: 600, width: 340, height: 72, fontStyle: 'italic' },
];

export const SHAPES = [
  { id: 'rect', name: 'Rectángulo' },
  { id: 'ellipse', name: 'Elipse' },
  { id: 'line', name: 'Flecha' },
  { id: 'triangle', name: 'Triángulo' },
];

export function shapeElements(id) {
  if (id === 'ellipse') return [{ type: 'ellipse', name: 'Elipse', width: 160, height: 160, fill: '#d3eaf8', text: '' }];
  if (id === 'line') return [{ type: 'line', name: 'Flecha', width: 1, height: 1, points: [0, 28, 180, 28], stroke: '#1e293b', strokeWidth: 3, fill: '#1e293b', route: 'straight', text: '' }];
  if (id === 'triangle') {
    return [{ type: 'line', name: 'Triángulo', width: 1, height: 1, points: [80, 0, 160, 140, 0, 140, 80, 0], stroke: '#1e293b', strokeWidth: 3, fill: '#f6f1e8', text: '', closed: true }];
  }
  return [{ type: 'rect', name: 'Rectángulo', width: 180, height: 120, fill: '#ffffff', radius: 16, text: '' }];
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
