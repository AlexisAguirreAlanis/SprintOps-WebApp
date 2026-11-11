import { useRef, useState } from 'react';
import { Palette, Type, Droplets, Image as ImageIcon, Stamp, Square, Save, RotateCcw, Sparkles, ChevronLeft, ImagePlus } from 'lucide-react';
import { Btn, ColorGrid, Group, Item, Menu, NumberField, Row, Sep, SWATCHES } from '../ui/controls';
import { THEMES } from '../model';
import { FONTS } from './HomeTab';
import { readImageFile } from '../../editorMedia';

const GRADIENTS = [
  ['linear-gradient(180deg,#ffffff,#eaf6f1)', 'Menta suave'],
  ['linear-gradient(135deg,#fff7e6,#fde68a)', 'Amanecer'],
  ['linear-gradient(180deg,#eef2ff,#ffffff)', 'Cielo'],
  ['linear-gradient(135deg,#fdf2f8,#ede9fe)', 'Lavanda'],
  ['radial-gradient(circle at 20% 0%,#e0f2fe,#ffffff 60%)', 'Brillo'],
];

const TEXTURES = [
  ['repeating-linear-gradient(0deg,transparent 0 23px,#e2e8f0 23px 24px)', 'Rayado'],
  ['radial-gradient(#cbd5e1 1px,transparent 1px) 0 0/18px 18px', 'Puntos'],
  ['linear-gradient(#e2e8f0 1px,transparent 1px) 0 0/24px 24px,linear-gradient(90deg,#e2e8f0 1px,transparent 1px) 0 0/24px 24px', 'Cuadrícula'],
  ['repeating-linear-gradient(45deg,#f8fafc 0 10px,#f1f5f9 10px 20px)', 'Diagonal'],
  ['url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2780%27 height=%2780%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence baseFrequency=%27.9%27/%3E%3C/filter%3E%3Crect width=%2780%27 height=%2780%27 filter=%27url(%23n)%27 opacity=%27.06%27/%3E%3C/svg%3E")', 'Papel'],
];

const WATERMARK_PRESETS = ['BORRADOR', 'CONFIDENCIAL', 'NO COPIAR', 'URGENTE', 'MUESTRA'];
const WATERMARK_COLORS = ['#94a3b8', '#64748b', '#cbd5e1', '#1e293b', '#475569', '#dc2626', '#2563eb', '#2f6f5e', ...SWATCHES.slice(0, 8)];

function presetWatermark(text) {
  return { type: 'text', text, color: '#94a3b8', opacity: 0.18, rotate: -35, size: 96 };
}

