import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hexByte(value) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
}

export function rgbToHex({ r, g, b }) {
  return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`;
}

export function parseColor(input) {
  const raw = String(input || '').trim();
  if (/^#[0-9a-f]{3}$/i.test(raw)) return `#${raw.slice(1).split('').map((char) => char + char).join('')}`.toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
  const match = raw.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (match) return rgbToHex({ r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) });
  return '#000000';
}

function hexToRgb(hex) {
  const value = parseColor(hex).slice(1);
  const n = parseInt(value, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mix(hex, toward, amount) {
  const from = hexToRgb(hex);
  const to = hexToRgb(toward);
  return rgbToHex({
    r: from.r + (to.r - from.r) * amount,
    g: from.g + (to.g - from.g) * amount,
    b: from.b + (to.b - from.b) * amount,
  });
}

const claro = (hex, percent) => mix(hex, '#ffffff', percent / 100);
const oscuro = (hex, percent) => mix(hex, '#000000', percent / 100);

function accentRows(base) {
  return [
    ['Claro 80%', claro(base, 80)],
    ['Claro 60%', claro(base, 60)],
    ['Claro 40%', claro(base, 40)],
    ['', base],
    ['Oscuro 25%', oscuro(base, 25)],
    ['Oscuro 50%', oscuro(base, 50)],
  ];
}

function namedColumn(name, role, rows) {
  return rows.map(([mod, hex]) => ({
    hex: parseColor(hex),
    name: mod ? `${name}, ${role}, ${mod}` : `${name}, ${role}`,
  }));
}

const THEME = [
  namedColumn('Blanco', 'Fondo 1', [
    ['', '#ffffff'],
    ['Oscuro 5%', oscuro('#ffffff', 5)],
    ['Oscuro 15%', oscuro('#ffffff', 15)],
    ['Oscuro 25%', oscuro('#ffffff', 25)],
    ['Oscuro 35%', oscuro('#ffffff', 35)],
    ['Oscuro 50%', oscuro('#ffffff', 50)],
  ]),
  namedColumn('Negro', 'Texto 1', [
    ['', '#000000'],
    ['Claro 50%', claro('#000000', 50)],
    ['Claro 35%', claro('#000000', 35)],
    ['Claro 25%', claro('#000000', 25)],
    ['Claro 15%', claro('#000000', 15)],
    ['Claro 5%', claro('#000000', 5)],
  ]),
  namedColumn('Gris', 'Fondo 2', [
    ['', '#e7e6e6'],
    ['Oscuro 10%', oscuro('#e7e6e6', 10)],
    ['Oscuro 25%', oscuro('#e7e6e6', 25)],
    ['Oscuro 50%', oscuro('#e7e6e6', 50)],
    ['Oscuro 75%', oscuro('#e7e6e6', 75)],
    ['Oscuro 90%', oscuro('#e7e6e6', 90)],
  ]),
  namedColumn('Azul acero', 'Texto 2', accentRows('#44546a')),
  namedColumn('Azul', 'Énfasis 1', accentRows('#4472c4')),
  namedColumn('Naranja', 'Énfasis 2', accentRows('#ed7d31')),
  namedColumn('Gris', 'Énfasis 3', accentRows('#a5a5a5')),
  namedColumn('Dorado', 'Énfasis 4', accentRows('#ffc000')),
  namedColumn('Celeste', 'Énfasis 5', accentRows('#5b9bd5')),
  namedColumn('Verde', 'Énfasis 6', accentRows('#70ad47')),
];

const STANDARD = [
  ['#c00000', 'Rojo oscuro'],
  ['#ff0000', 'Rojo'],
  ['#ffc000', 'Naranja'],
  ['#ffff00', 'Amarillo'],
  ['#92d050', 'Verde claro'],
  ['#00b050', 'Verde'],
  ['#00b0f0', 'Celeste'],
  ['#0070c0', 'Azul'],
  ['#002060', 'Azul oscuro'],
  ['#7030a0', 'Morado'],
];

const MARKERS = [
  ['#fff3a1', 'Amarillo'],
  ['#fde68a', 'Dorado'],
  ['#bbf7d0', 'Verde'],
  ['#99f6e4', 'Menta'],
  ['#bfdbfe', 'Celeste'],
  ['#fbcfe8', 'Rosa'],
  ['#fecaca', 'Rojo'],
  ['#e2e8f0', 'Gris'],
  ['#fdba74', 'Naranja'],
  ['#67bfa1', 'Pistache'],
];

function rgbToHsv({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const sector = Math.floor(h / 60) % 6;
  const map = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]];
  const [r, g, b] = map[sector];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

function hsvToHex(h, s, v) {
  return rgbToHex(hsvToRgb(h, s, v));
}

function sameColor(a, b) {
  return parseColor(a) === parseColor(b);
}

function Swatch({ color, name, active, onPick, onTip }) {
  return (
    <button
      type="button"
      className={`wd-swatch${active ? ' is-active' : ''}`}
      style={{ background: color }}
      aria-label={name}
      onMouseEnter={(event) => onTip(name, event.currentTarget)}
      onMouseLeave={() => onTip(null)}
      onFocus={(event) => onTip(name, event.currentTarget)}
      onBlur={() => onTip(null)}
      onClick={() => onPick(color)}
    />
  );
}

function honeycomb() {
  const size = 10;
  const rings = 4;
  const cells = [];
  for (let q = -rings; q <= rings; q += 1) {
    for (let r = Math.max(-rings, -q - rings); r <= Math.min(rings, -q + rings); r += 1) {
      const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
      const x = size * Math.sqrt(3) * (q + r / 2);
      const y = size * 1.5 * r;
      const hue = (Math.atan2(y, x) * 180) / Math.PI + 180;
      const sat = dist === 0 ? 0 : 0.45 + (dist / rings) * 0.55;
      const val = dist === 0 ? 0.16 : 0.55 + (dist / rings) * 0.45;
      cells.push({ x, y, color: hsvToHex((hue + 360) % 360, sat, val), key: `${q}:${r}` });
    }
  }
  return { cells, size };
}

const HONEY = honeycomb();
const GRAYS = ['#ffffff', '#e5e7eb', '#cbd5e1', '#94a3b8', '#64748b', '#334155', '#1e293b', '#000000'];

function ColorStudio({ current, onApply, onCancel }) {
  const [tab, setTab] = useState('standard');
  const [hex, setHex] = useState(parseColor(current));
  const [draft, setDraft] = useState(parseColor(current).toUpperCase());
  const hsv = rgbToHsv(hexToRgb(parseColor(hex)));
  const plane = useRef(null);
  const hueBar = useRef(null);

  const commit = (next) => {
    const color = parseColor(next);
    setHex(color);
    setDraft(color.toUpperCase());
  };
  const setHsv = (next) => commit(hsvToHex(next.h, next.s, next.v));

  const dragPlane = (event) => {
    const rect = plane.current.getBoundingClientRect();
    const s = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const v = clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1);
    setHsv({ ...hsv, s, v });
  };
  const dragHue = (event) => {
    const rect = hueBar.current.getBoundingClientRect();
    setHsv({ ...hsv, h: clamp((event.clientY - rect.top) / rect.height, 0, 1) * 360 });
  };
  const startDrag = (event, move) => {
    event.preventDefault();
    move(event);
    const onMove = (ev) => move(ev);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const setChannel = (channel, raw) => {
    const rgb = hexToRgb(hex);
    rgb[channel] = clamp(Number(raw) || 0, 0, 255);
    commit(rgbToHex(rgb));
  };

  return (
    <div className="wd-color-studio">
      <div className="wd-color-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'standard'} className={tab === 'standard' ? 'is-on' : ''} onClick={() => setTab('standard')}>Estándar</button>
        <button type="button" role="tab" aria-selected={tab === 'custom'} className={tab === 'custom' ? 'is-on' : ''} onClick={() => setTab('custom')}>Personalizado</button>
      </div>
      {tab === 'standard' ? (
        <div className="wd-honey">
          <svg viewBox="-78 -72 156 144" role="listbox" aria-label="Colores estándar">
            {HONEY.cells.map((cell) => (
              <polygon
                key={cell.key}
                points={Array.from({ length: 6 }, (_, index) => {
                  const angle = (Math.PI / 180) * (60 * index - 30);
                  return `${cell.x + HONEY.size * Math.cos(angle)},${cell.y + HONEY.size * Math.sin(angle)}`;
                }).join(' ')}
                fill={cell.color}
                className={sameColor(cell.color, hex) ? 'is-on' : ''}
                onClick={() => commit(cell.color)}
              />
            ))}
          </svg>
          <div className="wd-gray-row">
            {GRAYS.map((color) => (
              <button key={color} type="button" className={sameColor(color, hex) ? 'is-on' : ''} style={{ background: color }} aria-label={color} onClick={() => commit(color)} />
            ))}
          </div>
        </div>
      ) : (
        <div className="wd-custom-plane">
          <div
            ref={plane}
            className="wd-sv"
            style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hsvToHex(hsv.h, 1, 1)})` }}
            onPointerDown={(event) => startDrag(event, dragPlane)}
          >
            <span style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
          </div>
          <div
            ref={hueBar}
            className="wd-hue"
            onPointerDown={(event) => startDrag(event, dragHue)}
          >
            <span style={{ top: `${(hsv.h / 360) * 100}%` }} />
          </div>
          <div className="wd-rgb">
            {[['r', 'Rojo'], ['g', 'Verde'], ['b', 'Azul']].map(([channel, label]) => (
              <label key={channel}>
                <span>{label}</span>
                <input type="number" min="0" max="255" value={hexToRgb(hex)[channel]} onChange={(event) => setChannel(channel, event.target.value)} />
              </label>
            ))}
            <label>
              <span>Hex</span>
              <input value={draft} spellCheck={false} onChange={(event) => { const next = event.target.value.toUpperCase(); setDraft(next); if (/^#?[0-9A-F]{6}$/.test(next.trim())) commit(next.trim()); }} onBlur={() => commit(draft)} />
            </label>
          </div>
        </div>
      )}
      <div className="wd-color-foot">
        <div className="wd-color-compare">
          <span><i style={{ background: hex }} /><b>Nuevo</b></span>
          <span><i style={{ background: parseColor(current) }} /><b>Actual</b></span>
        </div>
        <button type="button" className="wd-color-ok" onClick={() => onApply(parseColor(hex))}>Aceptar</button>
        <button type="button" className="wd-color-cancel" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

export function ColorGrid({ value, onPick, close, allowNone = false, noneLabel = 'Sin color', recent = [], kind = 'font' }) {
  const root = useRef(null);
  const [studio, setStudio] = useState(false);
  const [tip, setTip] = useState(null);
  const current = parseColor(value);
  const pick = (color) => { onPick(color); close?.(); };
  const showTip = (name, el) => {
    if (!name || !el) { setTip(null); return; }
    const rect = el.getBoundingClientRect();
    setTip({ name, x: rect.left + rect.width / 2, y: rect.top });
  };

  useLayoutEffect(() => {
    const pop = root.current?.closest('.wd-pop');
    if (!pop) return;
    pop.classList.toggle('is-color-studio', studio);
    if (!studio) return;
    const width = Math.min(348, window.innerWidth - 24);
    const left = Math.max(12, Math.min(pop.getBoundingClientRect().left, window.innerWidth - width - 12));
    pop.style.left = `${left}px`;
  });

  useEffect(() => () => root.current?.closest('.wd-pop')?.classList.remove('is-color-studio'), []);

  if (studio) {
    return (
      <div ref={root}>
        <ColorStudio current={current} onApply={pick} onCancel={() => setStudio(false)} />
      </div>
    );
  }

  return (
    <div className="wd-colors" ref={root} onMouseLeave={() => setTip(null)}>
      {kind !== 'highlight' && (
        <button type="button" className="wd-color-auto" onClick={() => pick('#000000')}>
          <i /> Automático
        </button>
      )}
      {recent.length > 0 && kind !== 'highlight' && (
        <>
          <span className="wd-color-label">Recientes</span>
          <div className="wd-swatches is-recent">{recent.map((color) => <Swatch key={color} color={color} name={parseColor(color)} active={sameColor(color, current)} onPick={pick} onTip={showTip} />)}</div>
        </>
      )}
      {kind === 'highlight' ? (
        <>
          <span className="wd-color-label">Resaltado</span>
          <div className="wd-swatches is-marker">
            {MARKERS.map(([color, name]) => <Swatch key={color} color={color} name={name} active={sameColor(color, current)} onPick={pick} onTip={showTip} />)}
          </div>
        </>
      ) : (
        <>
          <span className="wd-color-label">Colores del tema</span>
          <div className="wd-swatches is-theme">
            {THEME.map((column, index) => column.map((cell) => (
              <Swatch key={`${index}-${cell.name}`} color={cell.hex} name={cell.name} active={sameColor(cell.hex, current)} onPick={pick} onTip={showTip} />
            )))}
          </div>
          <span className="wd-color-label">Colores estándar</span>
          <div className="wd-swatches is-standard">
            {STANDARD.map(([color, name]) => <Swatch key={color} color={color} name={name} active={sameColor(color, current)} onPick={pick} onTip={showTip} />)}
          </div>
        </>
      )}
      {allowNone && <button type="button" className="wd-color-none" onClick={() => pick('')}>{noneLabel}</button>}
      <button type="button" className="wd-more-colors" onClick={() => { setTip(null); setStudio(true); }}>
        <i /> Más colores
      </button>
      {tip && createPortal(
        <div className="wd-color-tip" style={{ left: tip.x, top: tip.y }}>{tip.name}</div>,
        document.body,
      )}
    </div>
  );
}
