import {
  AlignCenter, AlignLeft, AlignRight, ArrowDownToLine, ArrowUpToLine, BetweenHorizontalEnd, BetweenHorizontalStart, BetweenVerticalEnd,
  BetweenVerticalStart, BringToFront, Crop, Droplets, Eraser, FlipHorizontal2, FlipVertical2, Grid2x2, Minimize2, PaintBucket, PenLine,
  Repeat, Replace, RotateCcw, RotateCw, SendToBack, SlidersHorizontal, Sparkles, SquareSplitHorizontal, TableCellsMerge, TableCellsSplit,
  Text, Trash2, Type, WrapText, ArrowDownAZ, Sigma, Columns3, Rows3, Shapes, Database, ChartColumn, Palette, Plus, Minus, Network,
  AlignVerticalJustifyCenter, AlignStartVertical, AlignEndVertical, Square, FileText,
} from 'lucide-react';
import { Btn, ColorGrid, Group, Item, Menu, NumberField, Row, Select, Sep } from '../ui/controls';
import { CLIP_SHAPES, IMAGE_FILTERS, WRAP_MODES, readAdjust, readSpec } from '../engine/objects';
import { TABLE_STYLES } from '../engine/tables';
import { CHART_TYPES, PALETTES } from '../render/charts';
import { DIAGRAM_TYPES } from '../render/diagrams';
import { SHAPES } from '../render/shapes';

function Arrange({ api }) {
  return (
    <Group label="Organizar">
      <Row>
        <Menu icon={WrapText} label="Ajustar texto" text="Ajuste" width={220}>
          {(close) => (
            <>
              {Object.entries(WRAP_MODES).map(([mode, label]) => <Item key={mode} label={label} active={api.object?.dataset?.wrap === mode} close={close} onClick={() => api.run('wrap', mode)} />)}
              <Sep />
              <Item label="Ajuste a la derecha del texto" close={close} onClick={() => api.run('wrap', 'square', 'right')} />
              <Item label="Distancia respecto al texto…" close={close} onClick={() => api.run('wrapDistance')} />
            </>
          )}
        </Menu>
        <Btn icon={BringToFront} label="Traer al frente" onClick={() => api.run('zorder', 'front')} />
        <Btn icon={SendToBack} label="Enviar al fondo" onClick={() => api.run('zorder', 'back')} />
        <Btn icon={ArrowUpToLine} label="Traer adelante" onClick={() => api.run('zorder', 'forward')} />
        <Btn icon={ArrowDownToLine} label="Enviar atrás" onClick={() => api.run('zorder', 'backward')} />
      </Row>
      <Row>
        <Btn icon={RotateCw} label="Girar 90° derecha" onClick={() => api.run('rotate', 90)} />
        <Btn icon={RotateCcw} label="Girar 90° izquierda" onClick={() => api.run('rotate', -90)} />
        <Btn icon={FlipHorizontal2} label="Voltear horizontalmente" onClick={() => api.run('flip', 'h')} />
        <Btn icon={FlipVertical2} label="Voltear verticalmente" onClick={() => api.run('flip', 'v')} />
        <Menu icon={AlignCenter} label="Alinear" width={200}>
          {(close) => [['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha'], ['top', 'Arriba'], ['middle', 'En medio'], ['bottom', 'Abajo']].map(([mode, label]) => <Item key={mode} label={label} close={close} onClick={() => api.run('alignObjects', mode)} />)}
        </Menu>
        <Btn icon={Trash2} label="Eliminar objeto" onClick={() => api.run('deleteObject')} />
      </Row>
    </Group>
  );
}

function Size({ api }) {
  const el = api.object;
  return (
    <Group label="Tamaño">
      <Row><NumberField label="Ancho (px)" value={Math.round(el?.offsetWidth || 0)} min={16} max={2000} suffix="an" width={86} onChange={(value) => api.run('resize', value, null)} /></Row>
      <Row><NumberField label="Alto (px)" value={Math.round(el?.offsetHeight || 0)} min={12} max={2000} suffix="al" width={86} onChange={(value) => api.run('resize', null, value)} /></Row>
    </Group>
  );
}

