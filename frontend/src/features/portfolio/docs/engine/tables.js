// Operaciones de tabla: filas/columnas, combinar/dividir, tamaños, bordes, estilos, orden y fórmulas.

export const TABLE_STYLES = [
  { id: 'grid', label: 'Cuadrícula' },
  { id: 'plain', label: 'Sin bordes' },
  { id: 'striped', label: 'Bandas' },
  { id: 'accent', label: 'Encabezado de color' },
  { id: 'minimal', label: 'Minimalista' },
  { id: 'dark', label: 'Oscura' },
];

const DRAW_INK = '1.5px solid #334155';

function overlaps(a0, a1, b0, b1) {
  return Math.min(a1, b1) - Math.max(a0, b0);
}

/** Tabla de una celda, del tamaño del trazo. */
export function placeDrawnTable(anchor, width, height) {
  const host = document.createElement('div');
  host.innerHTML = tableHtml(1, 1, { header: false, style: 'plain' });
  const table = host.querySelector('table');
  table.classList.add('wd-drawn');
  const w = Math.max(64, Math.round(width));
  const h = Math.max(36, Math.round(height));
  table.style.width = `${w}px`;
  table.style.height = `${h}px`;
  const cell = table.querySelector('td');
  if (cell) {
    cell.style.height = `${h}px`;
    cell.style.border = DRAW_INK;
  }
  const block = anchor?.closest?.('p, h1, h2, h3, h4, h5, h6, li, blockquote') || null;
  if (block?.parentElement) block.after(...host.childNodes);
  else if (anchor?.append) anchor.append(...host.childNodes);
  return table;
}

/**
 * Parte las celdas que cruza el trazo. Una línea horizontal abre una fila
 * solo en esas celdas; el resto de la fila conserva el alto. Igual en vertical.
 */
export function paintDivider(table, { x0, y0, x1, y1 }) {
  if (Math.hypot(x1 - x0, y1 - y0) < 14) return false;
  table.style.borderCollapse = 'collapse';
  const horizontal = Math.abs(x1 - x0) >= Math.abs(y1 - y0);
  return horizontal
    ? paintRow(table, (y0 + y1) / 2, Math.min(x0, x1), Math.max(x0, x1))
    : paintColumn(table, (x0 + x1) / 2, Math.min(y0, y1), Math.max(y0, y1));
}

function paintRow(table, y, x0, x1) {
  const row = [...table.rows].find((item) => {
    const box = item.getBoundingClientRect();
    return y > box.top + 7 && y < box.bottom - 7;
  });
  if (!row) return false;
  const box = row.getBoundingClientRect();
  const fraction = (y - box.top) / Math.max(1, box.height);
  if (fraction < 0.18 || fraction > 0.82) return false;
  const cells = [...row.cells];
  const hits = cells.filter((cell) => overlaps(x0, x1, cell.getBoundingClientRect().left, cell.getBoundingClientRect().right) > 10 && cell.rowSpan === 1);
  if (!hits.length) return false;
  const fresh = document.createElement('tr');
  const top = Math.max(22, Math.round(row.offsetHeight * fraction));
  const below = Math.max(22, row.offsetHeight - top);
  row.style.height = `${top}px`;
  fresh.style.height = `${below}px`;
  table.style.height = 'auto';
  cells.forEach((cell) => {
    if (!hits.includes(cell)) {
      cell.rowSpan += 1;
      return;
    }
    const next = newCell('td');
    next.style.border = DRAW_INK;
    next.style.height = `${below}px`;
    cell.style.height = `${top}px`;
    cell.style.borderBottom = DRAW_INK;
    fresh.append(next);
  });
  if (!fresh.cells.length) return false;
  row.after(fresh);
  return true;
}

