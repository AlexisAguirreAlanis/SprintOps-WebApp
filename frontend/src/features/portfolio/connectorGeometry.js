// Geometría de conectores. Los campos extra (route, heads, from/to) viven
// dentro del documento schemaVersion 1: el servidor solo exige un objeto con elements.

export const HEAD_OPTIONS = [
  ['none', 'Ninguna'],
  ['triangle', 'Flecha'],
  ['open', 'Abierta'],
  ['ring', 'Anillo'],
  ['disc', 'Disco'],
  ['diamond', 'Rombo'],
  ['gem', 'Rombo lleno'],
  ['square', 'Cuadro'],
  ['box', 'Cuadro lleno'],
  ['bar', 'Barra'],
  ['crow', 'Pata'],
];

export const DASH_OPTIONS = [
  ['solid', 'Continua'],
  ['dashed', 'Guiones'],
  ['dotted', 'Puntos'],
  ['dashdot', 'Guion punto'],
];

export const ROUTE_OPTIONS = [
  ['straight', 'Recta'],
  ['curve', 'Curva'],
  ['elbow', 'Codo'],
  ['round', 'Redonda'],
];

export function isConnector(element) {
  return element?.type === 'line'
    && !element.closed
    && !element.brush
    && Array.isArray(element.points)
    && element.points.length >= 4
    && element.points.length % 2 === 0;
}

export function headKind(element, atEnd) {
  const value = atEnd ? element?.headEnd : element?.headStart;
  if (value) return value;
  return atEnd ? 'triangle' : 'none';
}

export function strokeDash(style, width) {
  const stroke = Math.max(1, width || 2);
  if (style === 'dashed') return [stroke * 3.2, stroke * 2];
  if (style === 'dotted') return [0.01, stroke * 1.85];
  if (style === 'dashdot') return [stroke * 3.2, stroke * 1.5, 0.01, stroke * 1.5];
  return null;
}

export function headTrim(kind, size) {
  if (!kind || kind === 'none' || kind === 'open' || kind === 'bar' || kind === 'crow') return 0;
  if (kind === 'ring' || kind === 'disc') return size * 0.72;
  return size * 0.9;
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

function dedupePoints(points) {
  const next = [];
  for (let index = 0; index < points.length; index += 2) {
    const x = points[index];
    const y = points[index + 1];
    if (next.length >= 2 && Math.hypot(x - next[next.length - 2], y - next[next.length - 1]) < 0.4) continue;
    next.push(x, y);
  }
  return next.length >= 4 ? next : points.slice();
}

function elbowThrough(points) {
  const result = [points[0], points[1]];
  for (let index = 0; index < points.length - 2; index += 2) {
    const x1 = points[index];
    const y1 = points[index + 1];
    const x2 = points[index + 2];
    const y2 = points[index + 3];
    if (Math.abs(x1 - x2) < 0.5 || Math.abs(y1 - y2) < 0.5) {
      result.push(x2, y2);
      continue;
    }
    const mid = (x1 + x2) / 2;
    result.push(mid, y1, mid, y2, x2, y2);
  }
  return dedupePoints(result);
}

function smoothStep(x1, y1, x2, y2) {
  const dir = Math.sign(x2 - x1) || 1;
  const handle = Math.max(18, Math.abs(x2 - x1) * 0.42);
  const samples = [];
  const steps = 16;
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const u = 1 - t;
    const hx1 = x1 + dir * handle;
    const hx2 = x2 - dir * handle;
    samples.push(
      u * u * u * x1 + 3 * u * u * t * hx1 + 3 * u * t * t * hx2 + t * t * t * x2,
      u * u * u * y1 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y2,
    );
  }
  return samples;
}