export function ImageTab({ api }) {
  const adj = readAdjust(api.object);
  const slider = (key, label, min = 0, max = 200) => (
    <label className="wd-slider" key={key}>
      <span>{label}</span>
      <input type="range" min={min} max={max} value={adj[key]} onChange={(event) => api.run('adjust', { [key]: Number(event.target.value) })} />
      <em>{adj[key]}%</em>
    </label>
  );
  return (
    <>
      <Group label="Ajustar">
        <Row>
          <Btn icon={Eraser} label="Quitar fondo" wide onClick={() => api.run('removeBackground')} />
          <Menu icon={SlidersHorizontal} label="Correcciones" text="Correcciones" width={260}>
            {() => <div className="wd-pad">{slider('brightness', 'Brillo')}{slider('contrast', 'Contraste')}{slider('saturation', 'Saturación')}<button type="button" className="wd-item" onClick={() => api.run('adjust', { brightness: 100, contrast: 100, saturation: 100 })}>Restablecer correcciones</button></div>}
          </Menu>
        </Row>
        <Row>
          <Menu icon={Palette} label="Filtros artísticos" text="Filtros" width={210}>
            {(close) => Object.entries(IMAGE_FILTERS).map(([id, filter]) => <Item key={id} label={filter.label} active={adj.filter === id} close={close} onClick={() => api.run('adjust', { filter: id })} />)}
          </Menu>
          <Menu icon={Droplets} label="Transparencia" width={240}>
            {() => <div className="wd-pad">{slider('opacity', 'Opacidad', 5, 100)}</div>}
          </Menu>
          <Btn icon={Minimize2} label="Comprimir imagen" onClick={() => api.run('compress')} />
          <Btn icon={Replace} label="Reemplazar imagen" onClick={() => api.run('replaceImage')} />
          <Btn icon={RotateCcw} label="Restablecer imagen" onClick={() => api.run('resetImage')} />
        </Row>
      </Group>
      <Group label="Estilos de imagen">
        <Row>
          <Menu icon={Square} label="Borde de imagen" width={220}>
            {(close) => (
              <>
                <ColorGrid allowNone onPick={(color) => api.run('adjust', { border: color })} close={close} />
                <div className="wd-pad"><NumberField label="Grosor" value={adj.borderWidth} min={1} max={20} suffix="px" width={90} onChange={(value) => api.run('adjust', { borderWidth: value })} /></div>
              </>
            )}
          </Menu>
          <Btn icon={Sparkles} label="Sombra" active={adj.shadow} onClick={() => api.run('adjust', { shadow: !adj.shadow })} />
          <Menu icon={Sparkles} label="Efectos" width={220}>
            {(close) => (
              <>
                <Item label={adj.reflection ? 'Quitar reflejo' : 'Reflejo'} close={close} onClick={() => api.run('adjust', { reflection: !adj.reflection })} />
                <Item label="Resplandor verde" close={close} onClick={() => api.run('adjust', { glow: '#67bfa1' })} />
                <Item label="Resplandor dorado" close={close} onClick={() => api.run('adjust', { glow: '#f8c76b' })} />
                <Item label="Sin resplandor" close={close} onClick={() => api.run('adjust', { glow: '' })} />
                <Sep />
                {[0, 8, 16, 32].map((radius) => <Item key={radius} label={radius ? `Esquinas ${radius}px` : 'Esquinas rectas'} close={close} onClick={() => api.run('adjust', { radius })} />)}
              </>
            )}
          </Menu>
          <Btn icon={Type} label="Texto alternativo" onClick={() => api.run('altText')} />
        </Row>
      </Group>
      <Group label="Recortar">
        <Row>
          <Btn icon={Crop} label="Recortar" wide onClick={() => api.run('crop')} />
          <Menu icon={Shapes} label="Recortar a forma" width={200}>
            {(close) => Object.entries(CLIP_SHAPES).map(([id, shape]) => <Item key={id} label={shape.label} active={adj.clip === id} close={close} onClick={() => api.run('adjust', { clip: id })} />)}
          </Menu>
        </Row>
      </Group>
      <Size api={api} />
      <Arrange api={api} />
    </>
  );
}

