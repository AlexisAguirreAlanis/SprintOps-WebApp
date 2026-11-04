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

function roundedElbow(x1, y1, x2, y2, radius) {
  const mid = (x1 + x2) / 2;
  const vertical = Math.abs(y2 - y1);
  const horizontal = Math.abs(mid - x1);
  const room = Math.min(radius, horizontal, vertical / 2, 64);
  if (room < 6) return [x1, y1, mid, y1, mid, y2, x2, y2];
  const sx = Math.sign(mid - x1) || 1;
  const sy = Math.sign(y2 - y1) || 1;
  const sx2 = Math.sign(x2 - mid) || sx;
  const samples = [];
  for (let step = 0; step <= 5; step += 1) {
    const t = (step / 5) * (Math.PI / 2);
    samples.push(mid - sx * room * Math.cos(t), y1 + sy * room * Math.sin(t));
  }
  for (let step = 0; step <= 5; step += 1) {
    const t = (step / 5) * (Math.PI / 2);
    samples.push(mid + sx2 * room * Math.sin(t), y2 - sy * room * Math.cos(t));
  }
  return [x1, y1, ...samples, x2, y2];
}

export function arrowPath(element) {
  const points = element.points;
  if (!points || points.length < 4) return { points: [0, 0, 40, 0], tension: 0 };
  if (points.length > 4 || element.route === 'poly') return { points, tension: 0 };
  const [x1, y1, x2, y2] = points;
  const route = element.route || 'straight';
  if (route === 'elbow') {
    const mid = (x1 + x2) / 2;
    return { points: [x1, y1, mid, y1, mid, y2, x2, y2], tension: 0 };
  }
  if (route === 'round') {
    return { points: roundedElbow(x1, y1, x2, y2, element.corner || 28), tension: 0 };
  }
  if (route === 'curve') {
    const bend = Number.isFinite(element.bend) ? element.bend : defaultBend(points);
    const control = controlPoint(points, bend);
    return { points: [x1, y1, control.x, control.y, x2, y2], tension: 0.55, control };
  }
  return { points: [x1, y1, x2, y2], tension: 0 };
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
  if (atEnd) {
    const last = points.length;
    return Math.atan2(points[last - 1] - points[last - 3], points[last - 2] - points[last - 4]);
  }
  return Math.atan2(points[1] - points[3], points[0] - points[2]);
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
  return {
    points,
    from: fromHit ? { id: fromHit.id, anchor: fromHit.anchor } : null,
    to: toHit ? { id: toHit.id, anchor: toHit.anchor } : null,
  };
}

export function syncConnectors(elements) {
  const byId = new Map(elements.map((element) => [element.id, element]));
  return elements.map((element) => {
    if (!isConnector(element) || (!element.from && !element.to)) return element;
    const points = element.points.slice();
    if (element.from) {
      const host = byId.get(element.from.id);
      const point = host && anchorPoint(host, element.from.anchor);
      if (point) {
        points[0] = point.x - element.x;
        points[1] = point.y - element.y;
      }
    }
    if (element.to) {
      const host = byId.get(element.to.id);
      const point = host && anchorPoint(host, element.to.anchor);
      if (point) {
        points[points.length - 2] = point.x - element.x;
        points[points.length - 1] = point.y - element.y;
      }
    }
    return { ...element, points };
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
