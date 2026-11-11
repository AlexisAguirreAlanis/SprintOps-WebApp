import { Eraser, Lasso, Highlighter, Pencil, PenTool, Pen, Brush, BoxSelect, Ruler, Shapes, Type, Wand2, Trash2, Group as GroupIcon, Ungroup, Star, MousePointer, Spline } from 'lucide-react';
import { Btn, ColorGrid, Group, Item, Menu, NumberField, Row, Sep } from '../ui/controls';
import { INK_TOOLS } from '../draw/ink';

const TOOL_ICONS = { pencil: Pencil, ballpoint: Pen, fountain: PenTool, marker: Brush, highlighter: Highlighter };

const INK_STYLES = [
  { label: 'Técnica (fina, negra)', pen: { tool: 'ballpoint', color: '#111827', width: 1.4, opacity: 1 } },
  { label: 'Caligrafía', pen: { tool: 'fountain', color: '#1e3a8a', width: 4, opacity: 1 } },
  { label: 'Pizarra', pen: { tool: 'marker', color: '#2f6f5e', width: 7, opacity: 0.95 } },
  { label: 'Resaltado amarillo', pen: { tool: 'highlighter', color: '#facc15', width: 18, opacity: 0.35 } },
  { label: 'Boceto (lápiz)', pen: { tool: 'pencil', color: '#475569', width: 1.6, opacity: 0.85 } },
];

const InkColorIcon = ({ color }) => <span className="wd-ink-chip" style={{ background: color }} aria-hidden="true" />;

export default function DrawTab({ api }) {
  const { pen, setPen } = api;
  const favorites = api.storage.get('inkFavorites', []);
  const hasSelection = api.inkSelection.length > 0;
  return (
    <>
      <Group label="Herramientas" weight={38} className="wd-draw-band">
        <Row>
          <Btn icon={MousePointer} label="Escribir (sin dibujo)" active={!pen.tool} onClick={() => setPen({ tool: null })} />
          {Object.entries(INK_TOOLS).map(([tool, meta]) => (
            <Btn key={tool} icon={TOOL_ICONS[tool]} label={meta.label} active={pen.tool === tool} onClick={() => setPen({ tool, width: meta.width, opacity: meta.opacity, color: tool === 'highlighter' && pen.color === '#1e293b' ? '#facc15' : pen.color })} />
          ))}
          <Btn icon={Eraser} label="Borrador (de puntos)" active={pen.tool === 'eraser'} onClick={() => setPen({ tool: 'eraser', width: 12 })} />
          <Btn icon={Spline} label="Borrador de trazos" active={pen.tool === 'strokeEraser'} onClick={() => setPen({ tool: 'strokeEraser', width: 10 })} />
        </Row>
        <Row>
          <Btn icon={BoxSelect} label="Selección de tinta" active={pen.tool === 'select'} onClick={() => setPen({ tool: 'select' })} />
          <Btn icon={Lasso} label="Selección con lazo" active={pen.tool === 'lasso'} onClick={() => setPen({ tool: 'lasso' })} />
          <Btn icon={Ruler} label="Regla (trazos rectos)" active={pen.ruler?.on} onClick={() => setPen({ ruler: { on: !pen.ruler?.on, angle: pen.ruler?.angle || 0 } })} />
          {pen.ruler?.on && <NumberField label="Ángulo de la regla" value={pen.ruler.angle} min={-180} max={180} step={5} suffix="°" width={68} onChange={(angle) => setPen({ ruler: { on: true, angle } })} />}
        </Row>
      </Group>
      <Group label="Personalización" weight={28} className="wd-draw-band">
        <Row>
          <Menu label="Color de tinta" icon={() => <InkColorIcon color={pen.color} />} width={202}>{(close) => <ColorGrid value={pen.color} onPick={(color) => setPen({ color })} close={close} />}</Menu>
          <NumberField label="Grosor" value={pen.width ?? 2} min={0.5} max={40} step={0.5} suffix="px" width={68} onChange={(width) => setPen({ width })} />
          <NumberField label="Opacidad" value={Math.round((pen.opacity ?? 1) * 100)} min={5} max={100} step={5} suffix="%" width={68} onChange={(value) => setPen({ opacity: value / 100 })} />
        </Row>
        <Row>
          <Menu icon={Star} label="Favoritas y estilos de tinta" text="Estilos" wide width={240}>
            {(close) => (
              <>
                <Sep label="Estilos de tinta" />
                {INK_STYLES.map((style) => <Item key={style.label} label={style.label} close={close} onClick={() => setPen(style.pen)} />)}
                {favorites.length > 0 && <Sep label="Favoritas" />}
                {favorites.map((fav, index) => (
                  <Item key={index} close={close} onClick={() => setPen(fav)}>
                    <span className="wd-ink-chip" style={{ background: fav.color }} /> {INK_TOOLS[fav.tool]?.label} · {fav.width}px
                  </Item>
                ))}
                <Sep />
                <Item label="Guardar herramienta actual en favoritas" close={close} disabled={!INK_TOOLS[pen.tool]} onClick={() => api.storage.set('inkFavorites', [...favorites, { tool: pen.tool, color: pen.color, width: pen.width, opacity: pen.opacity }].slice(-8))} />
                {favorites.length > 0 && <Item label="Vaciar favoritas" close={close} onClick={() => api.storage.set('inkFavorites', [])} />}
              </>
            )}
          </Menu>
        </Row>
      </Group>
      <Group label="Funciones inteligentes" weight={32} className="wd-draw-band">
        <Row>
          <Btn icon={Type} label="Convertir tinta en texto (IA)" disabled={!hasSelection} onClick={() => api.run('inkToText')} />
          <Btn icon={Shapes} label="Convertir tinta en formas" disabled={!hasSelection} onClick={() => api.run('inkToShapes')} />
          <Btn icon={Wand2} label="Reconocer figuras (perfeccionar trazos)" disabled={!hasSelection} onClick={() => api.run('recognizeInk')} />
          <Btn icon={Spline} label="Corregir trazos (suavizar)" disabled={!hasSelection} onClick={() => api.run('smoothInk')} />
        </Row>
        <Row>
          <Btn icon={GroupIcon} label="Agrupar trazos" disabled={api.inkSelection.length < 2} onClick={() => api.run('groupInk')} />
          <Btn icon={Ungroup} label="Desagrupar trazos" disabled={!hasSelection} onClick={() => api.run('ungroupInk')} />
          <Btn icon={Trash2} label="Eliminar trazos seleccionados" disabled={!hasSelection} onClick={() => api.run('deleteInk')} />
          <Btn icon={Trash2} label="Borrar toda la tinta de la página" onClick={() => api.run('clearInk')} />
        </Row>
      </Group>
      <Group label="Consejo" grow className="wd-draw-band wd-draw-tip">
        <p className="wd-ribbon-hint">Mueve, gira (círculo superior) o redimensiona (círculo inferior) la selección. Funciona con mouse, trackpad, pantalla táctil y lápiz con presión.</p>
      </Group>
    </>
  );
}