export function TableTab({ api }) {
  const table = api.cell?.closest('table');
  return (
    <>
      <Group label="Filas y columnas">
        <Row>
          <Btn icon={BetweenHorizontalStart} label="Insertar fila arriba" onClick={() => api.run('tableOp', 'rowAbove')} />
          <Btn icon={BetweenHorizontalEnd} label="Insertar fila debajo" onClick={() => api.run('tableOp', 'rowBelow')} />
          <Btn icon={BetweenVerticalStart} label="Insertar columna a la izquierda" onClick={() => api.run('tableOp', 'colLeft')} />
          <Btn icon={BetweenVerticalEnd} label="Insertar columna a la derecha" onClick={() => api.run('tableOp', 'colRight')} />
        </Row>
        <Row>
          <Menu icon={Trash2} label="Eliminar" text="Eliminar" width={190}>
            {(close) => (
              <>
                <Item label="Eliminar fila" close={close} onClick={() => api.run('tableOp', 'deleteRow')} />
                <Item label="Eliminar columna" close={close} onClick={() => api.run('tableOp', 'deleteCol')} />
                <Item label="Eliminar tabla" danger close={close} onClick={() => api.run('tableOp', 'deleteTable')} />
              </>
            )}
          </Menu>
          <Btn icon={Repeat} label="Repetir fila de encabezado en cada página" active={table?.dataset.repeatHeader === 'true'} onClick={() => api.run('tableOp', 'repeatHeader')} />
        </Row>
      </Group>
      <Group label="Combinar">
        <Row>
          <Btn icon={TableCellsMerge} label="Combinar celdas (selecciona varias)" onClick={() => api.run('tableOp', 'merge')} />
          <Btn icon={TableCellsSplit} label="Dividir celdas…" onClick={() => api.run('tableOp', 'split')} />
          <Btn icon={SquareSplitHorizontal} label="Dividir tabla" onClick={() => api.run('tableOp', 'splitTable')} />
        </Row>
      </Group>
      <Group label="Tamaño de celda">
        <Row>
          <Btn icon={Rows3} label="Distribuir filas" onClick={() => api.run('tableOp', 'distributeRows')} />
          <Btn icon={Columns3} label="Distribuir columnas" onClick={() => api.run('tableOp', 'distributeCols')} />
          <Menu icon={Grid2x2} label="Autoajustar" width={210}>
            {(close) => (
              <>
                <Item label="Autoajustar al contenido" close={close} onClick={() => api.run('tableOp', 'fitContent')} />
                <Item label="Autoajustar a la ventana" close={close} onClick={() => api.run('tableOp', 'fitPage')} />
                <Item label="Ancho de columna fijo…" close={close} onClick={() => api.run('tableOp', 'colWidth')} />
                <Item label="Alto de fila…" close={close} onClick={() => api.run('tableOp', 'rowHeight')} />
              </>
            )}
          </Menu>
        </Row>
      </Group>
      <Group label="Alineación">
        <Row>
          <Btn icon={AlignLeft} label="Izquierda" onClick={() => api.run('cellAlign', { textAlign: 'left' })} />
          <Btn icon={AlignCenter} label="Centro" onClick={() => api.run('cellAlign', { textAlign: 'center' })} />
          <Btn icon={AlignRight} label="Derecha" onClick={() => api.run('cellAlign', { textAlign: 'right' })} />
        </Row>
        <Row>
          <Btn icon={AlignStartVertical} label="Arriba" onClick={() => api.run('cellAlign', { verticalAlign: 'top' })} />
          <Btn icon={AlignVerticalJustifyCenter} label="En medio" onClick={() => api.run('cellAlign', { verticalAlign: 'middle' })} />
          <Btn icon={AlignEndVertical} label="Abajo" onClick={() => api.run('cellAlign', { verticalAlign: 'bottom' })} />
          <Menu icon={Text} label="Dirección del texto" width={200}>
            {(close) => (
              <>
                <Item label="Horizontal" close={close} onClick={() => api.run('cellAlign', { writingMode: '', transform: '' })} />
                <Item label="Vertical (de arriba abajo)" close={close} onClick={() => api.run('cellAlign', { writingMode: 'vertical-rl', transform: '' })} />
                <Item label="Vertical (de abajo arriba)" close={close} onClick={() => api.run('cellAlign', { writingMode: 'vertical-rl', transform: 'rotate(180deg)' })} />
              </>
            )}
          </Menu>
        </Row>
      </Group>
      <Group label="Diseño de tabla">
        <Row>
          <Menu icon={Grid2x2} label="Estilos de tabla" text="Estilos" width={200}>
            {(close) => TABLE_STYLES.map((style) => <Item key={style.id} label={style.label} close={close} onClick={() => api.run('tableOp', 'style', style.id)} />)}
          </Menu>
          <Menu icon={PaintBucket} label="Sombreado de celdas" width={220}>{(close) => <ColorGrid allowNone onPick={(color) => api.run('cellAlign', { backgroundColor: color })} close={close} />}</Menu>
        </Row>
        <Row>
          <Menu icon={PenLine} label="Bordes" text="Bordes" width={240}>
            {(close) => (
              <>
                {[['all', 'Todos los bordes'], ['outer', 'Bordes externos'], ['inner', 'Bordes internos'], ['none', 'Sin bordes']].map(([mode, label]) => (
                  <Item key={mode} close={close} onClick={() => api.run('tableBorders', { mode })}>
                    <span className="wd-border-choice"><i className={`wd-border-mini is-${mode}`} />{label}</span>
                  </Item>
                ))}
                <Sep label="Estilo de pluma" />
                {[['solid', 'Continuo'], ['dashed', 'Discontinuo'], ['dotted', 'Punteado'], ['double', 'Doble']].map(([style, label]) => (
                  <Item key={style} active={api.borderPen.style === style} onClick={() => api.setBorderPen({ style })}>
                    <span className="wd-border-choice">{label}<i className="wd-border-sample" style={{ borderTopStyle: style }} /></span>
                  </Item>
                ))}
                <div className="wd-pad"><NumberField label="Grosor" value={api.borderPen.width} min={1} max={8} suffix="px" width={90} onChange={(width) => api.setBorderPen({ width })} /></div>
                <Sep label="Color de borde" />
                <ColorGrid value={api.borderPen.color} onPick={(color) => api.setBorderPen({ color })} />
              </>
            )}
          </Menu>
        </Row>
      </Group>
      <Group label="Datos">
        <Row>
          <Btn icon={ArrowDownAZ} label="Ordenar…" onClick={() => api.run('tableOp', 'sort')} />
          <Btn icon={Sigma} label="Fórmula…" onClick={() => api.run('tableOp', 'formula')} />
          <Btn icon={FileText} label="Convertir a texto" onClick={() => api.run('tableOp', 'toText')} />
        </Row>
      </Group>
    </>
  );
}

