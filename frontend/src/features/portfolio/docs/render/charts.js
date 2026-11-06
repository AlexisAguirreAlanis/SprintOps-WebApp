// Gráficos en SVG puro: el resultado queda dentro del documento y se exporta igual que se ve.

import { escapeHtml } from '../sanitize';

export const CHART_TYPES = {
  column: 'Columnas',
  bar: 'Barras',
  line: 'Líneas',
  area: 'Áreas',
  pie: 'Circular',
  donut: 'Anillo',
  scatter: 'Dispersión',
  histogram: 'Histograma',
  waterfall: 'Cascada',
  combo: 'Combinado',
};

export const PALETTES = {
  pistache: ['#2f6f5e', '#67bfa1', '#f8c76b', '#e98b6d', '#8fb8de', '#b49ddb', '#94a3b8'],
  office: ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47', '#264478'],
  ocean: ['#0e7490', '#06b6d4', '#67e8f9', '#1e3a8a', '#3b82f6', '#a5f3fc', '#164e63'],
  warm: ['#be123c', '#f97316', '#facc15', '#a16207', '#fb7185', '#fdba74', '#7c2d12'],
  mono: ['#111827', '#374151', '#6b7280', '#9ca3af', '#d1d5db', '#4b5563', '#1f2937'],
};

export function defaultChartSpec(type = 'column') {
  return {
    type,
    title: 'Título del gráfico',
    labels: ['Ene', 'Feb', 'Mar', 'Abr'],
    series: [
      { name: 'Serie 1', values: [12, 19, 8, 15] },
      { name: 'Serie 2', values: [7, 11, 14, 9] },
    ],
    palette: 'pistache',
    legend: 'bottom',
    showLabels: false,
    gridlines: true,
    xTitle: '',
    yTitle: '',
    style: 'flat',
    bins: 5,
  };
}

/** Convierte CSV (primera fila: encabezados; primera columna: etiquetas) a datos del gráfico. */
export function csvToData(csv) {
  const rows = String(csv || '').trim().split(/\r?\n/).map((line) => line.split(/\t|;|,/).map((cell) => cell.trim()));
  if (rows.length < 2) return null;
  const [head, ...body] = rows;
  return {
    labels: body.map((row) => row[0]),
    series: head.slice(1).map((name, index) => ({ name, values: body.map((row) => Number(String(row[index + 1] || '0').replace(',', '.')) || 0) })),
  };
}

export function dataToCsv(spec) {
  const head = ['Categoría', ...spec.series.map((serie) => serie.name)].join(',');
  return [head, ...spec.labels.map((label, index) => [label, ...spec.series.map((serie) => serie.values[index] ?? 0)].join(','))].join('\n');
}

const W = 640;
const H = 380;
const fmt = (value) => (Math.abs(value) >= 1000 ? `${Math.round(value / 100) / 10}k` : String(Math.round(value * 100) / 100));

function niceMax(value) {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const n = value / power;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * power;
}

function legendSvg(spec, colors, names) {
  if (spec.legend === 'none' || !names.length) return { svg: '', reserve: { bottom: 0, right: 0, top: 0 } };
  const items = names.map((name, index) => ({ name, color: colors[index % colors.length] }));
  if (spec.legend === 'right') {
    const svg = items.map((item, index) => `<rect x="${W - 140}" y="${70 + index * 22}" width="12" height="12" rx="2" fill="${item.color}"/><text x="${W - 122}" y="${80 + index * 22}" font-size="12" fill="#334155">${escapeHtml(item.name).slice(0, 18)}</text>`).join('');
    return { svg, reserve: { right: 150, bottom: 0, top: 0 } };
  }
  const y = spec.legend === 'top' ? 52 : H - 16;
  let x = 0;
  const parts = items.map((item) => {
    const width = 26 + Math.min(18, item.name.length) * 7;
    const part = { ...item, x, width };
    x += width;
    return part;
  });
  const offset = (W - x) / 2;
  const svg = parts.map((item) => `<rect x="${offset + item.x}" y="${y - 10}" width="12" height="12" rx="2" fill="${item.color}"/><text x="${offset + item.x + 17}" y="${y}" font-size="12" fill="#334155">${escapeHtml(item.name).slice(0, 18)}</text>`).join('');
  return { svg, reserve: spec.legend === 'top' ? { top: 24, bottom: 0, right: 0 } : { bottom: 26, top: 0, right: 0 } };
}

