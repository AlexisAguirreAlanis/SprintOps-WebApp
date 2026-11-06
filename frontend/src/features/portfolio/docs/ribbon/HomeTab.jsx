import {
  AArrowDown, AArrowUp, AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowDownAZ, Baseline, Bold, Brush, CaseSensitive, ClipboardPaste,
  Copy, Eraser, Highlighter, IndentDecrease, IndentIncrease, Italic, List, ListOrdered, ListTree, MousePointer2, PaintBucket, Pilcrow,
  Redo2, Replace, Scissors, Search, SquareDashed, Strikethrough, Subscript, Superscript, Type, Underline, Undo2, WandSparkles, Navigation,
  TextSelect, ScanText, BetweenHorizontalStart,
} from 'lucide-react';
import { Btn, ColorGrid, Group, Item, Menu, Row, Select, Sep } from '../ui/controls';

export const FONTS = [
  ['Georgia, "Times New Roman", serif', 'Georgia'],
  ['"Times New Roman", Times, serif', 'Times New Roman'],
  ['"Iowan Old Style", Palatino, "Palatino Linotype", serif', 'Palatino'],
  ['Garamond, "EB Garamond", serif', 'Garamond'],
  ['ui-sans-serif, system-ui, "Segoe UI", sans-serif', 'Sistema'],
  ['Calibri, Carlito, "Segoe UI", sans-serif', 'Calibri'],
  ['Arial, Helvetica, sans-serif', 'Arial'],
  ['"Helvetica Neue", Helvetica, sans-serif', 'Helvetica'],
  ['"Avenir Next", Avenir, "Segoe UI", sans-serif', 'Avenir'],
  ['Verdana, Geneva, sans-serif', 'Verdana'],
  ['Tahoma, Geneva, sans-serif', 'Tahoma'],
  ['"Trebuchet MS", sans-serif', 'Trebuchet'],
  ['"Gill Sans", "Gill Sans MT", sans-serif', 'Gill Sans'],
  ['"Comic Sans MS", "Comic Neue", cursive', 'Comic Sans'],
  ['"Courier New", Courier, monospace', 'Courier New'],
  ['ui-monospace, SFMono-Regular, Menlo, monospace', 'Monoespaciada'],
];

export const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 60, 72, 96];

export const NAMED_STYLES = [
  { id: 'normal', label: 'Normal', tag: 'P' },
  { id: 'nospacing', label: 'Sin espaciado', tag: 'P', cls: 'wd-style-nospacing' },
  { id: 'title', label: 'Título', tag: 'H1', cls: 'wd-style-title' },
  { id: 'subtitle', label: 'Subtítulo', tag: 'P', cls: 'wd-style-subtitle' },
  { id: 'h1', label: 'Encabezado 1', tag: 'H1' },
  { id: 'h2', label: 'Encabezado 2', tag: 'H2' },
  { id: 'h3', label: 'Encabezado 3', tag: 'H3' },
  { id: 'h4', label: 'Encabezado 4', tag: 'H4' },
  { id: 'h5', label: 'Encabezado 5', tag: 'H5' },
  { id: 'h6', label: 'Encabezado 6', tag: 'H6' },
  { id: 'quote', label: 'Cita', tag: 'BLOCKQUOTE' },
  { id: 'intense', label: 'Cita destacada', tag: 'BLOCKQUOTE', cls: 'wd-style-intense' },
  { id: 'emphasis', label: 'Énfasis', tag: 'P', cls: 'wd-style-emphasis' },
  { id: 'strong', label: 'Énfasis intenso', tag: 'P', cls: 'wd-style-strong' },
  { id: 'code', label: 'Código', tag: 'PRE', cls: 'wd-code' },
];

const BULLETS = [['disc', '● Círculo'], ['circle', '○ Círculo vacío'], ['square', '■ Cuadrado'], ['"✓  "', '✓ Check'], ['"➤  "', '➤ Flecha'], ['"–  "', '– Guion'], ['"★  "', '★ Estrella']];
const NUMBERS = [['decimal', '1. 2. 3.'], ['decimal-leading-zero', '01. 02. 03.'], ['lower-alpha', 'a. b. c.'], ['upper-alpha', 'A. B. C.'], ['lower-roman', 'i. ii. iii.'], ['upper-roman', 'I. II. III.']];