export function ShapeTab({ api }) {
  const spec = readSpec(api.object);
  const adj = readAdjust(api.object);
  return (
    <>
      <Group label="Estilos de forma">
        <Row>
          <Menu icon={PaintBucket} label="Relleno" width={220}>
            {(close) => (
              <>
                <ColorGrid allowNone value={spec.fill} onPick={(fill) => api.run('shapeSpec', { fill: fill || 'none' })} close={close} />
                <Item label={spec.gradient ? 'Quitar degradado' : 'Degradado'} close={close} onClick={() => api.run('shapeSpec', { gradient: !spec.gradient })} />
              </>
            )}
          </Menu>
          <Menu icon={PenLine} label="Contorno" width={220}>
            {(close) => (
              <>
                <ColorGrid allowNone value={spec.stroke} onPick={(stroke) => api.run('shapeSpec', { stroke: stroke || 'none' })} close={close} />
                <Sep label="Guiones" />
                {[['solid', 'Continuo'], ['dashed', 'Discontinuo'], ['dotted', 'Punteado'], ['dashdot', 'Raya-punto']].map(([dash, label]) => <Item key={dash} label={label} active={spec.dash === dash} close={close} onClick={() => api.run('shapeSpec', { dash })} />)}
              </>
            )}
          </Menu>
          <NumberField label="Grosor del contorno" value={spec.strokeWidth ?? 2} min={0} max={30} step={0.5} suffix="px" width={78} onChange={(strokeWidth) => api.run('shapeSpec', { strokeWidth })} />
        </Row>
        <Row>
          <Menu icon={Droplets} label="Transparencia" width={240}>
            {() => (
              <div className="wd-pad">
                <label className="wd-slider"><span>Opacidad</span><input type="range" min={5} max={100} value={adj.opacity} onChange={(event) => api.run('adjust', { opacity: Number(event.target.value) })} /><em>{adj.opacity}%</em></label>
              </div>
            )}
          </Menu>
          <Btn icon={Sparkles} label="Sombra" active={adj.shadow} onClick={() => api.run('adjust', { shadow: !adj.shadow })} />
          <Btn icon={Sparkles} label="Reflejo" active={adj.reflection} onClick={() => api.run('adjust', { reflection: !adj.reflection })} />
          <Btn icon={Type} label="Texto de la forma" onClick={() => api.run('shapeText')} />
          <Menu icon={Shapes} label="Cambiar forma" width={220}>
            {(close) => Object.entries(SHAPES).map(([type, shape]) => <Item key={type} label={shape.label} active={spec.type === type} close={close} onClick={() => api.run('shapeSpec', { type })} />)}
          </Menu>
        </Row>
      </Group>
      <Size api={api} />
      <Arrange api={api} />
    </>
  );
}

