import { Palette, Type, Droplets, Image as ImageIcon, Stamp, Square, Save, RotateCcw, Rows3, Sparkles, Brush } from 'lucide-react';
import { Btn, ColorGrid, Group, Item, Menu, Row, Sep } from '../ui/controls';
import { STYLE_SETS, THEMES } from '../model';
import { FONTS } from './HomeTab';

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

export default function DesignTab({ api }) {
  const { doc } = api;
  const savedThemes = api.storage.get('themes', []);
  return (
    <>
      <Group label="Temas">
        <div className="wd-theme-gallery">
          {[...THEMES, ...savedThemes].map((theme) => (
            <button key={theme.id} type="button" className={`wd-theme-card${doc.theme.id === theme.id ? ' is-active' : ''}`} title={theme.name} onMouseDown={(event) => event.preventDefault()} onClick={() => api.patchDoc({ theme })}>
              <span style={{ fontFamily: theme.fonts.heading, color: theme.colors.heading }}>Aa</span>
              <i>{['primary', 'accent', 'heading', 'muted'].map((key) => <b key={key} style={{ background: theme.colors[key] }} />)}</i>
              <small>{theme.name}</small>
            </button>
          ))}
        </div>
        <Row>
          <Menu icon={Palette} label="Colores del tema" width={250}>
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
          <Menu icon={Type} label="Fuentes del tema" width={260}>
            {(close) => (
              <>
                <Sep label="Títulos" />
                {FONTS.slice(0, 10).map(([value, label]) => <Item key={`h-${label}`} label={label} active={doc.theme.fonts.heading === value} close={close} onClick={() => api.patchDoc({ theme: { ...doc.theme, id: 'custom', name: 'Personalizado', fonts: { ...doc.theme.fonts, heading: value } } })} />)}
                <Sep label="Cuerpo" />
                {FONTS.slice(0, 10).map(([value, label]) => <Item key={`b-${label}`} label={label} active={doc.theme.fonts.body === value} close={close} onClick={() => api.patchDoc({ theme: { ...doc.theme, id: 'custom', name: 'Personalizado', fonts: { ...doc.theme.fonts, body: value } } })} />)}
              </>
            )}
          </Menu>
          <Menu icon={Sparkles} label="Efectos del tema" width={220}>
            {(close) => [['none', 'Planos'], ['soft', 'Sombras suaves'], ['bold', 'Bordes marcados'], ['rounded', 'Redondeados']].map(([value, label]) => <Item key={value} label={label} active={(doc.theme.effects || 'none') === value} close={close} onClick={() => api.patchDoc({ theme: { ...doc.theme, effects: value } })} />)}
          </Menu>
          <Btn icon={Save} label="Guardar tema actual" onClick={() => api.run('saveTheme')} />
          <Btn icon={RotateCcw} label="Restablecer tema" onClick={() => api.patchDoc({ theme: THEMES[0], styleSet: 'default' })} />
        </Row>
      </Group>

      <Group label="Formato del documento">
        <Row>
          <Menu icon={Rows3} label="Conjunto de estilos" text={STYLE_SETS[doc.styleSet].label} width={210}>
            {(close) => Object.entries(STYLE_SETS).map(([id, set]) => <Item key={id} label={set.label} active={doc.styleSet === id} close={close} onClick={() => api.patchDoc({ styleSet: id })} />)}
          </Menu>
        </Row>
        <Row>
          <Menu icon={Rows3} label="Espaciado de párrafo" text="Espaciado" width={220}>
            {(close) => [['', 'Del conjunto de estilos'], ['0', 'Sin espaciado'], ['6', 'Compacto'], ['12', 'Abierto'], ['20', 'Relajado'], ['28', 'Doble']].map(([value, label]) => <Item key={label} label={label} active={String(doc.theme.paragraphAfter ?? '') === value} close={close} onClick={() => api.patchDoc({ theme: { ...doc.theme, paragraphAfter: value === '' ? undefined : Number(value) } })} />)}
          </Menu>
          <Btn icon={Brush} label="Formato consistente (normaliza fuentes y colores directos)" onClick={() => api.run('normalizeFormatting')} />
          <Btn icon={Save} label="Establecer como formato predeterminado" onClick={() => api.run('setDefaultStyles')} />
        </Row>
      </Group>

      <Group label="Fondo de página">
        <Row>
          <Menu icon={Droplets} label="Color de página" text="Color" width={240}>
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
          <Menu icon={Stamp} label="Marca de agua" text="Marca de agua" width={230}>
            {(close) => (
              <>
                {['BORRADOR', 'CONFIDENCIAL', 'NO COPIAR', 'URGENTE', 'MUESTRA'].map((text) => <Item key={text} label={text} close={close} onClick={() => api.patchDoc({ watermark: { type: 'text', text, color: '#94a3b8', opacity: 0.18, rotate: -35, size: 96 } })} />)}
                <Sep />
                <Item label="Marca de agua personalizada…" close={close} onClick={() => api.run('watermark')} />
                <Item label="Quitar marca de agua" close={close} onClick={() => api.patchDoc({ watermark: { type: 'none' } })} />
              </>
            )}
          </Menu>
          <Btn icon={Square} label="Bordes de página…" wide onClick={() => api.run('pageBorders')} />
        </Row>
      </Group>
    </>
  );
}
