// Diagramas tipo SmartArt a partir de una lista con sangría (dos espacios = un nivel).

import { escapeHtml } from '../sanitize';
import { PALETTES } from './charts';

export const DIAGRAM_TYPES = {
  process: 'Proceso',
  hierarchy: 'Jerarquía',
  org: 'Organigrama',
  cycle: 'Ciclo',
  relationship: 'Relación',
  matrix: 'Matriz',
  pyramid: 'Pirámide',
  list: 'Lista',
};

const SAMPLES = {
  process: 'Idea\nDiseño\nDesarrollo\nPruebas\nLanzamiento',
  hierarchy: 'Producto\n  Frontend\n    Web\n    Móvil\n  Backend\n    API\n    Datos',
  org: 'Dirección\n  Product Owner\n  Scrum Master\n    Desarrollo\n    QA',
  cycle: 'Planear\nHacer\nRevisar\nAjustar',
  relationship: 'Negocio\nTecnología\nUsuarios',
  matrix: 'Urgente e importante\nImportante, no urgente\nUrgente, no importante\nNi urgente ni importante',
  pyramid: 'Visión\nEstrategia\nTácticas\nOperación',
  list: 'Objetivo\nAlcance\nEntregables\nRiesgos',
};

export function defaultDiagramSpec(type = 'process') {
  return { type, text: SAMPLES[type] || SAMPLES.process, palette: 'pistache', direction: 'horizontal', style: 'filled' };
}

export function parseOutline(text) {
  const roots = [];
  const stack = [];
  String(text || '').split(/\r?\n/).forEach((raw) => {
    if (!raw.trim()) return;
    const level = Math.floor((raw.match(/^\s*/)[0].replace(/\t/g, '  ').length) / 2);
    const node = { label: raw.trim().replace(/^[-*•]\s*/, ''), children: [] };
    while (stack.length > level) stack.pop();
    if (stack.length) stack[stack.length - 1].children.push(node);
    else roots.push(node);
    stack.push(node);
  });
  return roots;
}

const wrap = (label, max = 16) => {
  const words = label.split(/\s+/);
  const lines = [''];
  words.forEach((word) => {
    const current = lines[lines.length - 1];
    if ((current + ' ' + word).trim().length > max && current) lines.push(word);
    else lines[lines.length - 1] = `${current} ${word}`.trim();
  });
  return lines.slice(0, 3);
};

function textBlock(label, x, y, color = '#fff', size = 13, max = 16) {
  const lines = wrap(label, max);
  const start = y - ((lines.length - 1) * (size + 3)) / 2 + size / 3;
  return `<text x="${x}" y="${start}" font-size="${size}" font-weight="650" fill="${color}" text-anchor="middle">${lines.map((line, index) => `<tspan x="${x}" dy="${index ? size + 3 : 0}">${escapeHtml(line)}</tspan>`).join('')}</text>`;
}

function node(x, y, w, h, label, color, style, radius = 10) {
  const filled = style !== 'outline';
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${filled ? color : '#fff'}" stroke="${color}" stroke-width="2"/>${textBlock(label, x + w / 2, y + h / 2, filled ? '#fff' : '#1e293b', 13, Math.max(8, Math.floor(w / 8)))}`;
}

const arrowDef = '<defs><marker id="dg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#64748b"/></marker></defs>';

function process(items, colors, spec) {
  const vertical = spec.direction === 'vertical';
  const n = items.length || 1;
  const W = vertical ? 320 : Math.max(640, n * 150);
  const H = vertical ? n * 90 + 20 : 160;
  const parts = [];
  items.forEach((item, index) => {
    const color = colors[index % colors.length];
    if (vertical) {
      const y = 10 + index * 90;
      parts.push(node(60, y, 200, 60, item.label, color, spec.style));
      if (index < n - 1) parts.push(`<line x1="160" y1="${y + 62}" x2="160" y2="${y + 88}" stroke="#64748b" stroke-width="2" marker-end="url(#dg-arrow)"/>`);
    } else {
      const w = (W - 20) / n - 30;
      const x = 10 + index * (w + 30);
      parts.push(node(x, 50, w, 64, item.label, color, spec.style));
      if (index < n - 1) parts.push(`<line x1="${x + w + 3}" y1="82" x2="${x + w + 27}" y2="82" stroke="#64748b" stroke-width="2" marker-end="url(#dg-arrow)"/>`);
    }
  });
  return { W, H, body: arrowDef + parts.join('') };
}

function tree(roots, colors, spec, org) {
  const leaves = (item) => (item.children.length ? item.children.reduce((sum, child) => sum + leaves(child), 0) : 1);
  const depth = (item) => 1 + (item.children.length ? Math.max(...item.children.map(depth)) : 0);
  const total = roots.reduce((sum, root) => sum + leaves(root), 0) || 1;
  const levels = Math.max(1, ...roots.map(depth));
  const slot = org ? 150 : 140;
  const W = Math.max(640, total * slot);
  const H = levels * 100 + 20;
  const parts = [];
  const place = (item, x0, level) => {
    const width = leaves(item) * slot;
    const cx = x0 + width / 2;
    const y = 10 + level * 100;
    const color = colors[level % colors.length];
    let offset = x0;
    item.children.forEach((child) => {
      const childWidth = leaves(child) * slot;
      const childX = offset + childWidth / 2;
      parts.push(org
        ? `<path d="M ${cx} ${y + 56} L ${cx} ${y + 78} L ${childX} ${y + 78} L ${childX} ${y + 100}" fill="none" stroke="#94a3b8" stroke-width="2"/>`
        : `<line x1="${cx}" y1="${y + 56}" x2="${childX}" y2="${y + 100}" stroke="#94a3b8" stroke-width="2"/>`);
      place(child, offset, level + 1);
      offset += childWidth;
    });
    parts.push(node(cx - (slot - 20) / 2, y, slot - 20, 56, item.label, color, spec.style, org ? 6 : 28));
  };
  let x = (W - total * slot) / 2;
  roots.forEach((root) => { place(root, x, 0); x += leaves(root) * slot; });
  return { W, H, body: parts.join('') };
}

