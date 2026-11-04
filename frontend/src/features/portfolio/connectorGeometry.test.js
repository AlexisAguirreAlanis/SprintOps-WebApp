import assert from 'node:assert/strict';
import test from 'node:test';
import {
  anchorPoint,
  arrowPath,
  attachEnds,
  connectionTargets,
  headKind,
  insertVertex,
  pointAlong,
  removeVertex,
  syncConnectors,
  parallelCopies,
  trimPolyline,
} from './connectorGeometry.js';

test('un conector antiguo sigue teniendo punta al final', () => {
  const element = { type: 'line', points: [0, 0, 100, 0] };
  assert.equal(headKind(element, true), 'triangle');
  assert.equal(headKind(element, false), 'none');
  assert.equal(headKind({ ...element, headEnd: 'none' }, true), 'none');
});

test('la curva guarda un punto de control y el codo redondo no es una sola recta', () => {
  const curve = arrowPath({ points: [0, 0, 120, 0], route: 'curve', bend: 40 });
  assert.equal(curve.points.length, 6);
  assert.ok(curve.tension > 0);
  const round = arrowPath({ points: [0, 0, 160, 80], route: 'round', corner: 24 });
  assert.ok(round.points.length > 8);
});

test('la línea doble se abre y la triple conserva el eje', () => {
  const [left, right] = parallelCopies([0, 0, 100, 0], 2, 8);
  assert.equal(left[1], -4);
  assert.equal(right[1], 4);
  const triple = parallelCopies([0, 0, 100, 0], 3, 6);
  assert.equal(triple.length, 3);
  assert.equal(triple[1][1], 0);
  assert.deepEqual(parallelCopies([0, 0, 40, 0], 1, 8), [[0, 0, 40, 0]]);
});

test('recortar el trazo no mueve el extremo más que el tamaño de la cabeza', () => {
  const trimmed = trimPolyline([0, 0, 100, 0], 0, 18);
  assert.ok(trimmed[2] < 100);
  assert.ok(trimmed[2] > 80);
});

test('doble clic inserta un vértice y otro doble clic en el medio lo quita', () => {
  const next = insertVertex([0, 0, 100, 0], 50, 1);
  assert.equal(next.length, 6);
  assert.ok(Math.abs(next[2] - 50) < 2);
  assert.deepEqual(removeVertex(next, 1), [0, 0, 100, 0]);
});

test('la etiqueta recorre el trazado', () => {
  const middle = pointAlong([0, 0, 100, 0], 0.5);
  assert.equal(middle.x, 50);
  assert.equal(middle.y, 0);
});

test('al mover un objeto el conector conserva el ancla', () => {
  const card = { id: 'card', type: 'rect', x: 0, y: 0, width: 100, height: 40, rotation: 0 };
  const arrow = {
    id: 'arrow',
    type: 'line',
    x: 0,
    y: 0,
    points: [100, 20, 180, 20],
    to: null,
    from: { id: 'card', anchor: 'right' },
  };
  const moved = syncConnectors([{ ...card, x: 30 }, arrow]);
  const synced = moved.find((element) => element.id === 'arrow');
  assert.equal(synced.points[0], 130);
  assert.equal(synced.points[1], 20);
});

test('al girar una figura el ancla sigue la misma esquina que el lienzo', () => {
  const card = { id: 'card', type: 'rect', x: 10, y: 20, width: 100, height: 40, rotation: 90 };
  const right = anchorPoint(card, 'right');
  assert.ok(Math.abs(right.x - (10 - 20)) < 0.01);
  assert.ok(Math.abs(right.y - (20 + 100)) < 0.01);
});

test('mover una punta muestra el ancla del tipo de elemento cercano', () => {
  const card = { id: 'card', type: 'rect', x: 0, y: 0, width: 120, height: 80 };
  const note = { id: 'note', type: 'sticky', x: 400, y: 0, width: 80, height: 80 };
  const round = { id: 'round', type: 'ellipse', x: 0, y: 200, width: 100, height: 60 };
  const title = { id: 'title', type: 'text', x: 0, y: 400, width: 80, height: 24 };
  const nearSide = connectionTargets([card, note, round, title], 4, 40, 'arrow');
  assert.equal(nearSide.active.id, 'card');
  assert.equal(nearSide.active.anchor, 'left');
  assert.equal(nearSide.hosts.find((host) => host.id === 'card').kind, 'box');
  assert.equal(connectionTargets([round], 100, 230, 'arrow').hosts[0].kind, 'ellipse');
  assert.equal(connectionTargets([title], 40, 400, 'arrow').hosts[0].kind, 'text');
  assert.equal(connectionTargets([note], 0, 0, 'arrow').hosts.length, 0);
  const line = { id: 'line', type: 'line', x: 0, y: 0, width: 10, height: 10, points: [0, 0, 10, 0] };
  assert.equal(connectionTargets([line], 2, 0, 'arrow').hosts.length, 0);
});

test('soltar una flecha sobre una figura guarda la relación por id', () => {
  const card = { id: 'card', type: 'rect', x: 200, y: 40, width: 80, height: 40 };
  const arrow = { id: 'arrow', type: 'line', x: 0, y: 0, points: [0, 60, 210, 60] };
  const link = attachEnds(arrow, [card, arrow]);
  assert.equal(link.to.id, 'card');
  assert.equal(link.to.anchor, 'left');
});