function paintColumn(table, x, y0, y1) {
  const origin = [...table.querySelectorAll('td, th')].find((cell) => {
    const box = cell.getBoundingClientRect();
    return x > box.left + 7 && x < box.right - 7;
  });
  if (!origin) return false;
  const fraction = (x - origin.getBoundingClientRect().left) / Math.max(1, origin.getBoundingClientRect().width);
  if (fraction < 0.18 || fraction > 0.82) return false;
  const { c } = position(table, origin);
  const grid = gridOf(table);
  const seen = new Set();
  const jobs = [];
  grid.forEach((line) => {
    const cell = line[c];
    if (!cell || seen.has(cell)) return;
    seen.add(cell);
    const box = cell.getBoundingClientRect();
    const crosses = overlaps(y0, y1, box.top, box.bottom) > 10 && cell.colSpan === 1;
    jobs.push({ cell, split: crosses });
  });
  if (!jobs.some((job) => job.split)) return false;
  jobs.forEach((job) => {
    if (!job.split) {
      job.cell.colSpan += 1;
      return;
    }
    const width = job.cell.offsetWidth;
    const left = Math.max(24, Math.round(width * fraction));
    const right = Math.max(24, Math.round(width - left));
    const next = newCell('td');
    next.style.border = DRAW_INK;
    next.style.width = `${right}px`;
    job.cell.style.width = `${left}px`;
    job.cell.style.borderRight = DRAW_INK;
    job.cell.after(next);
  });
  return true;
}

export function tableHtml(rows, cols, { header = true, style = 'grid' } = {}) {
  const cells = (tag) => Array.from({ length: cols }, () => `<${tag}><br></${tag}>`).join('');
  const body = Array.from({ length: rows }, (_, index) => `<tr>${cells(index === 0 && header ? 'th' : 'td')}</tr>`).join('');
  return `<table class="wd-tbl-${style}"><tbody>${body}</tbody></table><p><br></p>`;
}

export function cellOf(node) {
  const el = node?.nodeType === 3 ? node.parentElement : node;
  return el?.closest?.('td, th') || null;
}

/** Mapa de la tabla en una cuadrícula lógica que respeta colspan/rowspan. */
export function gridOf(table) {
  const grid = [];
  [...table.rows].forEach((row, r) => {
    grid[r] = grid[r] || [];
    let c = 0;
    [...row.cells].forEach((cell) => {
      while (grid[r][c]) c += 1;
      for (let dr = 0; dr < cell.rowSpan; dr += 1) {
        for (let dc = 0; dc < cell.colSpan; dc += 1) {
          grid[r + dr] = grid[r + dr] || [];
          grid[r + dr][c + dc] = cell;
        }
      }
      c += cell.colSpan;
    });
  });
  return grid;
}

function position(table, cell) {
  const grid = gridOf(table);
  for (let r = 0; r < grid.length; r += 1) {
    const c = grid[r].indexOf(cell);
    if (c >= 0) return { r, c, grid };
  }
  return { r: 0, c: 0, grid };
}

function newCell(tag = 'td') {
  const cell = document.createElement(tag);
  cell.innerHTML = '<br>';
  return cell;
}

export function addRow(cell, after = true) {
  const row = cell.parentElement;
  const table = row.closest('table');
  const width = Math.max(...gridOf(table).map((line) => line.length));
  const clone = document.createElement('tr');
  for (let c = 0; c < width; c += 1) clone.append(newCell('td'));
  if (after) row.after(clone);
  else row.before(clone);
  return clone.cells[0];
}

export function addColumn(cell, after = true) {
  const table = cell.closest('table');
  const { grid, c } = position(table, cell);
  const target = after ? c + cell.colSpan : c;
  [...table.rows].forEach((row, r) => {
    const tag = row.cells[0]?.tagName.toLowerCase() === 'th' ? 'th' : 'td';
    const ref = grid[r]?.[target];
    const fresh = newCell(tag);
    if (ref && ref.parentElement === row) ref.before(fresh);
    else if (ref) ref.colSpan += 1;
    else row.append(fresh);
  });
}

export function deleteRow(cell) {
  const table = cell.closest('table');
  cell.parentElement.remove();
  if (!table.rows.length) table.remove();
}

export function deleteColumn(cell) {
  const table = cell.closest('table');
  const { grid, c } = position(table, cell);
  const seen = new Set();
  grid.forEach((line) => {
    const target = line[c];
    if (!target || seen.has(target)) return;
    seen.add(target);
    if (target.colSpan > 1) target.colSpan -= 1;
    else target.remove();
  });
  [...table.rows].forEach((row) => { if (!row.cells.length) row.remove(); });
  if (!table.rows.length) table.remove();
}

export function selectedCells(table, range) {
  if (!table || !range) return [];
  return [...table.querySelectorAll('td, th')].filter((cell) => range.intersectsNode(cell));
}