export function ChartTab({ api }) {
  const spec = readSpec(api.object);
  return (
    <>
      <Group label="Datos">
        <Row>
          <Btn icon={Database} label="Editar datos" wide onClick={() => api.run('chartData')} />
          <Menu icon={ChartColumn} label="Cambiar tipo" text={CHART_TYPES[spec.type]} width={200}>
            {(close) => Object.entries(CHART_TYPES).map(([type, label]) => <Item key={type} label={label} active={spec.type === type} close={close} onClick={() => api.run('chartSpec', { type })} />)}
          </Menu>
        </Row>
      </Group>
      <Group label="Elementos">
        <Row>
          <Select label="Leyenda" width={110} value={spec.legend || 'bottom'} options={[['bottom', 'Leyenda abajo'], ['top', 'Leyenda arriba'], ['right', 'Leyenda derecha'], ['none', 'Sin leyenda']]} onChange={(legend) => api.run('chartSpec', { legend })} />
          <Btn icon={Type} label="Etiquetas de datos" active={spec.showLabels} onClick={() => api.run('chartSpec', { showLabels: !spec.showLabels })} />
          <Btn icon={Grid2x2} label="Líneas de cuadrícula" active={spec.gridlines} onClick={() => api.run('chartSpec', { gridlines: !spec.gridlines })} />
        </Row>
        <Row>
          <Btn icon={Text} label="Títulos y ejes…" wide onClick={() => api.run('chartAxes')} />
        </Row>
      </Group>
      <Group label="Estilos">
        <Row>
          <Menu icon={Palette} label="Colores" width={200}>
            {(close) => Object.entries(PALETTES).map(([id, colors]) => <Item key={id} active={spec.palette === id} close={close} onClick={() => api.run('chartSpec', { palette: id })}><span className="wd-palette">{colors.slice(0, 5).map((color) => <b key={color} style={{ background: color }} />)}</span></Item>)}
          </Menu>
          <Select label="Estilo" width={110} value={spec.style || 'flat'} options={[['flat', 'Plano'], ['rounded', 'Redondeado'], ['outline', 'Contorno']]} onChange={(style) => api.run('chartSpec', { style })} />
        </Row>
      </Group>
      <Size api={api} />
      <Arrange api={api} />
    </>
  );
}

export function DiagramTab({ api }) {
  const spec = readSpec(api.object);
  return (
    <>
      <Group label="Crear gráfico">
        <Row>
          <Btn icon={Text} label="Editar texto y nodos" wide onClick={() => api.run('diagramText')} />
        </Row>
        <Row>
          <Btn icon={Plus} label="Agregar nodo" onClick={() => api.run('diagramNode', 1)} />
          <Btn icon={Minus} label="Eliminar último nodo" onClick={() => api.run('diagramNode', -1)} />
        </Row>
      </Group>
      <Group label="Diseños">
        <Row>
          <Menu icon={Network} label="Cambiar diseño" text={DIAGRAM_TYPES[spec.type]} width={200}>
            {(close) => Object.entries(DIAGRAM_TYPES).map(([type, label]) => <Item key={type} label={label} active={spec.type === type} close={close} onClick={() => api.run('diagramSpec', { type })} />)}
          </Menu>
          <Select label="Dirección" width={110} value={spec.direction || 'horizontal'} options={[['horizontal', 'Horizontal'], ['vertical', 'Vertical']]} onChange={(direction) => api.run('diagramSpec', { direction })} />
        </Row>
      </Group>
      <Group label="Estilos">
        <Row>
          <Menu icon={Palette} label="Colores" width={200}>
            {(close) => Object.entries(PALETTES).map(([id, colors]) => <Item key={id} active={spec.palette === id} close={close} onClick={() => api.run('diagramSpec', { palette: id })}><span className="wd-palette">{colors.slice(0, 5).map((color) => <b key={color} style={{ background: color }} />)}</span></Item>)}
          </Menu>
          <Select label="Estilo" width={110} value={spec.style || 'filled'} options={[['filled', 'Relleno'], ['outline', 'Contorno']]} onChange={(style) => api.run('diagramSpec', { style })} />
        </Row>
      </Group>
      <Size api={api} />
      <Arrange api={api} />
    </>
  );
}

export function ObjectTab({ api }) {
  return (
    <>
      <Group label="Objeto">
        <Row>
          <Btn icon={Type} label="Editar" wide onClick={() => api.run('editObject')} />
        </Row>
      </Group>
      <Size api={api} />
      <Arrange api={api} />
    </>
  );
}