function filletOrthogonal(points, radius, keepEnd = 0) {
  if (!points || points.length < 6) return points;
  const result = [points[0], points[1]];
  for (let index = 2; index < points.length - 2; index += 2) {
    const x0 = points[index - 2];
    const y0 = points[index - 1];
    const x1 = points[index];
    const y1 = points[index + 1];
    const x2 = points[index + 2];
    const y2 = points[index + 3];
    const inX = x1 - x0;
    const inY = y1 - y0;
    const outX = x2 - x1;
    const outY = y2 - y1;
    const inLen = Math.hypot(inX, inY) || 1;
    const outLen = Math.hypot(outX, outY) || 1;
    const last = index >= points.length - 4;
    const room = last && keepEnd > 0 ? Math.max(0, outLen - keepEnd) : outLen / 2;
    const turn = Math.min(radius, inLen / 2, room, outLen / 2);
    const ux = inX / inLen;
    const uy = inY / inLen;
    const vx = outX / outLen;
    const vy = outY / outLen;
    if (turn < 4 || Math.abs(ux * vy - uy * vx) < 0.2) {
      result.push(x1, y1);
      continue;
    }
    const ax = x1 - ux * turn;
    const ay = y1 - uy * turn;
    const bx = x1 + vx * turn;
    const by = y1 + vy * turn;
    const cx = x1 - ux * turn + vx * turn;
    const cy = y1 - uy * turn + vy * turn;
    const start = Math.atan2(ay - cy, ax - cx);
    let delta = Math.atan2(by - cy, bx - cx) - start;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    if (Math.abs(delta) > Math.PI * 0.75) delta += delta > 0 ? -Math.PI * 2 : Math.PI * 2;
    for (let step = 0; step <= 6; step += 1) {
      const angle = start + delta * (step / 6);
      result.push(cx + Math.cos(angle) * turn, cy + Math.sin(angle) * turn);
    }
  }
  result.push(points[points.length - 2], points[points.length - 1]);
  return dedupePoints(result);
}

function anchorNormal(rotation, anchor) {
  const local = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] }[anchor];
  if (!local) return null;
  const rad = ((rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [local[0] * cos - local[1] * sin, local[0] * sin + local[1] * cos];
}

function curvePath(element) {
  const points = element.points;
  if (points.length === 4) {
    const bend = Number.isFinite(element.bend) ? element.bend : defaultBend(points);
    const control = controlPoint(points, bend);
    return { points: [points[0], points[1], control.x, control.y, points[2], points[3]], tension: 0.55, control };
  }
  return { points, tension: 0.5 };
}

function basePath(element) {
  const points = element.points;
  const route = element.route || 'straight';
  if (route === 'poly') return { points, tension: 0 };
  if (route === 'curve') return curvePath(element);
  if (route === 'elbow') return { points: elbowThrough(points), tension: 0 };
  if (route === 'round') {
    const vertical = points.length === 4 ? Math.abs(points[3] - points[1]) : 99;
    const horizontal = points.length === 4 ? Math.abs(points[2] - points[0]) : 99;
    if (vertical < 12 && horizontal > 20) return { points: smoothStep(points[0], points[1], points[2], points[3]), tension: 0 };
    return { points: filletOrthogonal(elbowThrough(points), element.corner || 28), tension: 0 };
  }
  return { points, tension: 0 };
}

function wrapAngle(delta) {
  let value = delta;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

function travelAngle(points, atEnd) {
  const min = 4;
  if (atEnd) {
    let index = points.length - 2;
    while (index >= 2) {
      const dx = points[index] - points[index - 2];
      const dy = points[index + 1] - points[index - 1];
      if (Math.hypot(dx, dy) >= min) return Math.atan2(dy, dx);
      index -= 2;
    }
  } else {
    let index = 0;
    while (index + 2 < points.length) {
      const dx = points[index + 2] - points[index];
      const dy = points[index + 3] - points[index + 1];
      if (Math.hypot(dx, dy) >= min) return Math.atan2(dy, dx);
      index += 2;
    }
  }
  return 0;
}

function sampleCubic(x0, y0, c1x, c1y, c2x, c2y, x1, y1) {
  const samples = [];
  const steps = 14;
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const u = 1 - t;
    samples.push(
      u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x1,
      u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y1,
    );
  }
  return samples;
}

function guideTip(points, headAngle, atEnd) {
  if (!points || points.length < 4) return points;
  const travel = atEnd ? headAngle : headAngle + Math.PI;
  const natural = travelAngle(points, atEnd);
  const turn = Math.abs(wrapAngle(travel - natural));
  if (turn < 0.05) return points;
  const total = polylineLength(points);
  if (total < 16) return points;
  const lead = Math.min(total * 0.42, Math.max(22, 18 + turn * 42));
  const body = atEnd ? trimFromEnd(points, lead) : trimFromStart(points, lead);
  const tipX = atEnd ? points[points.length - 2] : points[0];
  const tipY = atEnd ? points[points.length - 1] : points[1];
  const cutX = atEnd ? body[body.length - 2] : body[0];
  const cutY = atEnd ? body[body.length - 1] : body[1];
  if (Math.hypot(tipX - cutX, tipY - cutY) < 8) return points;
  const span = Math.hypot(tipX - cutX, tipY - cutY);
  const seat = Math.min(18, Math.max(10, span * 0.22));
  const dirX = Math.cos(travel);
  const dirY = Math.sin(travel);
  const bow = Math.max(8, span - seat);
  const handleIn = Math.max(8, bow * 0.46);
  const handleOut = Math.max(8, bow * 0.58);
  const side = wrapAngle(travel - natural);
  const sign = side < 0 ? -1 : 1;
  const bulge = Math.max(0, turn - Math.PI / 2) * bow * 0.42;
  const perpX = -dirY * sign;
  const perpY = dirX * sign;
  if (atEnd) {
    const incoming = travelAngle(body, true);
    const px = tipX - dirX * seat;
    const py = tipY - dirY * seat;
    const curve = sampleCubic(
      cutX,
      cutY,
      cutX + Math.cos(incoming) * handleIn + perpX * bulge,
      cutY + Math.sin(incoming) * handleIn + perpY * bulge,
      px - dirX * handleOut + perpX * bulge,
      py - dirY * handleOut + perpY * bulge,
      px,
      py,
    );
    return dedupePoints(body.slice(0, -2).concat(curve, [tipX, tipY]));
  }
  const leaving = travelAngle(body, false);
  const px = tipX + dirX * seat;
  const py = tipY + dirY * seat;
  const curve = sampleCubic(
    px,
    py,
    px + dirX * handleOut + perpX * bulge,
    py + dirY * handleOut + perpY * bulge,
    cutX - Math.cos(leaving) * handleIn + perpX * bulge,
    cutY - Math.sin(leaving) * handleIn + perpY * bulge,
    cutX,
    cutY,
  );
  return dedupePoints([tipX, tipY].concat(curve, body.slice(2)));
}

function withAim(element, built) {
  const endAim = Number(element?.headAngle);
  const startAim = Number(element?.headAngleStart);
  const hasEnd = Number.isFinite(endAim);
  const hasStart = Number.isFinite(startAim);
  if (!hasEnd && !hasStart) return built;
  let points = built.tension > 0 ? expandTension(built.points, built.tension) : built.points.slice();
  let shaped = false;
  if (hasEnd) {
    const next = guideTip(points, endAim, true);
    shaped = next !== points;
    points = next;
  }
  if (hasStart) {
    const next = guideTip(points, startAim, false);
    shaped = shaped || next !== points;
    points = next;
  }
  if (!shaped) return built;
  return { points, tension: 0, control: built.control };
}

export function arrowPath(element) {
  const points = element?.points;
  if (!points || points.length < 4) return { points: [0, 0, 40, 0], tension: 0 };
  return withAim(element, basePath(element));
}

function sampleQuadratic(x0, y0, cx, cy, x1, y1, into) {
  const steps = 10;
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const u = 1 - t;
    into.push(u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1);
  }
}