export function mergeCells(cells) {
  if (cells.length < 2) return false;
  const table = cells[0].closest('table');
  const grid = gridOf(table);
  const coords = [];
  grid.forEach((line, r) => line.forEach((cell, c) => { if (cells.includes(cell)) coords.push([r, c]); }));
  const r0 = Math.min(...coords.map(([r]) => r));
  const r1 = Math.max(...coords.map(([r]) => r));
  const c0 = Math.min(...coords.map(([, c]) => c));
  const c1 = Math.max(...coords.map(([, c]) => c));
  const first = grid[r0][c0];
  const absorbed = new Set();
  for (let r = r0; r <= r1; r += 1) for (let c = c0; c <= c1; c += 1) if (grid[r][c] && grid[r][c] !== first) absorbed.add(grid[r][c]);
  absorbed.forEach((cell) => {
    if (cell.textContent.trim()) first.insertAdjacentHTML('beforeend', ` ${cell.innerHTML}`);
    cell.remove();
  });
  first.colSpan = c1 - c0 + 1;
  first.rowSpan = r1 - r0 + 1;
  [...table.rows].forEach((row) => { if (!row.cells.length) row.remove(); });
  return true;
}

export function splitCell(cell, cols = 2, rows = 1) {
  if (cell.colSpan > 1 || cell.rowSpan > 1) {
    const table = cell.closest('table');
    const { r, c } = position(table, cell);
    const spanR = cell.rowSpan;
    const spanC = cell.colSpan;
    cell.colSpan = 1;
    cell.rowSpan = 1;
    for (let dc = 1; dc < spanC; dc += 1) cell.after(newCell(cell.tagName.toLowerCase()));
    for (let dr = 1; dr < spanR; dr += 1) {
      const row = table.rows[r + dr];
      const grid = gridOf(table);
      const ref = grid[r + dr]?.slice(c + spanC).find((item) => item && item.parentElement === row);
      for (let dc = 0; dc < spanC; dc += 1) {
        const fresh = newCell('td');
        if (ref) ref.before(fresh);
        else row.append(fresh);
      }
    }
    return;
  }
  const table = cell.closest('table');
  const { c, grid } = position(table, cell);
  for (let index = 1; index < cols; index += 1) cell.after(newCell(cell.tagName.toLowerCase()));
  const seen = new Set([cell]);
  grid.forEach((line) => {
    const other = line[c];
    if (other && !seen.has(other)) {
      seen.add(other);
      other.colSpan += cols - 1;
    }
  });
  for (let index = 1; index < rows; index += 1) {
    const row = cell.parentElement;
    const fresh = document.createElement('tr');
    [...row.cells].forEach((item) => {
      if (item === cell || item.previousElementSibling === cell || cols > 1) fresh.append(newCell('td'));
      else item.rowSpan += 1;
    });
    row.after(fresh);
  }
}

export function splitTable(cell) {
  const row = cell.parentElement;
  const table = row.closest('table');
  if (row.rowIndex === 0) return null;
  const rest = table.cloneNode(false);
  const body = document.createElement('tbody');
  rest.append(body);
  let next = row;
  while (next) {
    const following = next.nextElementSibling;
    body.append(next);
    next = following;
  }
  const gap = document.createElement('p');
  gap.innerHTML = '<br>';
  table.after(gap, rest);
  return rest;
}

export function distributeColumns(table) {
  const width = Math.max(...gridOf(table).map((line) => line.length));
  table.style.tableLayout = 'fixed';
  table.style.width = '100%';
  table.querySelector('colgroup')?.remove();
  const group = document.createElement('colgroup');
  for (let index = 0; index < width; index += 1) {
    const col = document.createElement('col');
    col.style.width = `${(100 / width).toFixed(3)}%`;
    group.append(col);
  }
  table.prepend(group);
}

export function distributeRows(table) {
  const max = Math.max(...[...table.rows].map((row) => row.offsetHeight));
  [...table.rows].forEach((row) => { row.style.height = `${max}px`; });
}

export function autofit(table, mode) {
  table.querySelector('colgroup')?.remove();
  if (mode === 'content') {
    table.style.width = 'auto';
    table.style.tableLayout = 'auto';
  } else {
    table.style.width = '100%';
    table.style.tableLayout = 'auto';
  }
}