function cycle(items, colors, spec) {
  const W = 520;
  const H = 520;
  const r = 180;
  const n = items.length || 1;
  const parts = [`<circle cx="260" cy="260" r="${r}" fill="none" stroke="#cbd5e1" stroke-width="3" stroke-dasharray="6 8"/>`];
  items.forEach((item, index) => {
    const angle = -Math.PI / 2 + (index / n) * Math.PI * 2;
    const x = 260 + r * Math.cos(angle);
    const y = 260 + r * Math.sin(angle);
    const color = colors[index % colors.length];
    parts.push(`<circle cx="${x}" cy="${y}" r="58" fill="${spec.style === 'outline' ? '#fff' : color}" stroke="${color}" stroke-width="3"/>${textBlock(item.label, x, y, spec.style === 'outline' ? '#1e293b' : '#fff', 13, 12)}`);
  });
  return { W, H, body: parts.join('') };
}

function relationship(items, colors) {
  const n = Math.max(1, items.length);
  const W = 560;
  const H = 440;
  const r = n === 1 ? 150 : 130;
  const parts = items.map((item, index) => {
    const angle = -Math.PI / 2 + (index / n) * Math.PI * 2;
    const x = 280 + (n === 1 ? 0 : 85) * Math.cos(angle);
    const y = 225 + (n === 1 ? 0 : 85) * Math.sin(angle);
    const lx = 280 + (n === 1 ? 0 : 150) * Math.cos(angle);
    const ly = 225 + (n === 1 ? 0 : 150) * Math.sin(angle);
    return { circle: `<circle cx="${x}" cy="${y}" r="${r}" fill="${colors[index % colors.length]}" fill-opacity="0.45" stroke="${colors[index % colors.length]}" stroke-width="2"/>`, label: textBlock(item.label, lx, ly, '#1e293b', 14, 14) };
  });
  return { W, H, body: parts.map((part) => part.circle).join('') + parts.map((part) => part.label).join('') };
}

function matrix(items, colors, spec) {
  const W = 520;
  const H = 520;
  const parts = items.slice(0, 4).map((item, index) => {
    const x = 20 + (index % 2) * 245;
    const y = 20 + Math.floor(index / 2) * 245;
    return node(x, y, 235, 235, item.label, colors[index % colors.length], spec.style, 14);
  });
  return { W, H, body: parts.join('') };
}

function pyramid(items, colors, spec) {
  const n = items.length || 1;
  const W = 560;
  const H = n * 80 + 20;
  const parts = items.map((item, index) => {
    const top = 10 + index * 80;
    const half0 = 30 + (index / n) * 250;
    const half1 = 30 + ((index + 1) / n) * 250;
    const color = colors[index % colors.length];
    const outline = spec.style === 'outline';
    return `<polygon points="${280 - half0},${top} ${280 + half0},${top} ${280 + half1},${top + 76} ${280 - half1},${top + 76}" fill="${outline ? '#fff' : color}" stroke="${color}" stroke-width="2"/>${textBlock(item.label, 280, top + 38, outline ? '#1e293b' : '#fff', 13, 22)}`;
  });
  return { W, H, body: parts.join('') };
}

function list(items, colors, spec) {
  const H = items.length * 66 + 20;
  const W = 560;
  const parts = items.map((item, index) => {
    const y = 10 + index * 66;
    const color = colors[index % colors.length];
    const sub = item.children.map((child) => child.label).join(' · ');
    return `<rect x="10" y="${y}" width="56" height="56" rx="10" fill="${color}"/><text x="38" y="${y + 35}" font-size="20" font-weight="800" fill="#fff" text-anchor="middle">${index + 1}</text><rect x="74" y="${y}" width="476" height="56" rx="10" fill="${spec.style === 'outline' ? '#fff' : `${color}22`}" stroke="${color}" stroke-width="1.5"/><text x="90" y="${y + (sub ? 24 : 33)}" font-size="15" font-weight="700" fill="#1e293b">${escapeHtml(item.label)}</text>${sub ? `<text x="90" y="${y + 44}" font-size="12" fill="#475569">${escapeHtml(sub).slice(0, 70)}</text>` : ''}`;
  });
  return { W, H, body: parts.join('') };
}

export function renderDiagramSvg(spec) {
  const colors = PALETTES[spec.palette] || PALETTES.pistache;
  const roots = parseOutline(spec.text);
  const flat = roots.length ? roots : [{ label: 'Elemento', children: [] }];
  const result = spec.type === 'hierarchy' ? tree(flat, colors, spec, false)
    : spec.type === 'org' ? tree(flat, colors, spec, true)
      : spec.type === 'cycle' ? cycle(flat, colors, spec)
        : spec.type === 'relationship' ? relationship(flat, colors, spec)
          : spec.type === 'matrix' ? matrix(flat, colors, spec)
            : spec.type === 'pyramid' ? pyramid(flat, colors, spec)
              : spec.type === 'list' ? list(flat, colors, spec)
                : process(flat, colors, spec);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${result.W} ${result.H}" width="100%" height="100%" font-family="ui-sans-serif, system-ui, sans-serif" role="img" aria-label="Diagrama">${result.body}</svg>`;
}

export function diagramAspect(spec) {
  const svg = renderDiagramSvg(spec);
  const match = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  return match ? Number(match[2]) / Number(match[1]) : 0.5;
}