function sampleBezier(x0, y0, c1x, c1y, c2x, c2y, x1, y1, into) {
  const steps = 10;
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const u = 1 - t;
    into.push(
      u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x1,
      u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y1,
    );
  }
}

export function expandTension(points, tension) {
  if (!points || points.length < 6 || !(tension > 0)) return points ? points.slice() : [];
  const controls = [];
  for (let index = 2; index < points.length - 2; index += 2) {
    const dx = points[index + 2] - points[index - 2];
    const dy = points[index + 3] - points[index - 1];
    controls.push(
      points[index] - dx * tension,
      points[index + 1] - dy * tension,
      points[index],
      points[index + 1],
      points[index] + dx * tension,
      points[index + 1] + dy * tension,
    );
  }
  const samples = [points[0], points[1]];
  sampleQuadratic(points[0], points[1], controls[0], controls[1], controls[2], controls[3], samples);
  let cursorX = controls[2];
  let cursorY = controls[3];
  let index = 4;
  while (index < controls.length - 2) {
    sampleBezier(
      cursorX,
      cursorY,
      controls[index],
      controls[index + 1],
      controls[index + 2],
      controls[index + 3],
      controls[index + 4],
      controls[index + 5],
      samples,
    );
    cursorX = controls[index + 4];
    cursorY = controls[index + 5];
    index += 6;
  }
  sampleQuadratic(
    cursorX,
    cursorY,
    controls[controls.length - 2],
    controls[controls.length - 1],
    points[points.length - 2],
    points[points.length - 1],
    samples,
  );
  return samples;
}

