import {
  AArrowDown, AArrowUp, AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowDownAZ, Baseline, Bold, Brush, CaseSensitive, ClipboardPaste,
  Copy, Eraser, Highlighter, IndentDecrease, IndentIncrease, Italic, List, ListOrdered, ListTree, MousePointer2, PaintBucket, Pilcrow,
  Redo2, Replace, Scissors, Search, SquareDashed, Strikethrough, Subscript, Superscript, Type, Underline, Undo2, WandSparkles, Navigation,
  TextSelect, ScanText, BetweenHorizontalStart,
} from 'lucide-react';
import { Btn, ColorGrid, FontField, Group, Item, Menu, Row, Select, Sep } from '../ui/controls';
export { FONTS } from '../fonts';

export const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 60, 72, 96];

export const NAMED_STYLES = [
  { id: 'normal', label: 'Normal', tag: 'P' },
  { id: 'nospacing', label: 'Sin espaciado', tag: 'P', cls: 'wd-style-nospacing' },
  { id: 'title', label: 'Título', tag: 'H1', cls: 'wd-style-title' },
  { id: 'subtitle', label: 'Subtítulo', tag: 'P', cls: 'wd-style-subtitle' },
  { id: 'h1', label: 'Título 1', tag: 'H1' },
  { id: 'h2', label: 'Título 2', tag: 'H2' },
  { id: 'h3', label: 'Título 3', tag: 'H3' },
  { id: 'h4', label: 'Título 4', tag: 'H4' },
  { id: 'h5', label: 'Título 5', tag: 'H5' },
  { id: 'h6', label: 'Título 6', tag: 'H6' },
  { id: 'quote', label: 'Cita', tag: 'BLOCKQUOTE' },
  { id: 'intense', label: 'Cita destacada', tag: 'BLOCKQUOTE', cls: 'wd-style-intense' },
  { id: 'emphasis', label: 'Énfasis', tag: 'P', cls: 'wd-style-emphasis' },
  { id: 'strong', label: 'Énfasis intenso', tag: 'P', cls: 'wd-style-strong' },
  { id: 'code', label: 'Código', tag: 'PRE', cls: 'wd-code' },
];

const Bar = () => <span className="wd-vbar" aria-hidden="true" />;
const RIBBON_STYLES = ['normal', 'nospacing', 'h1', 'h2', 'title', 'subtitle'];
const UNDERLINES = [['solid', '1px'], ['double', '3px'], ['dotted', '2px'], ['dashed', '2px'], ['wavy', '2px']];
const TEXT_LOOKS = [
  { name: 'Sombra', preview: { textShadow: '2px 2px 0 #67bfa1' }, apply: { textShadow: '2px 2px 3px rgba(15,23,42,.35)' } },
  { name: 'Contorno', preview: { WebkitTextStroke: '1px #2f6f5e', color: 'transparent' }, apply: { WebkitTextStroke: '1px currentColor', color: 'transparent' } },
  { name: 'Pistache', preview: { color: '#1f6b52', textShadow: '0 0 6px #67bfa1' }, apply: { color: '#1f6b52', textShadow: '0 0 6px #67bfa1, 0 0 12px #67bfa1' } },
  { name: 'Relieve', preview: { textShadow: '-1px -1px 0 #fff, 1px 1px 0 #94a3b8' }, apply: { textShadow: '-1px -1px 0 #fff, 1px 1px 2px rgba(0,0,0,.4)' } },
  { name: 'Reflexión', preview: { color: '#2f6f5e' }, apply: { display: 'inline-block', WebkitBoxReflect: 'below -4px linear-gradient(transparent 40%, rgba(103,191,161,.45))' } },
  { name: 'Versalitas', preview: { fontVariant: 'small-caps', letterSpacing: '0.04em' }, apply: { fontVariant: 'small-caps' } },
];
const BULLETS = [['disc', '● Círculo'], ['circle', '○ Círculo vacío'], ['square', '■ Cuadrado'], ['"✓  "', '✓ Check'], ['"➤  "', '➤ Flecha'], ['"–  "', '– Guion'], ['"★  "', '★ Estrella']];
const NUMBERS = [['decimal', '1. 2. 3.'], ['decimal-leading-zero', '01. 02. 03.'], ['lower-alpha', 'a. b. c.'], ['upper-alpha', 'A. B. C.'], ['lower-roman', 'i. ii. iii.'], ['upper-roman', 'I. II. III.']];