function axisChart(spec, colors) {
  const horizontal = spec.type === 'bar';
  let series = spec.series;
  let labels = spec.labels;
  if (spec.type === 'histogram') {
    const values = spec.series.flatMap((serie) => serie.values);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const bins = Math.max(2, Number(spec.bins) || 5);
    const size = (max - min) / bins || 1;
    const counts = Array(bins).fill(0);
    values.forEach((value) => { counts[Math.min(bins - 1, Math.floor((value - min) / size))] += 1; });
    labels = counts.map((_, index) => `${fmt(min + index * size)}–${fmt(min + (index + 1) * size)}`);
    series = [{ name: 'Frecuencia', values: counts }];
  }
  if (spec.type === 'waterfall') {
    const values = spec.series[0]?.values || [];
    let running = 0;
    const starts = values.map((value) => { const start = running; running += value; return start; });
    series = [{ name: spec.series[0]?.name || 'Valor', values, starts }];
  }
  const names = spec.type === 'waterfall' ? ['Aumento', 'Disminución'] : series.map((serie) => serie.name);
  const legend = legendSvg(spec, spec.type === 'waterfall' ? ['#2f6f5e', '#e98b6d'] : colors, names);
  const top = 64 + legend.reserve.top;
  const left = 56 + (spec.yTitle ? 16 : 0);
  const right = W - 20 - legend.reserve.right;
  const bottom = H - 44 - legend.reserve.bottom - (spec.xTitle ? 16 : 0);
  const all = spec.type === 'waterfall'
    ? series[0].values.map((value, index) => [series[0].starts[index], series[0].starts[index] + value]).flat()
    : series.flatMap((serie) => serie.values);
  const minValue = Math.min(0, ...all);
  const maxValue = niceMax(Math.max(...all, 1));
  const span = maxValue - minValue || 1;
  const valueTo = (value) => (horizontal ? left + ((value - minValue) / span) * (right - left) : bottom - ((value - minValue) / span) * (bottom - top));
  const parts = [];
  const ticks = 5;
  for (let index = 0; index <= ticks; index += 1) {
    const value = minValue + (span / ticks) * index;
    const pos = valueTo(value);
    if (horizontal) {
      if (spec.gridlines) parts.push(`<line x1="${pos}" y1="${top}" x2="${pos}" y2="${bottom}" stroke="#e2e8f0"/>`);
      parts.push(`<text x="${pos}" y="${bottom + 16}" font-size="11" fill="#64748b" text-anchor="middle">${fmt(value)}</text>`);
    } else {
      if (spec.gridlines) parts.push(`<line x1="${left}" y1="${pos}" x2="${right}" y2="${pos}" stroke="#e2e8f0"/>`);
      parts.push(`<text x="${left - 8}" y="${pos + 4}" font-size="11" fill="#64748b" text-anchor="end">${fmt(value)}</text>`);
    }
  }
  const count = labels.length || 1;
  const band = ((horizontal ? bottom - top : right - left) / count);
  const barSeries = spec.type === 'combo' ? series.slice(0, 1) : series;
  const lineSeries = spec.type === 'combo' ? series.slice(1) : [];
  const radius = spec.style === 'rounded' ? 4 : 0;
  labels.forEach((label, index) => {
    const center = (horizontal ? top : left) + band * index + band / 2;
    parts.push(horizontal
      ? `<text x="${left - 8}" y="${center + 4}" font-size="11" fill="#475569" text-anchor="end">${escapeHtml(label).slice(0, 14)}</text>`
      : `<text x="${center}" y="${bottom + 16}" font-size="11" fill="#475569" text-anchor="middle">${escapeHtml(label).slice(0, 14)}</text>`);
  });
  if (['column', 'bar', 'histogram', 'combo', 'waterfall'].includes(spec.type)) {
    const groupWidth = band * 0.72;
    const barWidth = spec.type === 'histogram' ? band * 0.96 : groupWidth / barSeries.length;
    barSeries.forEach((serie, s) => {
      serie.values.forEach((value, index) => {
        const startValue = spec.type === 'waterfall' ? serie.starts[index] : 0;
        const endValue = startValue + value;
        const a = valueTo(Math.min(startValue, endValue));
        const b = valueTo(Math.max(startValue, endValue));
        const base = (horizontal ? top : left) + band * index + (band - (spec.type === 'histogram' ? barWidth : groupWidth)) / 2 + barWidth * (spec.type === 'histogram' ? 0 : s);
        const color = spec.type === 'waterfall' ? (value >= 0 ? '#2f6f5e' : '#e98b6d') : colors[s % colors.length];
        const fill = spec.style === 'outline' ? `fill="${color}33" stroke="${color}" stroke-width="2"` : `fill="${color}"`;
        parts.push(horizontal
          ? `<rect x="${a}" y="${base}" width="${Math.max(1, b - a)}" height="${barWidth - 2}" rx="${radius}" ${fill}/>`
          : `<rect x="${base}" y="${b}" width="${barWidth - 2}" height="${Math.max(1, a - b)}" rx="${radius}" ${fill}/>`);
        if (spec.showLabels) {
          parts.push(horizontal
            ? `<text x="${b + 4}" y="${base + barWidth / 2 + 3}" font-size="10" fill="#334155">${fmt(value)}</text>`
            : `<text x="${base + barWidth / 2 - 1}" y="${b - 4}" font-size="10" fill="#334155" text-anchor="middle">${fmt(value)}</text>`);
        }
      });
    });
  }
  const lines = ['line', 'area'].includes(spec.type) ? series : lineSeries;
  lines.forEach((serie, s) => {
    const color = colors[(spec.type === 'combo' ? s + 1 : s) % colors.length];
    const points = serie.values.map((value, index) => [left + band * index + band / 2, valueTo(value)]);
    const d = points.map(([x, y], index) => `${index ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    if (spec.type === 'area' && points.length) parts.push(`<path d="${d} L ${points[points.length - 1][0]} ${bottom} L ${points[0][0]} ${bottom} Z" fill="${color}" opacity="0.28"/>`);
    parts.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>`);
    points.forEach(([x, y], index) => {
      parts.push(`<circle cx="${x}" cy="${y}" r="3.5" fill="#fff" stroke="${color}" stroke-width="2"/>`);
      if (spec.showLabels) parts.push(`<text x="${x}" y="${y - 8}" font-size="10" fill="#334155" text-anchor="middle">${fmt(serie.values[index])}</text>`);
    });
  });
  parts.push(`<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="#94a3b8"/><line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" stroke="#94a3b8"/>`);
  if (spec.xTitle) parts.push(`<text x="${(left + right) / 2}" y="${bottom + 34}" font-size="12" fill="#334155" text-anchor="middle">${escapeHtml(spec.xTitle)}</text>`);
  if (spec.yTitle) parts.push(`<text transform="translate(16 ${(top + bottom) / 2}) rotate(-90)" font-size="12" fill="#334155" text-anchor="middle">${escapeHtml(spec.yTitle)}</text>`);
  return parts.join('') + legend.svg;
}