export function tipAngle(element, points, tension, atEnd) {
  const custom = Number(atEnd ? element?.headAngle : element?.headAngleStart);
  if (Number.isFinite(custom)) return custom;
  return endAngle(tension > 0 ? expandTension(points, tension) : points, atEnd);
}

export function routePoints(points, route, corner, bend) {
  return arrowPath({ points, route: route || 'straight', corner: corner || 28, bend, approach: 0 }).points;
}

export function lineCount(element) {
  const value = Number(element?.lineCount);
  return value === 2 || value === 3 ? value : 1;
}

export function parallelCopies(points, count, gap) {
  const copies = count === 2 || count === 3 ? count : 1;
  if (!points || points.length < 4 || copies === 1) return [points];
  const distance = Math.max(1, gap || 6);
  const offsets = copies === 2 ? [-distance / 2, distance / 2] : [-distance, 0, distance];
  return offsets.map((offset) => offsetPolyline(points, offset));
}

function offsetPolyline(points, distance) {
  const count = points.length / 2;
  const shifted = [];
  for (let index = 0; index < count; index += 1) {
    const previous = Math.max(0, index - 1);
    const next = Math.min(count - 1, index + 1);
    const dx = points[next * 2] - points[previous * 2];
    const dy = points[next * 2 + 1] - points[previous * 2 + 1];
    const length = Math.hypot(dx, dy) || 1;
    shifted.push(
      points[index * 2] + (-dy / length) * distance,
      points[index * 2 + 1] + (dx / length) * distance,
    );
  }
  return shifted;
}

function polylineLength(points) {
  let total = 0;
  for (let index = 0; index < points.length - 2; index += 2) {
    total += Math.hypot(points[index + 2] - points[index], points[index + 3] - points[index + 1]);
  }
  return total;
}

function trimFromStart(points, distance) {
  let remaining = Math.min(distance, polylineLength(points) * 0.46);
  let index = 0;
  while (index < points.length - 2 && remaining > 0) {
    const dx = points[index + 2] - points[index];
    const dy = points[index + 3] - points[index + 1];
    const length = Math.hypot(dx, dy) || 1;
    if (length > remaining) {
      const ratio = remaining / length;
      const cut = points.slice(index);
      cut[0] = points[index] + dx * ratio;
      cut[1] = points[index + 1] + dy * ratio;
      return cut;
    }
    remaining -= length;
    index += 2;
  }
  return points.slice();
}

function trimFromEnd(points, distance) {
  const flipped = [];
  for (let index = points.length - 2; index >= 0; index -= 2) flipped.push(points[index], points[index + 1]);
  const cut = trimFromStart(flipped, distance);
  const restored = [];
  for (let index = cut.length - 2; index >= 0; index -= 2) restored.push(cut[index], cut[index + 1]);
  return restored;
}

export function trimPolyline(points, startTrim, endTrim) {
  if (!points || points.length < 4) return points || [];
  let next = points.slice();
  if (startTrim > 0) next = trimFromStart(next, startTrim);
  if (endTrim > 0) next = trimFromEnd(next, endTrim);
  return next.length >= 4 ? next : points.slice();
}

export function endAngle(points, atEnd) {
  if (!points || points.length < 4) return 0;
  const min = 6;
  if (atEnd) {
    let index = points.length - 2;
    while (index >= 2) {
      const dx = points[index] - points[index - 2];
      const dy = points[index + 1] - points[index - 1];
      if (Math.hypot(dx, dy) >= min) return Math.atan2(dy, dx);
      index -= 2;
    }
    return Math.atan2(points[points.length - 1] - points[1], points[points.length - 2] - points[0]);
  }
  let index = 0;
  while (index + 2 < points.length) {
    const dx = points[index] - points[index + 2];
    const dy = points[index + 1] - points[index + 3];
    if (Math.hypot(dx, dy) >= min) return Math.atan2(dy, dx);
    index += 2;
  }
  return 0;
}

export function pointAlong(points, amount) {
  const t = Math.min(1, Math.max(0, amount));
  if (!points || points.length < 4) return { x: 0, y: 0 };
  let total = 0;
  const spans = [];
  for (let index = 0; index < points.length - 2; index += 2) {
    const length = Math.hypot(points[index + 2] - points[index], points[index + 3] - points[index + 1]);
    spans.push(length);
    total += length;
  }
  let remaining = total * t;
  for (let index = 0; index < spans.length; index += 1) {
    const length = spans[index] || 1;
    if (remaining <= length || index === spans.length - 1) {
      const ratio = Math.min(1, remaining / length);
      const offset = index * 2;
      return {
        x: points[offset] + (points[offset + 2] - points[offset]) * ratio,
        y: points[offset + 1] + (points[offset + 3] - points[offset + 1]) * ratio,
      };
    }
    remaining -= length;
  }
  return { x: points[0], y: points[1] };
}