export default function HomeTab({ api, sel }) {
  const styles = [...NAMED_STYLES, ...api.doc.customStyles.map((style) => ({ id: style.id, label: style.name, tag: style.tag || 'P', cls: `wd-cs-${style.id}` }))];
  return (
    <>
      <Group label="Portapapeles">
        <div className="wd-clip">
          <div className="wd-paste">
            <Menu icon={ClipboardPaste} label="Pegar" text="Pegar" width={230}>
              {(close) => (
                <>
                  <Item icon={ClipboardPaste} label="Pegar" hint="⌘V" close={close} onClick={() => api.run('paste')} />
                  <Item icon={Type} label="Pegar sin formato" hint="⌘⇧V" close={close} onClick={() => api.run('pastePlain')} />
                  <Item icon={WandSparkles} label="Pegado especial…" close={close} onClick={() => api.run('pasteSpecial')} />
                </>
              )}
            </Menu>
          </div>
          <Btn icon={Scissors} label="Cortar (⌘X)" onClick={() => api.run('cut')} />
          <Btn icon={Copy} label="Copiar (⌘C)" onClick={() => api.run('copy')} />
          <Btn icon={Brush} label="Copiar formato (⌘⇧C) · doble clic para pegar varias veces" active={api.painter} onClick={() => api.run('copyFormat')} onDoubleClick={() => api.run('copyFormat', true)} />
          <Btn icon={Undo2} label="Deshacer (⌘Z)" disabled={!api.canUndo} onClick={() => api.run('undo')} />
          <Btn icon={Redo2} label="Rehacer (⌘⇧Z)" disabled={!api.canRedo} onClick={() => api.run('redo')} />
          <Btn icon={PaintBucket} label="Pegar formato (⌘⇧V con formato copiado)" onClick={() => api.run('pasteFormat')} />
        </div>
      </Group>

      <Group label="Fuente">
        <Row>
          <FontField value={sel.font || ''} onChange={(value) => value && api.inline({ fontFamily: value })} />
          <Bar />
          <Select className="is-size" label="Tamaño" width={0} value={String(sel.size || '')} options={[['', sel.size ? String(sel.size) : '—'], ...SIZES.map((size) => [String(size), String(size)])]} onChange={(value) => value && api.inline({ fontSize: `${value}px` })} />
          <Bar />
          <Btn icon={AArrowUp} label="Aumentar tamaño (⌘])" onClick={() => api.run('growFont', 1)} />
          <Btn icon={AArrowDown} label="Disminuir tamaño (⌘[)" onClick={() => api.run('growFont', -1)} />
          <Menu icon={CaseSensitive} label="Mayúsculas y minúsculas" width={250}>
            {(close) => (
              <>
                <Item close={close} onClick={() => api.caseOf('sentence')}><span className="wd-case">Tipo oración.</span></Item>
                <Item close={close} onClick={() => api.caseOf('lower')}><span className="wd-case">minúsculas</span></Item>
                <Item close={close} onClick={() => api.caseOf('upper')}><span className="wd-case is-upper">MAYÚSCULAS</span></Item>
                <Item close={close} onClick={() => api.caseOf('title')}><span className="wd-case">Poner En Mayúsculas Cada Palabra</span></Item>
                <Item close={close} onClick={() => api.caseOf('toggle')}><span className="wd-case">aLTERNAR mAYÚSCULAS</span></Item>
              </>
            )}
          </Menu>
          <Btn icon={Eraser} label="Borrar formato" onClick={() => api.run('clearFormat')} />
        </Row>
        <Row>
          <Btn icon={Bold} label="Negrita (⌘B)" active={sel.bold} onClick={() => api.cmd('bold')} />
          <Btn icon={Italic} label="Cursiva (⌘I)" active={sel.italic} onClick={() => api.cmd('italic')} />
          <Menu icon={Underline} label="Subrayado y estilos" active={sel.underline} width={210}>
            {(close) => (
              <>
                {UNDERLINES.map(([style, width]) => (
                  <Item key={style} close={close} onClick={() => api.inline({ textDecorationLine: 'underline', textDecorationStyle: style, textDecorationThickness: width === '3px' ? 'auto' : width })}>
                    <i className="wd-line-sample" style={{ borderBottomStyle: style, borderBottomWidth: width }} />
                  </Item>
                ))}
                <Item label="Ninguna" close={close} onClick={() => api.inline({ textDecorationLine: 'none' })} />
                <Sep label="Color de subrayado" />
                <ColorGrid kind="highlight" onPick={(color) => api.inline({ textDecorationLine: 'underline', textDecorationColor: color || 'currentColor' })} close={close} />
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
          <span className="wd-extra"><Bar /></span>
          <Btn className="wd-extra" icon={Subscript} label="Subíndice (⌘,)" active={sel.sub} onClick={() => api.cmd('subscript')} />
          <Btn className="wd-extra" icon={Superscript} label="Superíndice (⌘.)" active={sel.sup} onClick={() => api.cmd('superscript')} />
          <Bar />
          <Menu icon={Baseline} label="Color de fuente" width={248}>{(close) => <ColorGrid value={sel.color} recent={api.recentColors} onPick={(color) => api.inline({ color })} close={close} />}</Menu>
          <Menu icon={Highlighter} label="Color de resaltado" width={196}>{(close) => <ColorGrid kind="highlight" allowNone noneLabel="Sin color" onPick={(color) => api.inline({ backgroundColor: color || 'transparent' })} close={close} />}</Menu>
          <Menu icon={WandSparkles} label="Efectos de texto" width={230}>
            {(close) => (
              <>
                <div className="wd-effect-grid">
                  {TEXT_LOOKS.map((look) => (
                    <button key={look.name} type="button" title={look.name} style={look.preview} onClick={() => { api.inline(look.apply); close(); }}>A</button>
                  ))}
                </div>
                <Item label="Quitar efectos" close={close} onClick={() => api.inline({ textShadow: 'none', WebkitTextStroke: '0', WebkitBoxReflect: 'none', fontVariant: 'normal', color: '' })} />
                <Sep />
                <Item label="Fuente avanzada…" hint="⌘D" close={close} onClick={() => api.run('fontDialog')} />
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
          <Bar />
          <Btn icon={IndentDecrease} label="Disminuir sangría" onClick={() => api.run('indent', -1)} />
          <Btn icon={IndentIncrease} label="Aumentar sangría" onClick={() => api.run('indent', 1)} />
          <span className="wd-extra"><Menu icon={ArrowDownAZ} label="Ordenar" width={200}>
            {(close) => (
              <>
                <Item label="A → Z" close={close} onClick={() => api.run('sort', 'asc')} />
                <Item label="Z → A" close={close} onClick={() => api.run('sort', 'desc')} />
                <Item label="Numérico ascendente" close={close} onClick={() => api.run('sort', 'asc', true)} />
                <Item label="Numérico descendente" close={close} onClick={() => api.run('sort', 'desc', true)} />
              </>
            )}
          </Menu></span>
          <Btn className="wd-extra" icon={Pilcrow} label="Mostrar marcas de formato (⌘*)" active={api.view.marks} onClick={() => api.setView({ marks: !api.view.marks })} />
        </Row>
        <Row>
          <Btn icon={AlignLeft} label="Alinear a la izquierda (⌘L)" active={sel.align === 'left' || sel.align === 'start'} onClick={() => api.cmd('justifyLeft')} />
          <Btn icon={AlignCenter} label="Centrar (⌘E)" active={sel.align === 'center'} onClick={() => api.cmd('justifyCenter')} />
          <Btn icon={AlignRight} label="Alinear a la derecha (⌘R)" active={sel.align === 'right' || sel.align === 'end'} onClick={() => api.cmd('justifyRight')} />
          <Btn icon={AlignJustify} label="Justificar (⌘J)" active={sel.align === 'justify'} onClick={() => api.cmd('justifyFull')} />
          <Bar />
          <Menu icon={BetweenHorizontalStart} label="Interlineado y espaciado" width={240}>
            {(close) => (
              <>
                {[['1', '1.0'], ['1.15', '1.15'], ['1.5', '1.5'], ['2', '2.0'], ['2.5', '2.5'], ['3', '3.0']].map(([value, label]) => <Item key={value} label={label} active={String(sel.line) === value} close={close} onClick={() => api.block({ lineHeight: value })} />)}
                <Item label="Opciones de interlineado…" close={close} onClick={() => api.run('paragraphDialog')} />
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

      <Group label="Estilos" grow>
        <div className="wd-style-row">
          <div className="wd-style-gallery" role="listbox" aria-label="Estilos">
            {RIBBON_STYLES.map((id) => styles.find((style) => style.id === id)).filter(Boolean).map((style) => (
              <button key={style.id} type="button" role="option" aria-selected={sel.styleId === style.id} className={`wd-style-chip wd-chip-${style.id}${sel.styleId === style.id ? ' is-active' : ''}`} onMouseDown={(event) => event.preventDefault()} onClick={() => api.setTag(style.tag, style.cls || '')}>
                {style.label}
              </button>
            ))}
          </div>
          <Menu icon={Type} label="Estilos" width={280}>
            {(close) => (
              <>
                <div className="wd-style-menu">
                  {styles.map((style) => (
                    <button key={style.id} type="button" className={`wd-style-tile wd-chip-${style.id}${sel.styleId === style.id ? ' is-active' : ''}`} onClick={() => { api.setTag(style.tag, style.cls || ''); close(); }}>
                      {style.label}
                    </button>
                  ))}
                </div>
                <Sep />
                <Item label="Crear un estilo…" close={close} onClick={() => api.run('createStyle')} />
                <Item label="Borrar formato" close={close} onClick={() => api.run('clearFormat')} />
                <Item label="Administrar estilos…" close={close} onClick={() => api.run('manageStyles')} />
              </>
            )}
          </Menu>
        </div>
      </Group>

      <Group label="Edición">
        <div className="wd-edit">
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
          <Btn icon={Replace} label="Reemplazar (⌘H)" wide onClick={() => api.run('find', { replace: true })}>Reemplazar</Btn>
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
        </div>
      </Group>
    </>
  );
}