function scatterChart(spec, colors) {
  const legend = legendSvg(spec, colors, spec.series.map((serie) => serie.name));
  const top = 64 + legend.reserve.top;
  const left = 56;
  const right = W - 20 - legend.reserve.right;
  const bottom = H - 44 - legend.reserve.bottom;
  const xs = spec.labels.map((label, index) => Number(String(label).replace(',', '.')) || index + 1);
  const ys = spec.series.flatMap((serie) => serie.values);
  const maxX = niceMax(Math.max(...xs, 1));
  const maxY = niceMax(Math.max(...ys, 1));
  const parts = [];
  for (let index = 0; index <= 5; index += 1) {
    const y = bottom - ((bottom - top) / 5) * index;
    const x = left + ((right - left) / 5) * index;
    if (spec.gridlines) parts.push(`<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#e2e8f0"/>`);
    parts.push(`<text x="${left - 8}" y="${y + 4}" font-size="11" fill="#64748b" text-anchor="end">${fmt((maxY / 5) * index)}</text><text x="${x}" y="${bottom + 16}" font-size="11" fill="#64748b" text-anchor="middle">${fmt((maxX / 5) * index)}</text>`);
  }
  spec.series.forEach((serie, s) => serie.values.forEach((value, index) => {
    parts.push(`<circle cx="${left + (xs[index] / maxX) * (right - left)}" cy="${bottom - (value / maxY) * (bottom - top)}" r="5" fill="${colors[s % colors.length]}" opacity="0.85"/>`);
  }));
  parts.push(`<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="#94a3b8"/><line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" stroke="#94a3b8"/>`);
  return parts.join('') + legend.svg;
}