function distanceToSegment(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = dx * dx + dy * dy || 1;
  const ratio = Math.min(1, Math.max(0, ((x - x1) * dx + (y - y1) * dy) / length));
  const px = x1 + dx * ratio;
  const py = y1 + dy * ratio;
  return { x: px, y: py, distance: Math.hypot(x - px, y - py) };
}

export function insertVertex(points, x, y) {
  let best = { index: 2, x, y, distance: Infinity };
  for (let index = 0; index < points.length - 2; index += 2) {
    const hit = distanceToSegment(x, y, points[index], points[index + 1], points[index + 2], points[index + 3]);
    if (hit.distance < best.distance) best = { index: index + 2, ...hit };
  }
  const next = points.slice();
  next.splice(best.index, 0, best.x, best.y);
  return next;
}

export function insertWaypoint(element, x, y) {
  const rendered = arrowPath(element).points;
  let hit = { x, y, distance: Infinity };
  for (let index = 0; index < rendered.length - 2; index += 2) {
    const next = distanceToSegment(x, y, rendered[index], rendered[index + 1], rendered[index + 2], rendered[index + 3]);
    if (next.distance < hit.distance) hit = next;
  }
  const points = element.points;
  let slot = 2;
  let nearest = Infinity;
  for (let index = 0; index < points.length - 2; index += 2) {
    const next = distanceToSegment(hit.x, hit.y, points[index], points[index + 1], points[index + 2], points[index + 3]);
    if (next.distance < nearest) {
      nearest = next.distance;
      slot = index + 2;
    }
  }
  const next = points.slice();
  next.splice(slot, 0, hit.x, hit.y);
  return next;
}

export function removeVertex(points, vertex) {
  if (!points || points.length <= 4) return points;
  if (vertex <= 0 || vertex >= points.length / 2 - 1) return points;
  const next = points.slice();
  next.splice(vertex * 2, 2);
  return next;
}

export const ANCHOR_SNAP = 48;
export const ANCHOR_APPROACH = 150;
const ANCHOR_NAMES = ['top', 'right', 'bottom', 'left', 'center'];

export function connectorKind(element) {
  if (!element || element.visible === false || element.type === 'line') return null;
  if (element.type === 'ellipse') return 'ellipse';
  if (element.type === 'sticky') return 'note';
  if (element.type === 'text') return 'text';
  if (element.type === 'frame') return 'frame';
  if (element.type === 'image' || element.type === 'video') return 'media';
  if (element.type === 'table') return 'table';
  return 'box';
}