export default function HomeTab({ api, sel }) {
  const styles = [...NAMED_STYLES, ...api.doc.customStyles.map((style) => ({ id: style.id, label: style.name, tag: style.tag || 'P', cls: `wd-cs-${style.id}` }))];
  return (
    <>
      <Group label="Portapapeles">
        <Row>
          <Menu icon={ClipboardPaste} label="Pegar" text="Pegar" width={230}>
            {(close) => (
              <>
                <Item icon={ClipboardPaste} label="Pegar" hint="⌘V" close={close} onClick={() => api.run('paste')} />
                <Item icon={Type} label="Pegar sin formato" hint="⌘⇧V" close={close} onClick={() => api.run('pastePlain')} />
                <Item icon={WandSparkles} label="Pegado especial…" close={close} onClick={() => api.run('pasteSpecial')} />
              </>
            )}
          </Menu>
        </Row>
        <Row>
          <Btn icon={Scissors} label="Cortar (⌘X)" onClick={() => api.run('cut')} />
          <Btn icon={Copy} label="Copiar (⌘C)" onClick={() => api.run('copy')} />
          <Btn icon={Brush} label="Copiar formato (⌘⇧C) · doble clic para pegar varias veces" active={api.painter} onClick={() => api.run('copyFormat')} onDoubleClick={() => api.run('copyFormat', true)} />
          <Btn icon={PaintBucket} label="Pegar formato (⌘⇧V con formato copiado)" onClick={() => api.run('pasteFormat')} />
          <Btn icon={Undo2} label="Deshacer (⌘Z)" disabled={!api.canUndo} onClick={() => api.run('undo')} />
          <Btn icon={Redo2} label="Rehacer (⌘⇧Z)" disabled={!api.canRedo} onClick={() => api.run('redo')} />
        </Row>
      </Group>

      <Group label="Fuente">
        <Row>
          <Select label="Fuente" width={132} value={FONTS.find(([value]) => sel.font && value.toLowerCase().includes(sel.font.toLowerCase()))?.[0] || ''} options={[['', sel.font || 'Fuente'], ...FONTS]} onChange={(value) => value && api.inline({ fontFamily: value })} />
          <Select label="Tamaño" width={62} value={String(sel.size || '')} options={[['', sel.size ? String(sel.size) : '—'], ...SIZES.map((size) => [String(size), String(size)])]} onChange={(value) => value && api.inline({ fontSize: `${value}px` })} />
          <Btn icon={AArrowUp} label="Aumentar tamaño (⌘])" onClick={() => api.run('growFont', 1)} />
          <Btn icon={AArrowDown} label="Disminuir tamaño (⌘[)" onClick={() => api.run('growFont', -1)} />
          <Menu icon={CaseSensitive} label="Mayúsculas y minúsculas" width={220}>
            {(close) => (
              <>
                <Item label="Tipo oración." close={close} onClick={() => api.caseOf('sentence')} />
                <Item label="minúsculas" close={close} onClick={() => api.caseOf('lower')} />
                <Item label="MAYÚSCULAS" close={close} onClick={() => api.caseOf('upper')} />
                <Item label="Poner En Mayúsculas Cada Palabra" close={close} onClick={() => api.caseOf('title')} />
                <Item label="iNVERTIR mAYÚSCULAS" close={close} onClick={() => api.caseOf('toggle')} />
              </>
            )}
          </Menu>
          <Btn icon={Eraser} label="Borrar formato" onClick={() => api.run('clearFormat')} />
        </Row>
        <Row>
          <Btn icon={Bold} label="Negrita (⌘B)" active={sel.bold} onClick={() => api.cmd('bold')} />
          <Btn icon={Italic} label="Cursiva (⌘I)" active={sel.italic} onClick={() => api.cmd('italic')} />
          <Menu icon={Underline} label="Subrayado y estilos" active={sel.underline} width={220}>
            {(close) => (
              <>
                <Item label="Subrayado" hint="⌘U" close={close} onClick={() => api.cmd('underline')} />
                {[['double', 'Doble'], ['dotted', 'Punteado'], ['dashed', 'Discontinuo'], ['wavy', 'Ondulado']].map(([style, label]) => (
                  <Item key={style} close={close} onClick={() => api.inline({ textDecorationLine: 'underline', textDecorationStyle: style })}><span style={{ textDecoration: `underline ${style}` }}>{label}</span></Item>
                ))}
                <Item label="Subrayado grueso" close={close} onClick={() => api.inline({ textDecorationLine: 'underline', textDecorationThickness: '3px' })} />
                <Sep label="Color del subrayado" />
                <ColorGrid onPick={(color) => api.inline({ textDecorationLine: 'underline', textDecorationColor: color })} close={close} />
              </>
            )}
          </Menu>
          <Menu icon={Strikethrough} label="Tachado" active={sel.strike} width={190}>
            {(close) => (
              <>
                <Item label="Tachado" close={close} onClick={() => api.cmd('strikeThrough')} />
                <Item label="Doble tachado" close={close} onClick={() => api.inline({ textDecorationLine: 'line-through', textDecorationStyle: 'double' })} />
              </>
            )}
          </Menu>
          <Btn icon={Subscript} label="Subíndice (⌘,)" active={sel.sub} onClick={() => api.cmd('subscript')} />
          <Btn icon={Superscript} label="Superíndice (⌘.)" active={sel.sup} onClick={() => api.cmd('superscript')} />
          <Menu icon={Baseline} label="Color de fuente" width={220}>{(close) => <ColorGrid value={sel.color} recent={api.recentColors} onPick={(color) => api.inline({ color })} close={close} />}</Menu>
          <Menu icon={Highlighter} label="Color de resaltado" width={220}>{(close) => <ColorGrid allowNone onPick={(color) => api.inline({ backgroundColor: color || 'transparent' })} close={close} />}</Menu>
          <Menu icon={WandSparkles} label="Efectos de texto" width={240}>
            {(close) => (
              <>
                <Item label="Contorno" close={close} onClick={() => api.inline({ WebkitTextStroke: '1px currentColor', color: 'transparent' })} />
                <Item label="Sombra" close={close} onClick={() => api.inline({ textShadow: '2px 2px 3px rgba(15,23,42,.35)' })} />
                <Item label="Reflexión" close={close} onClick={() => api.inline({ display: 'inline-block', WebkitBoxReflect: 'below -4px linear-gradient(transparent 40%, rgba(255,255,255,.4))' })} />
                <Item label="Iluminado" close={close} onClick={() => api.inline({ textShadow: '0 0 6px #67bfa1, 0 0 12px #67bfa1' })} />
                <Item label="Relieve" close={close} onClick={() => api.inline({ textShadow: '-1px -1px 0 #fff, 1px 1px 2px rgba(0,0,0,.4)' })} />
                <Item label="Versalitas" close={close} onClick={() => api.inline({ fontVariant: 'small-caps' })} />
                <Item label="Quitar efectos" close={close} onClick={() => api.inline({ textShadow: 'none', WebkitTextStroke: '0', WebkitBoxReflect: 'none', fontVariant: 'normal' })} />
                <Sep />
                <Item label="Fuente avanzada…" hint="⌘D" close={close} onClick={() => api.run('fontDialog')} />
                <Item label="Establecer fuente predeterminada…" close={close} onClick={() => api.run('defaultFont')} />
              </>
            )}
          </Menu>
        </Row>
      </Group>

      <Group label="Párrafo">
        <Row>
          <Menu icon={List} label="Viñetas" active={sel.list === 'UL'} width={210}>
            {(close) => (
              <>
                <Item label="Lista con viñetas" hint="⌘⇧8" close={close} onClick={() => api.cmd('insertUnorderedList')} />
                <Sep label="Biblioteca de viñetas" />
                {BULLETS.map(([value, label]) => <Item key={value} label={label} close={close} onClick={() => api.run('listStyle', 'UL', value)} />)}
                <Item label="Viñeta personalizada…" close={close} onClick={() => api.run('customList', 'UL')} />
              </>
            )}
          </Menu>
          <Menu icon={ListOrdered} label="Numeración" active={sel.list === 'OL'} width={220}>
            {(close) => (
              <>
                <Item label="Lista numerada" hint="⌘⇧7" close={close} onClick={() => api.cmd('insertOrderedList')} />
                <Sep label="Formato" />
                {NUMBERS.map(([value, label]) => <Item key={value} label={label} close={close} onClick={() => api.run('listStyle', 'OL', value)} />)}
                <Item label="Formato personalizado…" close={close} onClick={() => api.run('customList', 'OL')} />
                <Sep />
                <Item label="Reiniciar en 1" close={close} onClick={() => api.run('restartNumbering')} />
                <Item label="Continuar numeración" close={close} onClick={() => api.run('continueNumbering')} />
                <Item label="Establecer valor…" close={close} onClick={() => api.run('setNumbering')} />
              </>
            )}
          </Menu>
          <Menu icon={ListTree} label="Lista multinivel" width={230}>
            {(close) => (
              <>
                <Item label="1. / 1.1. / 1.1.1." close={close} onClick={() => api.run('multilevel', 'legal')} />
                <Item label="1. / a. / i." close={close} onClick={() => api.run('multilevel', 'outline')} />
                <Item label="● / ○ / ■" close={close} onClick={() => api.run('multilevel', 'bullets')} />
                <Sep />
                <Item label="Aumentar nivel" hint="Tab" close={close} onClick={() => api.cmd('indent')} />
                <Item label="Disminuir nivel" hint="⇧Tab" close={close} onClick={() => api.cmd('outdent')} />
              </>
            )}
          </Menu>
          <Btn icon={IndentDecrease} label="Disminuir sangría" onClick={() => api.run('indent', -1)} />
          <Btn icon={IndentIncrease} label="Aumentar sangría" onClick={() => api.run('indent', 1)} />
          <Menu icon={ArrowDownAZ} label="Ordenar" width={200}>
            {(close) => (
              <>
                <Item label="A → Z" close={close} onClick={() => api.run('sort', 'asc')} />
                <Item label="Z → A" close={close} onClick={() => api.run('sort', 'desc')} />
                <Item label="Numérico ascendente" close={close} onClick={() => api.run('sort', 'asc', true)} />
                <Item label="Numérico descendente" close={close} onClick={() => api.run('sort', 'desc', true)} />
              </>
            )}
          </Menu>
          <Btn icon={Pilcrow} label="Mostrar marcas de formato (⌘*)" active={api.view.marks} onClick={() => api.setView({ marks: !api.view.marks })} />
        </Row>
        <Row>
          <Btn icon={AlignLeft} label="Alinear a la izquierda (⌘L)" active={sel.align === 'left' || sel.align === 'start'} onClick={() => api.cmd('justifyLeft')} />
          <Btn icon={AlignCenter} label="Centrar (⌘E)" active={sel.align === 'center'} onClick={() => api.cmd('justifyCenter')} />
          <Btn icon={AlignRight} label="Alinear a la derecha (⌘R)" active={sel.align === 'right' || sel.align === 'end'} onClick={() => api.cmd('justifyRight')} />
          <Btn icon={AlignJustify} label="Justificar (⌘J)" active={sel.align === 'justify'} onClick={() => api.cmd('justifyFull')} />
          <Menu icon={BetweenHorizontalStart} label="Interlineado y espaciado" width={240}>
            {(close) => (
              <>
                {[['1', 'Sencillo'], ['1.15', '1.15'], ['1.5', '1.5'], ['2', 'Doble'], ['2.5', '2.5'], ['3', '3.0']].map(([value, label]) => <Item key={value} label={label} active={String(sel.line) === value} close={close} onClick={() => api.block({ lineHeight: value })} />)}
                <Item label="Personalizado…" close={close} onClick={() => api.run('paragraphDialog')} />
                <Sep label="Espaciado" />
                <Item label="Agregar espacio antes" close={close} onClick={() => api.block({ marginTop: '12px' })} />
                <Item label="Quitar espacio antes" close={close} onClick={() => api.block({ marginTop: '0px' })} />
                <Item label="Agregar espacio después" close={close} onClick={() => api.block({ marginBottom: '12px' })} />
                <Item label="Quitar espacio después" close={close} onClick={() => api.block({ marginBottom: '0px' })} />
              </>
            )}
          </Menu>
          <Menu icon={PaintBucket} label="Sombreado del párrafo" width={220}>{(close) => <ColorGrid allowNone onPick={(color) => api.block({ backgroundColor: color || '' , padding: color ? '4px 8px' : '' })} close={close} />}</Menu>
          <Menu icon={SquareDashed} label="Bordes del párrafo" width={220}>
            {(close) => (
              <>
                <Item label="Borde inferior" close={close} onClick={() => api.block({ borderBottom: '1.5px solid currentColor', paddingBottom: '4px' })} />
                <Item label="Borde superior" close={close} onClick={() => api.block({ borderTop: '1.5px solid currentColor', paddingTop: '4px' })} />
                <Item label="Borde izquierdo" close={close} onClick={() => api.block({ borderLeft: '3px solid currentColor', paddingLeft: '10px' })} />
                <Item label="Todos los bordes" close={close} onClick={() => api.block({ border: '1.5px solid currentColor', padding: '6px 10px' })} />
                <Item label="Sin borde" close={close} onClick={() => api.block({ border: 'none', borderTop: '', borderBottom: '', borderLeft: '', padding: '' })} />
                <Sep />
                <Item label="Bordes y sombreado…" close={close} onClick={() => api.run('bordersDialog')} />
              </>
            )}
          </Menu>
          <Btn icon={ScanText} label="Párrafo: sangrías, tabulaciones, líneas viudas…" onClick={() => api.run('paragraphDialog')} />
        </Row>
      </Group>

      <Group label="Estilos">
        <div className="wd-style-gallery" role="listbox" aria-label="Estilos">
          {styles.map((style) => (
            <button key={style.id} type="button" role="option" aria-selected={sel.styleId === style.id} className={`wd-style-chip wd-chip-${style.id}${sel.styleId === style.id ? ' is-active' : ''}`} onMouseDown={(event) => event.preventDefault()} onClick={() => api.setTag(style.tag, style.cls || '')}>
              {style.label}
            </button>
          ))}
        </div>
        <Menu icon={Type} label="Administrar estilos" width={240}>
          {(close) => (
            <>
              <Item label="Crear estilo desde la selección…" close={close} onClick={() => api.run('createStyle')} />
              <Item label="Modificar estilo…" close={close} onClick={() => api.run('editStyle')} />
              <Item label="Administrar estilos…" close={close} onClick={() => api.run('manageStyles')} />
              <Item label="Establecer como predeterminados" close={close} onClick={() => api.run('setDefaultStyles')} />
            </>
          )}
        </Menu>
      </Group>

      <Group label="Edición">
        <Row>
          <Menu icon={Search} label="Buscar" text="Buscar" width={230}>
            {(close) => (
              <>
                <Item icon={Search} label="Buscar" hint="⌘F" close={close} onClick={() => api.run('find')} />
                <Item label="Búsqueda avanzada (frases, formato)…" close={close} onClick={() => api.run('find', { advanced: true })} />
                <Item label="Ir a…" hint="⌘G" close={close} onClick={() => api.run('goto')} />
                <Item icon={Navigation} label="Panel de navegación" close={close} onClick={() => api.openLeft('nav')} />
              </>
            )}
          </Menu>
          <Btn icon={Replace} label="Reemplazar (⌘H)" wide onClick={() => api.run('find', { replace: true })} />
        </Row>
        <Row>
          <Menu icon={MousePointer2} label="Seleccionar" text="Seleccionar" width={250}>
            {(close) => (
              <>
                <Item icon={TextSelect} label="Seleccionar todo" hint="⌘A" close={close} onClick={() => api.run('selectAll')} />
                <Item label="Seleccionar objetos" close={close} onClick={() => api.run('selectObjects')} />
                <Item label="Texto con formato similar" close={close} onClick={() => api.run('selectSimilar')} />
                <Item label="Panel de selección" close={close} onClick={() => api.run('selectionPane')} />
              </>
            )}
          </Menu>
        </Row>
      </Group>
    </>
  );
}