export function setBorders(table, cells, { mode = 'all', color = '#cbd5e1', width = 1, style = 'solid' }) {
  const line = mode === 'none' ? 'none' : `${width}px ${style} ${color}`;
  const whole = ['all', 'none', 'outer', 'inner'].includes(mode);
  const targets = whole ? (cells.length > 1 ? cells : [...table.querySelectorAll('td, th')]) : (cells.length ? cells : [...table.querySelectorAll('td, th')]);
  const grid = gridOf(table);
  const maxR = grid.length - 1;
  const maxC = Math.max(0, ...grid.map((row) => row.length)) - 1;
  const sideKey = (side) => `border${side[0].toUpperCase()}${side.slice(1)}`;
  if (mode === 'diagDown' || mode === 'diagUp') {
    const angle = mode === 'diagDown' ? 'to bottom right' : 'to top right';
    const half = Math.max(Number(width) || 1, 1) / 2;
    targets.forEach((cell) => {
      cell.style.backgroundImage = `linear-gradient(${angle}, transparent calc(50% - ${half}px), ${color} calc(50% - ${half}px), ${color} calc(50% + ${half}px), transparent calc(50% + ${half}px))`;
    });
    return;
  }
  if (mode === 'top' || mode === 'right' || mode === 'bottom' || mode === 'left') {
    targets.forEach((cell) => { cell.style[sideKey(mode)] = line; });
    table.style.borderCollapse = 'collapse';
    return;
  }
  if (mode === 'horizontal' || mode === 'vertical') {
    targets.forEach((cell) => {
      const { r, c } = position(table, cell);
      if (mode === 'horizontal' && r + cell.rowSpan - 1 < maxR) cell.style.borderBottom = line;
      if (mode === 'vertical' && c + cell.colSpan - 1 < maxC) cell.style.borderRight = line;
    });
    table.style.borderCollapse = 'collapse';
    return;
  }
  targets.forEach((cell) => {
    const { r, c } = position(table, cell);
    const edges = { top: r === 0, left: c === 0, bottom: r + cell.rowSpan - 1 === maxR, right: c + cell.colSpan - 1 === maxC };
    ['top', 'right', 'bottom', 'left'].forEach((side) => {
      if (mode === 'all' || mode === 'none') cell.style[sideKey(side)] = line;
      else if (mode === 'outer') cell.style[sideKey(side)] = edges[side] ? line : 'none';
      else if (mode === 'inner') cell.style[sideKey(side)] = edges[side] ? 'none' : line;
    });
    if (mode === 'none') cell.style.backgroundImage = '';
  });
  table.style.borderCollapse = 'collapse';
}

export function applyTableStyle(table, style) {
  [...table.classList].filter((name) => name.startsWith('wd-tbl-')).forEach((name) => table.classList.remove(name));
  table.classList.add(`wd-tbl-${style}`);
}

export function setRepeatHeader(table, on) {
  table.dataset.repeatHeader = on ? 'true' : 'false';
  const first = table.rows[0];
  if (on && first) [...first.cells].forEach((cell) => {
    if (cell.tagName === 'TD') {
      const th = document.createElement('th');
      th.innerHTML = cell.innerHTML;
      th.setAttribute('style', cell.getAttribute('style') || '');
      cell.replaceWith(th);
    }
  });
}

export function sortTable(table, columnIndex, direction = 'asc', hasHeader = true) {
  const rows = [...table.rows];
  const head = hasHeader ? rows.shift() : null;
  const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });
  rows.sort((a, b) => collator.compare(a.cells[columnIndex]?.textContent.trim() || '', b.cells[columnIndex]?.textContent.trim() || '') * (direction === 'asc' ? 1 : -1));
  const body = table.tBodies[0] || table;
  body.innerHTML = '';
  if (head) body.append(head);
  body.append(...rows);
}

export function textToTable(blocks, separator = '\t') {
  const split = (text) => (separator === 'auto' ? text.split(/\t|;|,/) : text.split(separator));
  const rows = blocks.map((block) => split(block.textContent));
  const cols = Math.max(...rows.map((row) => row.length));
  const table = document.createElement('table');
  table.className = 'wd-tbl-grid';
  const body = document.createElement('tbody');
  rows.forEach((cells, index) => {
    const tr = document.createElement('tr');
    for (let c = 0; c < cols; c += 1) {
      const cell = document.createElement(index === 0 ? 'th' : 'td');
      cell.textContent = (cells[c] || '').trim();
      if (!cell.textContent) cell.innerHTML = '<br>';
      tr.append(cell);
    }
    body.append(tr);
  });
  table.append(body);
  blocks[0].before(table);
  blocks.forEach((block) => block.remove());
  return table;
}