export function anchorPoint(element, anchor) {
  if (!connectorKind(element)) return null;
  const width = element.width || 0;
  const height = element.height || 0;
  const spots = {
    center: [width / 2, height / 2],
    top: [width / 2, 0],
    right: [width, height / 2],
    bottom: [width / 2, height],
    left: [0, height / 2],
  };
  const local = spots[anchor] || spots.center;
  const rad = ((element.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: element.x + local[0] * cos - local[1] * sin,
    y: element.y + local[0] * sin + local[1] * cos,
  };
}

export function nearestAnchor(element, x, y) {
  let best = null;
  for (const anchor of ['center', 'top', 'right', 'bottom', 'left']) {
    const point = anchorPoint(element, anchor);
    const distance = Math.hypot(point.x - x, point.y - y);
    if (!best || distance < best.distance) best = { anchor, point, distance };
  }
  return best;
}

export function elementAt(elements, x, y, ignoreId) {
  for (let index = elements.length - 1; index >= 0; index -= 1) {
    const element = elements[index];
    if (!connectorKind(element) || element.id === ignoreId) continue;
    const local = localPoint(element, x, y);
    const pad = 18;
    const width = element.width || 0;
    const height = element.height || 0;
    if (local.x >= -pad && local.x <= width + pad && local.y >= -pad && local.y <= height + pad) return element;
  }
  return null;
}

export function snapEnd(elements, x, y, ignoreId) {
  const host = elementAt(elements, x, y, ignoreId);
  if (!host) return null;
  const near = nearestAnchor(host, x, y);
  if (!near || near.distance > ANCHOR_SNAP) return null;
  return { id: host.id, kind: connectorKind(host), anchor: near.anchor, x: near.point.x, y: near.point.y, distance: near.distance };
}

function hostRadius(element) {
  const value = cornerRadius(element);
  if (Array.isArray(value) || value) return value;
  return element.type === 'sticky' ? 8 : 0;
}

export function connectionTargets(elements, x, y, ignoreId) {
  const hosts = [];
  for (const element of elements) {
    const kind = connectorKind(element);
    if (!kind || element.id === ignoreId) continue;
    const anchors = ANCHOR_NAMES.map((anchor) => {
      const point = anchorPoint(element, anchor);
      return { anchor, x: point.x, y: point.y, distance: Math.hypot(point.x - x, point.y - y) };
    });
    const nearest = anchors.reduce((best, item) => (item.distance < best.distance ? item : best));
    if (nearest.distance > ANCHOR_APPROACH && !elementAt([element], x, y, ignoreId)) continue;
    hosts.push({
      id: element.id,
      kind,
      x: element.x,
      y: element.y,
      width: element.width || 0,
      height: element.height || 0,
      rotation: element.rotation || 0,
      radius: hostRadius(element),
      anchors: anchors.map(({ anchor, x: ax, y: ay }) => ({ anchor, x: ax, y: ay })),
    });
  }
  return { hosts, active: snapEnd(elements, x, y, ignoreId) };
}

function bindEnd(element, elements, atEnd) {
  const points = element.points;
  const worldX = element.x + (atEnd ? points[points.length - 2] : points[0]);
  const worldY = element.y + (atEnd ? points[points.length - 1] : points[1]);
  const hit = snapEnd(elements, worldX, worldY, element.id);
  if (!hit) return null;
  return { id: hit.id, anchor: hit.anchor, x: hit.x - element.x, y: hit.y - element.y };
}

export function attachEnds(element, elements) {
  if (!isConnector(element)) return null;
  const points = element.points.slice();
  const fromHit = bindEnd(element, elements, false);
  const toHit = bindEnd(element, elements, true);
  if (!fromHit && !toHit) return null;
  if (fromHit) {
    points[0] = fromHit.x;
    points[1] = fromHit.y;
  }
  if (toHit) {
    points[points.length - 2] = toHit.x;
    points[points.length - 1] = toHit.y;
  }
  const normalFor = (hit) => {
    if (!hit) return null;
    const host = elements.find((item) => item.id === hit.id);
    return anchorNormal(host?.rotation || 0, hit.anchor);
  };
  const fromNormal = normalFor(fromHit);
  const toNormal = normalFor(toHit);
  return {
    points,
    from: fromHit ? { id: fromHit.id, anchor: fromHit.anchor, nx: fromNormal?.[0] || 0, ny: fromNormal?.[1] || 0 } : null,
    to: toHit ? { id: toHit.id, anchor: toHit.anchor, nx: toNormal?.[0] || 0, ny: toNormal?.[1] || 0 } : null,
  };
}

export function syncConnectors(elements) {
  const byId = new Map(elements.map((element) => [element.id, element]));
  return elements.map((element) => {
    if (!isConnector(element) || (!element.from && !element.to)) return element;
    const points = element.points.slice();
    let from = element.from;
    let to = element.to;
    if (element.from) {
      const host = byId.get(element.from.id);
      const point = host && anchorPoint(host, element.from.anchor);
      if (point) {
        points[0] = point.x - element.x;
        points[1] = point.y - element.y;
        const normal = anchorNormal(host.rotation, element.from.anchor);
        if (normal) from = { ...element.from, nx: normal[0], ny: normal[1] };
      }
    }
    if (element.to) {
      const host = byId.get(element.to.id);
      const point = host && anchorPoint(host, element.to.anchor);
      if (point) {
        points[points.length - 2] = point.x - element.x;
        points[points.length - 1] = point.y - element.y;
        const normal = anchorNormal(host.rotation, element.to.anchor);
        if (normal) to = { ...element.to, nx: normal[0], ny: normal[1] };
      }
    }
    return { ...element, points, from, to };
  });
}

export function localPoint(element, x, y) {
  const rad = (-(element.rotation || 0) * Math.PI) / 180;
  const dx = x - element.x;
  const dy = y - element.y;
  return {
    x: dx * Math.cos(rad) - dy * Math.sin(rad),
    y: dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

export function cornerRadius(element) {
  if (Array.isArray(element?.radii) && element.radii.length === 4) {
    return element.radii.map((value) => Number(value) || 0);
  }
  return element?.radius || 0;
}
