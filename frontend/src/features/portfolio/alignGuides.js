const GUIDE = '#67BFA1';

function edges(box) {
  return {
    left: box.x,
    right: box.x + box.width,
    cx: box.x + box.width / 2,
    top: box.y,
    bottom: box.y + box.height,
    cy: box.y + box.height / 2,
  };
}

function overlaps(a0, a1, b0, b1) {
  return a0 < b1 && b0 < a1;
}

export function snapBox(box, others, artboard, threshold = 6) {
  const verticals = [];
  const horizontals = [];
  const add = (item) => {
    const edge = edges(item);
    verticals.push(edge.left, edge.cx, edge.right);
    horizontals.push(edge.top, edge.cy, edge.bottom);
  };
  others.forEach(add);
  if (artboard) add(artboard);

  const self = edges(box);
  let dx = 0;
  let dy = 0;
  let bestX = threshold + 1;
  let bestY = threshold + 1;
  let lineX = null;
  let lineY = null;
  const xAnchors = [self.left, self.cx, self.right];
  const yAnchors = [self.top, self.cy, self.bottom];

  verticals.forEach((value) => {
    xAnchors.forEach((anchor) => {
      const delta = value - anchor;
      const distance = Math.abs(delta);
      if (distance <= threshold && distance < bestX) {
        bestX = distance;
        dx = delta;
        lineX = value;
      }
    });
  });
  horizontals.forEach((value) => {
    yAnchors.forEach((anchor) => {
      const delta = value - anchor;
      const distance = Math.abs(delta);
      if (distance <= threshold && distance < bestY) {
        bestY = distance;
        dy = delta;
        lineY = value;
      }
    });
  });

  const moved = { x: box.x + dx, y: box.y + dy, width: box.width, height: box.height };
  const guides = [];
  if (lineX != null) {
    const tops = [moved.y, ...others.map((item) => item.y)];
    const bottoms = [moved.y + moved.height, ...others.map((item) => item.y + item.height)];
    guides.push({ x1: lineX, y1: Math.min(...tops), x2: lineX, y2: Math.max(...bottoms) });
  }
  if (lineY != null) {
    const lefts = [moved.x, ...others.map((item) => item.x)];
    const rights = [moved.x + moved.width, ...others.map((item) => item.x + item.width)];
    guides.push({ x1: Math.min(...lefts), y1: lineY, x2: Math.max(...rights), y2: lineY });
  }
  guides.push(...gapGuides(moved, others));
  return { dx, dy, guides };
}

function gapGuides(box, others) {
  const guides = [];
  const midY = box.y + box.height / 2;
  const midX = box.x + box.width / 2;
  const beside = others.filter((item) => overlaps(box.y, box.y + box.height, item.y, item.y + item.height));
  const stacked = others.filter((item) => overlaps(box.x, box.x + box.width, item.x, item.x + item.width));
  const left = nearest(beside.filter((item) => item.x + item.width <= box.x + 0.5), (item) => box.x - (item.x + item.width));
  const right = nearest(beside.filter((item) => item.x >= box.x + box.width - 0.5), (item) => item.x - (box.x + box.width));
  const above = nearest(stacked.filter((item) => item.y + item.height <= box.y + 0.5), (item) => box.y - (item.y + item.height));
  const below = nearest(stacked.filter((item) => item.y >= box.y + box.height - 0.5), (item) => item.y - (box.y + box.height));
  pushGap(guides, left, box.x, midY, true);
  pushGap(guides, right, box.x + box.width, midY, false);
  pushGap(guides, above, midX, box.y, true, true);
  pushGap(guides, below, midX, box.y + box.height, false, true);
  return guides;
}

function nearest(items, distance) {
  return items.reduce((best, item) => {
    const gap = distance(item);
    if (gap < 0 || gap > 480) return best;
    if (!best || gap < best.gap) return { item, gap };
    return best;
  }, null);
}

function pushGap(guides, found, x, y, before, vertical = false) {
  if (!found) return;
  const gap = Math.round(found.gap);
  if (gap <= 0) return;
  if (vertical) {
    const y1 = before ? y - gap : y;
    const y2 = before ? y : y + gap;
    guides.push({ x1: x, y1, x2: x, y2, label: String(gap), measure: true });
    return;
  }
  const x1 = before ? x - gap : x;
  const x2 = before ? x : x + gap;
  guides.push({ x1, y1: y, x2, y2: y, label: String(gap), measure: true });
}

export const GUIDE_COLOR = GUIDE;