export function tableToText(table, separator = '\t') {
  const fragment = document.createDocumentFragment();
  [...table.rows].forEach((row) => {
    const p = document.createElement('p');
    p.textContent = [...row.cells].map((cell) => cell.textContent.trim()).join(separator);
    fragment.append(p);
  });
  table.replaceWith(fragment);
}

// ---- Fórmulas sencillas: =SUM(ABOVE), =AVERAGE(LEFT), =SUM(A1:B3), =A1*B2 ----

const toNumber = (text) => {
  const value = Number(String(text).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(value) ? value : 0;
};

function cellValue(grid, ref) {
  const match = /^([A-Z]+)(\d+)$/i.exec(ref);
  if (!match) return 0;
  const col = match[1].toUpperCase().split('').reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const cell = grid[Number(match[2]) - 1]?.[col];
  return cell ? toNumber(cell.textContent) : 0;
}

function rangeValues(grid, from, to) {
  const parse = (ref) => {
    const m = /^([A-Z]+)(\d+)$/i.exec(ref);
    return [Number(m[2]) - 1, m[1].toUpperCase().split('').reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0) - 1];
  };
  const [r0, c0] = parse(from);
  const [r1, c1] = parse(to);
  const values = [];
  for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r += 1) for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c += 1) if (grid[r]?.[c]) values.push(toNumber(grid[r][c].textContent));
  return values;
}

const FUNCS = {
  SUM: (v) => v.reduce((a, b) => a + b, 0),
  AVERAGE: (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0),
  MIN: (v) => (v.length ? Math.min(...v) : 0),
  MAX: (v) => (v.length ? Math.max(...v) : 0),
  COUNT: (v) => v.length,
  PRODUCT: (v) => v.reduce((a, b) => a * b, 1),
};

export function evaluateFormula(table, cell, formula) {
  const grid = gridOf(table);
  const { r, c } = position(table, cell);
  const expr = formula.replace(/^=/, '').trim().toUpperCase();
  const fn = /^(SUM|AVERAGE|MIN|MAX|COUNT|PRODUCT)\((.*)\)$/.exec(expr);
  if (fn) {
    const arg = fn[2].trim();
    let values = [];
    if (arg === 'ABOVE') for (let rr = r - 1; rr >= 0; rr -= 1) { if (grid[rr][c] && grid[rr][c] !== cell && grid[rr][c].tagName === 'TD') values.push(toNumber(grid[rr][c].textContent)); }
    else if (arg === 'LEFT') for (let cc = c - 1; cc >= 0; cc -= 1) { if (grid[r][cc]) values.push(toNumber(grid[r][cc].textContent)); }
    else if (arg === 'BELOW') for (let rr = r + 1; rr < grid.length; rr += 1) { if (grid[rr][c]) values.push(toNumber(grid[rr][c].textContent)); }
    else if (arg === 'RIGHT') for (let cc = c + 1; cc < grid[r].length; cc += 1) { if (grid[r][cc]) values.push(toNumber(grid[r][cc].textContent)); }
    else if (arg.includes(':')) values = rangeValues(grid, ...arg.split(':'));
    else values = arg.split(/[;,]/).map((ref) => cellValue(grid, ref.trim()));
    return FUNCS[fn[1]](values);
  }
  const arithmetic = expr.replace(/[A-Z]+\d+/g, (ref) => String(cellValue(grid, ref)));
  if (!/^[\d+\-*/().\s]+$/.test(arithmetic)) return NaN;
  try {
    return Function(`"use strict";return (${arithmetic})`)();
  } catch {
    return NaN;
  }
}

export function recalcFormulas(root) {
  root.querySelectorAll('td[data-formula], th[data-formula]').forEach((cell) => {
    const table = cell.closest('table');
    const value = evaluateFormula(table, cell, cell.dataset.formula);
    cell.textContent = Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '#ERROR';
  });
}