function WatermarkMenu({ api, close, view, setView }) {
  const wm = api.doc.watermark || { type: 'none' };
  const [kind, setKind] = useState(wm.type === 'image' ? 'image' : 'text');
  const [text, setText] = useState(wm.text || 'CONFIDENCIAL');
  const [color, setColor] = useState(wm.color || '#94a3b8');
  const [size, setSize] = useState(wm.size || 96);
  const [rotate, setRotate] = useState(String(wm.rotate ?? -35));
  const [opacity, setOpacity] = useState(Math.round((wm.opacity ?? 0.18) * 100));
  const [scale, setScale] = useState(wm.scale || 50);
  const [imageSrc, setImageSrc] = useState(wm.image || '');
  const fileRef = useRef(null);

  const applyText = () => {
    api.patchDoc({ watermark: { type: 'text', text: text.trim() || 'CONFIDENCIAL', color, size: Number(size) || 96, rotate: Number(rotate), opacity: opacity / 100 } });
    close();
  };

  const applyImage = () => {
    if (!imageSrc) {
      fileRef.current?.click();
      return;
    }
    api.patchDoc({ watermark: { type: 'image', image: imageSrc, opacity: opacity / 100, scale: Number(scale) || 50 } });
    close();
  };

  const onPickImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const image = await readImageFile(file);
    setImageSrc(image.src);
    setKind('image');
  };

  if (view === 'custom') {
    return (
      <div className="wd-watermark-panel" role="form" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <button type="button" className="wd-wm-back" onClick={() => setView('list')}><ChevronLeft size={14} aria-hidden="true" /> Volver</button>
          <strong>Marca de agua personalizada</strong>
        </header>
        <div className="wd-wm-type" role="tablist" aria-label="Tipo de marca de agua">
          <button type="button" role="tab" aria-selected={kind === 'text'} className={kind === 'text' ? 'is-on' : ''} onClick={() => setKind('text')}>Texto</button>
          <button type="button" role="tab" aria-selected={kind === 'image'} className={kind === 'image' ? 'is-on' : ''} onClick={() => setKind('image')}>Imagen</button>
        </div>
        {kind === 'text' ? (
          <>
            <label className="wd-wm-field">
              <span>Texto</span>
              <input className="wd-input" type="text" value={text} onChange={(event) => setText(event.target.value)} />
            </label>
            <div className="wd-wm-field">
              <span>Color</span>
              <div className="wd-swatches wd-wm-swatches">
                {[...new Set(WATERMARK_COLORS)].map((hex) => (
                  <button key={hex} type="button" className={`wd-swatch${color === hex ? ' is-active' : ''}`} style={{ background: hex }} aria-label={hex} onClick={() => setColor(hex)} />
                ))}
              </div>
            </div>
            <label className="wd-wm-field">
              <span>Tamaño (px)</span>
              <NumberField label="Tamaño" value={size} onChange={setSize} min={24} max={200} width="100%" />
            </label>
            <div className="wd-wm-field">
              <span>Diseño</span>
              <div className="wd-wm-seg">
                <button type="button" className={rotate === '-35' ? 'is-on' : ''} onClick={() => setRotate('-35')}>Diagonal</button>
                <button type="button" className={rotate === '0' ? 'is-on' : ''} onClick={() => setRotate('0')}>Horizontal</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />
            <button type="button" className="wd-item wd-wm-pick" onClick={() => fileRef.current?.click()}>
              <ImagePlus size={15} aria-hidden="true" />
              <span className="wd-item-label">{imageSrc ? 'Cambiar imagen…' : 'Elegir imagen…'}</span>
            </button>
            {imageSrc && <span className="wd-muted wd-wm-hint">Imagen lista para aplicar</span>}
            <label className="wd-wm-field">
              <span>Escala (%)</span>
              <NumberField label="Escala" value={scale} onChange={setScale} min={10} max={100} width="100%" />
            </label>
          </>
        )}
        <label className="wd-wm-field">
          <span>Opacidad</span>
          <span className="wd-slider">
            <input type="range" min={5} max={60} value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} aria-valuenow={opacity} aria-valuetext={`${opacity} %`} />
            <em>{opacity}%</em>
          </span>
        </label>
        <div className="wd-wm-actions">
          <button type="button" className="wd-btn" onClick={() => setView('list')}>Cancelar</button>
          <button type="button" className="wd-btn wd-primary" onClick={() => (kind === 'image' ? applyImage() : applyText())}>Aplicar</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {WATERMARK_PRESETS.map((label) => (
        <Item key={label} label={label} close={close} onClick={() => api.patchDoc({ watermark: presetWatermark(label) })} />
      ))}
      <Sep />
      <Item label="Marca de agua personalizada…" onClick={() => setView('custom')} />
      <Item label="Quitar marca de agua" close={close} onClick={() => api.patchDoc({ watermark: { type: 'none' } })} />
    </>
  );
}