function pieChart(spec, colors) {
  const values = spec.series[0]?.values || [];
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0) || 1;
  const legend = legendSvg(spec, colors, spec.labels);
  const cx = (W - legend.reserve.right) / 2;
  const cy = (H + 40 - legend.reserve.bottom + legend.reserve.top) / 2;
  const r = Math.min(cx - 30, (H - 110 - legend.reserve.bottom) / 2);
  const inner = spec.type === 'donut' ? r * 0.58 : 0;
  let angle = -Math.PI / 2;
  const parts = values.map((value, index) => {
    const slice = (Math.max(0, value) / total) * Math.PI * 2;
    const a0 = angle;
    const a1 = angle + slice;
    angle = a1;
    const large = slice > Math.PI ? 1 : 0;
    const p = (rad, ang) => `${(cx + rad * Math.cos(ang)).toFixed(2)} ${(cy + rad * Math.sin(ang)).toFixed(2)}`;
    const color = colors[index % colors.length];
    const d = slice >= Math.PI * 2 - 0.001
      ? `M ${p(r, 0)} A ${r} ${r} 0 1 1 ${p(r, Math.PI)} A ${r} ${r} 0 1 1 ${p(r, 0)} Z`
      : inner
        ? `M ${p(r, a0)} A ${r} ${r} 0 ${large} 1 ${p(r, a1)} L ${p(inner, a1)} A ${inner} ${inner} 0 ${large} 0 ${p(inner, a0)} Z`
        : `M ${cx} ${cy} L ${p(r, a0)} A ${r} ${r} 0 ${large} 1 ${p(r, a1)} Z`;
    const mid = (a0 + a1) / 2;
    const label = spec.showLabels && slice > 0.2 ? `<text x="${cx + (inner ? (r + inner) / 2 : r * 0.62) * Math.cos(mid)}" y="${cy + (inner ? (r + inner) / 2 : r * 0.62) * Math.sin(mid) + 4}" font-size="11" fill="#fff" font-weight="700" text-anchor="middle">${Math.round((value / total) * 100)}%</text>` : '';
    return `<path d="${d}" fill="${color}" stroke="#fff" stroke-width="2"/>${label}`;
  });
  return parts.join('') + legend.svg;
}

export function renderChartSvg(spec) {
  const colors = PALETTES[spec.palette] || PALETTES.pistache;
  const body = spec.type === 'pie' || spec.type === 'donut' ? pieChart(spec, colors) : spec.type === 'scatter' ? scatterChart(spec, colors) : axisChart(spec, colors);
  const title = spec.title ? `<text x="${W / 2}" y="30" font-size="17" font-weight="700" fill="#1e293b" text-anchor="middle">${escapeHtml(spec.title)}</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" font-family="ui-sans-serif, system-ui, sans-serif" role="img" aria-label="${escapeHtml(spec.title || 'Gráfico')}"><rect width="${W}" height="${H}" fill="#fff"/>${title}${body}</svg>`;
}
