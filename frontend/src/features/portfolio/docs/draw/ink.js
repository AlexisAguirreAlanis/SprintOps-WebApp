// Geometría de tinta: suavizado, simplificación, borrado, selección y reconocimiento de figuras.

export const INK_TOOLS = {
  pencil: { label: 'Lápiz', width: 1.6, opacity: 0.9, texture: 'pencil' },
  ballpoint: { label: 'Bolígrafo', width: 2.2, opacity: 1 },
  fountain: { label: 'Pluma', width: 3.2, opacity: 1, pressure: true },
  marker: { label: 'Marcador', width: 6, opacity: 1 },
  highlighter: { label: 'Resaltador', width: 18, opacity: 0.35, blend: 'multiply' },
};

export function bounds(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < points.length; i += 3) {
    minX = Math.min(minX, points[i]);
    maxX = Math.max(maxX, points[i]);
    minY = Math.min(minY, points[i + 1]);
    maxY = Math.max(maxY, points[i + 1]);
  }
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

export function strokeBounds(strokes) {
  const all = strokes.flatMap((stroke) => stroke.points);
  return all.length ? bounds(all) : null;
}

/** Trazo como path SVG suavizado (curvas cuadráticas por puntos medios). */
export function strokePath(points) {
  if (points.length < 6) return points.length ? `M ${points[0]} ${points[1]} l 0.1 0.1` : '';
  let d = `M ${points[0].toFixed(1)} ${points[1].toFixed(1)}`;
  for (let i = 3; i < points.length - 3; i += 3) {
    const mx = (points[i] + points[i + 3]) / 2;
    const my = (points[i + 1] + points[i + 4]) / 2;
    d += ` Q ${points[i].toFixed(1)} ${points[i + 1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const n = points.length;
  d += ` L ${points[n - 3].toFixed(1)} ${points[n - 2].toFixed(1)}`;
  return d;
}

/** Para la pluma: polígono de ancho variable según la presión. */
export function pressurePolygon(points, width) {
  if (points.length < 9) return null;
  const left = [];
  const right = [];
  for (let i = 0; i < points.length; i += 3) {
    const prev = Math.max(0, i - 3);
    const next = Math.min(points.length - 3, i + 3);
    const dx = points[next] - points[prev];
    const dy = points[next + 1] - points[prev + 1];
    const len = Math.hypot(dx, dy) || 1;
    const w = (width * (0.35 + (points[i + 2] || 0.5) * 1.3)) / 2;
    left.push([points[i] - (dy / len) * w, points[i + 1] + (dx / len) * w]);
    right.push([points[i] + (dy / len) * w, points[i + 1] - (dx / len) * w]);
  }
  const ring = [...left, ...right.reverse()];
  return `M ${ring.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ')} Z`;
}

function perpendicular(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  if (!len) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Ramer–Douglas–Peucker sobre puntos [x,y,p,...]. */
export function simplify(points, epsilon) {
  const n = points.length / 3;
  if (n < 3) return points.slice();
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0;
    let index = -1;
    for (let i = a + 1; i < b; i += 1) {
      const d = perpendicular(points[i * 3], points[i * 3 + 1], points[a * 3], points[a * 3 + 1], points[b * 3], points[b * 3 + 1]);
      if (d > max) { max = d; index = i; }
    }
    if (max > epsilon && index > 0) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  const out = [];
  for (let i = 0; i < n; i += 1) if (keep[i]) out.push(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]);
  return out;
}

/** Corrige un trazo: elimina temblor (Chaikin) y puntos redundantes. */
export function smooth(points) {
  let current = simplify(points, 1.2);
  for (let pass = 0; pass < 2; pass += 1) {
    if (current.length < 9) break;
    const next = [current[0], current[1], current[2]];
    for (let i = 0; i < current.length - 3; i += 3) {
      const [x0, y0, p0, x1, y1, p1] = current.slice(i, i + 6);
      next.push(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1, (p0 + p1) / 2, 0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1, (p0 + p1) / 2);
    }
    next.push(...current.slice(-3));
    current = next;
  }
  return current;
}

export function hitStroke(stroke, x, y, radius) {
  const pts = stroke.points;
  for (let i = 0; i < pts.length - 3; i += 3) {
    if (perpendicular(x, y, pts[i], pts[i + 1], pts[i + 3], pts[i + 4]) <= radius + stroke.width / 2) return true;
  }
  return pts.length === 3 && Math.hypot(pts[0] - x, pts[1] - y) <= radius;
}

/** Borrador de puntos: corta los trazos donde pasa el borrador. */
export function erasePoints(strokes, x, y, radius) {
  const out = [];
  strokes.forEach((stroke) => {
    let segment = [];
    const pieces = [];
    for (let i = 0; i < stroke.points.length; i += 3) {
      if (Math.hypot(stroke.points[i] - x, stroke.points[i + 1] - y) <= radius) {
        if (segment.length >= 6) pieces.push(segment);
        segment = [];
      } else segment.push(stroke.points[i], stroke.points[i + 1], stroke.points[i + 2]);
    }
    if (segment.length >= 6) pieces.push(segment);
    if (pieces.length === 1 && pieces[0].length === stroke.points.length) out.push(stroke);
    else pieces.forEach((points, index) => out.push({ ...stroke, id: `${stroke.id}-${index}-${Date.now().toString(36)}`, points }));
  });
  return out;
}

export function insidePolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 2; i < polygon.length; j = i, i += 2) {
    const xi = polygon[i];
    const yi = polygon[i + 1];
    const xj = polygon[j];
    const yj = polygon[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function selectStrokes(strokes, area) {
  return strokes.filter((stroke) => {
    let inside = 0;
    const total = stroke.points.length / 3;
    for (let i = 0; i < stroke.points.length; i += 3) {
      const x = stroke.points[i];
      const y = stroke.points[i + 1];
      const hit = area.polygon ? insidePolygon(x, y, area.polygon) : x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h;
      if (hit) inside += 1;
    }
    return inside / total >= 0.6;
  });
}

export function transformStrokes(strokes, { dx = 0, dy = 0, scale = 1, angle = 0, origin }) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return strokes.map((stroke) => {
    const points = stroke.points.slice();
    for (let i = 0; i < points.length; i += 3) {
      let x = points[i] - origin.x;
      let y = points[i + 1] - origin.y;
      x *= scale;
      y *= scale;
      const rx = x * cos - y * sin;
      const ry = x * sin + y * cos;
      points[i] = rx + origin.x + dx;
      points[i + 1] = ry + origin.y + dy;
    }
    return { ...stroke, points, width: stroke.width * (scale > 0 ? Math.sqrt(scale) : 1) };
  });
}

/** Reconoce la figura que se dibujó: línea, triángulo, rectángulo, elipse o flecha. */
export function recognize(points) {
  const box = bounds(points);
  const diag = Math.hypot(box.w, box.h);
  if (diag < 12) return null;
  const n = points.length;
  const closed = Math.hypot(points[0] - points[n - 3], points[1] - points[n - 2]) < diag * 0.22;
  const simple = simplify(points, diag * 0.07);
  const corners = simple.length / 3;
  if (!closed) {
    if (corners <= 2 || simplify(points, diag * 0.12).length <= 6) return { type: 'line', box, x1: points[0], y1: points[1], x2: points[n - 3], y2: points[n - 2] };
    if (corners === 4 || corners === 5) {
      const tail = simple.slice(-9);
      const shaft = [simple[0], simple[1], tail[0], tail[1]];
      return { type: 'arrow', box, x1: shaft[0], y1: shaft[1], x2: tail[0], y2: tail[1] };
    }
    return null;
  }
  const loop = closed ? corners - 1 : corners;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  let ellipseError = 0;
  for (let i = 0; i < n; i += 3) {
    const nx = (points[i] - cx) / (box.w / 2);
    const ny = (points[i + 1] - cy) / (box.h / 2);
    ellipseError += Math.abs(Math.hypot(nx, ny) - 1);
  }
  ellipseError /= n / 3;
  if (loop === 3) return { type: 'triangle', box, points: simple.slice(0, 9) };
  if (loop === 4 && ellipseError > 0.09) return { type: 'rect', box };
  if (ellipseError < 0.2) return { type: Math.abs(box.w - box.h) < Math.max(box.w, box.h) * 0.12 ? 'circle' : 'ellipse', box };
  if (loop <= 6) return { type: 'rect', box };
  return null;
}

/** Puntos perfectos para una figura reconocida (para "Reconocer figuras" sin salir de la tinta). */
export function idealPoints(shape) {
  const { box } = shape;
  const out = [];
  const add = (x, y) => out.push(x, y, 0.5);
  if (shape.type === 'line' || shape.type === 'arrow') {
    add(shape.x1, shape.y1);
    add(shape.x2, shape.y2);
    if (shape.type === 'arrow') {
      const angle = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
      const size = Math.min(24, Math.hypot(shape.x2 - shape.x1, shape.y2 - shape.y1) * 0.3);
      add(shape.x2 - size * Math.cos(angle - 0.45), shape.y2 - size * Math.sin(angle - 0.45));
      add(shape.x2, shape.y2);
      add(shape.x2 - size * Math.cos(angle + 0.45), shape.y2 - size * Math.sin(angle + 0.45));
    }
  } else if (shape.type === 'rect') {
    [[box.x, box.y], [box.x + box.w, box.y], [box.x + box.w, box.y + box.h], [box.x, box.y + box.h], [box.x, box.y]].forEach(([x, y]) => add(x, y));
  } else if (shape.type === 'triangle') {
    for (let i = 0; i < 9; i += 3) add(shape.points[i], shape.points[i + 1]);
    add(shape.points[0], shape.points[1]);
  } else {
    for (let i = 0; i <= 64; i += 1) {
      const a = (i / 64) * Math.PI * 2;
      add(box.x + box.w / 2 + (box.w / 2) * Math.cos(a), box.y + box.h / 2 + (box.h / 2) * Math.sin(a));
    }
  }
  return out;
}

export function inkToSvg(strokes, box, padding = 8) {
  const paths = strokes.map((stroke) => {
    const tool = INK_TOOLS[stroke.tool] || INK_TOOLS.ballpoint;
    const poly = tool.pressure ? pressurePolygon(stroke.points, stroke.width) : null;
    return poly
      ? `<path d="${poly}" fill="${stroke.color}" opacity="${stroke.opacity}"/>`
      : `<path d="${strokePath(stroke.points)}" fill="none" stroke="${stroke.color}" stroke-width="${stroke.width}" stroke-linecap="round" stroke-linejoin="round" opacity="${stroke.opacity}"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x - padding} ${box.y - padding} ${box.w + padding * 2} ${box.h + padding * 2}" width="${box.w + padding * 2}" height="${box.h + padding * 2}">${paths}</svg>`;
}