export default function DesignTab({ api }) {
  const { doc } = api;
  const savedThemes = api.storage.get('themes', []);
  const [watermarkView, setWatermarkView] = useState('list');
  return (
    <>
      <Group label="Temas" weight={58} className="wd-design-band">
        <Row className="wd-design-themes">
          <div className="wd-theme-gallery" data-hide-scrollbar>
            {[...THEMES, ...savedThemes].map((theme) => (
              <button key={theme.id} type="button" className={`wd-theme-card${doc.theme.id === theme.id ? ' is-active' : ''}`} title={theme.name} onMouseDown={(event) => event.preventDefault()} onClick={() => api.patchDoc({ theme })}>
                <span className="wd-theme-aa" style={{ fontFamily: theme.fonts.heading, color: theme.colors.heading }} aria-hidden="true">Aa</span>
                <i className="wd-theme-strip" aria-hidden="true">{['primary', 'accent', 'heading', 'muted'].map((key) => <b key={key} style={{ background: theme.colors[key] }} />)}</i>
                <small>{theme.name}</small>
              </button>
            ))}
          </div>
        </Row>
        <Row>
          <Menu icon={Palette} label="Colores del tema" text="Colores" wide width={250}>
            {() => (
              <div className="wd-pad">
                {['primary', 'accent', 'heading', 'text', 'muted'].map((key) => (
                  <label key={key} className="wd-field-inline">
                    {{ primary: 'Principal', accent: 'Acento', heading: 'Títulos', text: 'Texto', muted: 'Secundario' }[key]}
                    <input type="color" value={doc.theme.colors[key]} onChange={(event) => api.patchDoc({ theme: { ...doc.theme, id: 'custom', name: 'Personalizado', colors: { ...doc.theme.colors, [key]: event.target.value } } })} />
                  </label>
                ))}
              </div>
            )}
          </Menu>
          <Menu icon={Type} label="Fuentes del tema" text="Fuentes" wide width={260}>
            {(close) => (
              <>
                <Sep label="Títulos" />
                {FONTS.slice(0, 10).map(([value, label]) => <Item key={`h-${label}`} label={label} active={doc.theme.fonts.heading === value} close={close} onClick={() => api.patchDoc({ theme: { ...doc.theme, id: 'custom', name: 'Personalizado', fonts: { ...doc.theme.fonts, heading: value } } })} />)}
                <Sep label="Cuerpo" />
                {FONTS.slice(0, 10).map(([value, label]) => <Item key={`b-${label}`} label={label} active={doc.theme.fonts.body === value} close={close} onClick={() => api.patchDoc({ theme: { ...doc.theme, id: 'custom', name: 'Personalizado', fonts: { ...doc.theme.fonts, body: value } } })} />)}
              </>
            )}
          </Menu>
          <Menu icon={Sparkles} label="Efectos del tema" text="Efectos" wide width={220}>
            {(close) => [['none', 'Planos'], ['soft', 'Sombras suaves'], ['bold', 'Bordes marcados'], ['rounded', 'Redondeados']].map(([value, label]) => <Item key={value} label={label} active={(doc.theme.effects || 'none') === value} close={close} onClick={() => api.patchDoc({ theme: { ...doc.theme, effects: value } })} />)}
          </Menu>
          <Btn icon={Save} label="Guardar tema actual" onClick={() => api.run('saveTheme')} />
          <Btn icon={RotateCcw} label="Restablecer tema" onClick={() => api.patchDoc({ theme: THEMES[0], styleSet: 'default' })} />
        </Row>
      </Group>

      <Group label="Fondo de página" weight={42} className="wd-design-band">
        <Row>
          <Menu icon={Droplets} label="Color de página" text="Color" wide width={240}>
            {(close) => (
              <>
                <ColorGrid allowNone onPick={(color) => api.patchDoc({ background: color ? { type: 'color', value: color } : { type: 'none' } })} close={close} />
                <Sep label="Degradados" />
                {GRADIENTS.map(([value, label]) => <Item key={label} close={close} onClick={() => api.patchDoc({ background: { type: 'gradient', value } })}><span className="wd-bg-chip" style={{ background: value }} />{label}</Item>)}
                <Sep label="Texturas" />
                {TEXTURES.map(([value, label]) => <Item key={label} close={close} onClick={() => api.patchDoc({ background: { type: 'texture', value } })}><span className="wd-bg-chip" style={{ background: value }} />{label}</Item>)}
                <Sep />
                <Item icon={ImageIcon} label="Imagen de fondo…" close={close} onClick={() => api.run('backgroundImage')} />
              </>
            )}
          </Menu>
          <Menu
            icon={Stamp}
            label="Marca de agua"
            text="Marca de agua"
            wide
            width={280}
            limit={440}
            bare
            menuClass="is-watermark-menu"
            onOpenChange={(open) => { if (!open) setWatermarkView('list'); }}
          >
            {(close) => <WatermarkMenu api={api} close={close} view={watermarkView} setView={setWatermarkView} />}
          </Menu>
          <Btn icon={Square} label="Bordes de página…" wide onClick={() => api.run('pageBorders')}>Bordes de página</Btn>
        </Row>
      </Group>
    </>
  );
}
