import { useEffect, useState } from 'react';
import {
  Bookmark, BookOpen, Calendar, Clapperboard, FilePlus2, FileType2,
  FileUp, Film, Globe, Hash, Image as ImageIcon, ImagePlus, Images, Link2, Music, Omega, PanelBottom, PanelTop,
  Paperclip, PenLine, Shapes, Sigma, Smile, SquareSplitVertical, Star, Table2, TextCursorInput,
  Youtube, BetweenHorizontalStart, CaseUpper, Layers, Puzzle,
} from 'lucide-react';
import { Btn, GridPicker, Group, Item, Menu, ScrollPane, Sep } from '../ui/controls';
import { SHAPES, SHAPE_GROUPS, shapePreviewSvg } from '../render/shapes';
import { COVERS, EMOJIS, SPECIAL_CHARS, SYMBOLS } from '../render/blocks';
import { ILLUSTRATIONS } from '../render/iconLibrary';
import { renderTex } from '../render/rich';

const EQUATION_SNIPPETS = [
  ['Fracción', '\\frac{a}{b}'],
  ['Raíz', '\\sqrt{x}'],
  ['Potencia', 'x^{n}'],
  ['Subíndice', 'x_{i}'],
  ['Suma', '\\sum_{i=1}^{n} x_i'],
  ['Integral', '\\int_{a}^{b} f(x)\\,dx'],
  ['Límite', '\\lim_{x \\to \\infty}'],
  ['Matriz', '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}'],
  ['Griega', '\\alpha \\beta \\gamma \\pi'],
  ['Cuadrática', 'x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}'],
];

function EquationPanel({ initial, inline, onCancel, onInsert }) {
  const [tex, setTex] = useState(initial || 'E = mc^2');
  const [isInline, setInline] = useState(Boolean(inline));
  const [preview, setPreview] = useState('');
  useEffect(() => {
    let alive = true;
    renderTex(tex, !isInline).then((html) => { if (alive) setPreview(html); }).catch(() => { if (alive) setPreview(''); });
    return () => { alive = false; };
  }, [tex, isInline]);
  return (
    <div className="wd-eq-panel">
      <strong>Ecuación (LaTeX)</strong>
      <div className="wd-chip-row">
        {EQUATION_SNIPPETS.map(([label, code]) => (
          <button key={label} type="button" className="wd-chip" onClick={() => setTex((value) => `${value} ${code}`.trim())}>{label}</button>
        ))}
      </div>
      <textarea className="wd-input wd-mono" rows={2} value={tex} aria-label="LaTeX" onChange={(event) => setTex(event.target.value)} />
      <label className="wd-field-inline">
        <input type="checkbox" checked={isInline} onChange={(event) => setInline(event.target.checked)} />
        En línea con el texto
      </label>
      <div className="wd-eq-preview" dangerouslySetInnerHTML={{ __html: preview }} />
      <div className="wd-eq-actions">
        <button type="button" className="ps-quiet" onClick={onCancel}>Cancelar</button>
        <button type="button" className="wd-primary" onClick={() => onInsert(tex, isInline)}>Insertar</button>
      </div>
    </div>
  );
}

function useSymbolCat() {
  const [cat, setCat] = useState('signos');
  return { cat, setCat };
}

const dateChoices = () => {
  const now = new Date();
  return [
    ['long', new Intl.DateTimeFormat('es', { dateStyle: 'long' }).format(now)],
    ['full', new Intl.DateTimeFormat('es', { dateStyle: 'full' }).format(now)],
    ['medium', new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(now)],
    ['short', new Intl.DateTimeFormat('es', { dateStyle: 'short' }).format(now)],
    ['time', new Intl.DateTimeFormat('es', { timeStyle: 'short' }).format(now)],
    ['datetime', new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(now)],
  ];
};

function Tool({ children, grow = 1 }) {
  return <div className="wd-gallery" style={{ flexGrow: grow }}>{children}</div>;
}

export default function InsertTab({ api }) {
  const customCovers = api.storage.get('covers', []);
  const symbols = useSymbolCat();
  const glyphs = symbols.cat === 'emojis' ? EMOJIS : SYMBOLS;
  const drawing = api.pen?.tool === 'table';
  const [equation, setEquation] = useState(null);
  useEffect(() => {
    if (!api.equationRequest) return undefined;
    setEquation(api.equationRequest);
    api.consumeEquation();
    return undefined;
  }, [api.equationRequest, api]);
  return (
    <>
      <Group label="Páginas" weight={27}>
        <div className="wd-tools">
          <Tool grow={7}>
            <Menu icon={BookOpen} label="Portada" text="Portada" width={240}>
              {(close) => (
                <>
                  {COVERS.map((cover) => <Item key={cover.id} label={cover.label} close={close} onClick={() => api.run('cover', cover.id)} />)}
                  {customCovers.map((cover) => <Item key={cover.id} label={cover.name} close={close} onClick={() => api.run('cover', cover.id, cover.html)} />)}
                  <Sep />
                  <Item label="Guardar primera página como portada…" close={close} onClick={() => api.run('saveCover')} />
                  <Item label="Quitar portada" close={close} onClick={() => api.run('removeCover')} />
                </>
              )}
            </Menu>
          </Tool>
          <Tool grow={10}>
            <Btn icon={FilePlus2} label="Página en blanco" wide onClick={() => api.run('blankPage')}>Página en blanco</Btn>
          </Tool>
          <Tool grow={10}>
            <Btn icon={SquareSplitVertical} label="Salto de página" wide title="Salto de página (⌘Enter)" onClick={() => api.run('pageBreak')}>Salto de página</Btn>
          </Tool>
        </div>
      </Group>

      <Group label="Tablas" weight={7}>
        <div className="wd-tools">
          <Tool grow={7}>
            <Menu icon={Table2} label="Tabla" text="Tabla" width={352} limit={560} bare menuClass="is-table-menu" active={drawing}>
              {(close) => (
                <div className="wd-table-sheet">
                  <GridPicker close={close} onPick={(rows, cols) => api.run('table', rows, cols)} />
                  <div className="wd-table-actions" data-hide-scrollbar>
                    <Item icon={Table2} label="Insertar tabla…" close={close} onClick={() => api.run('tableDialog')} />
                    <Item icon={PenLine} label={drawing ? 'Dejar de dibujar' : 'Dibujar tabla'} close={close} onClick={() => api.run('drawTable')} />
                    <Item icon={BetweenHorizontalStart} label="Convertir texto en tabla…" close={close} onClick={() => api.run('textToTable')} />
                    <Item icon={Calendar} label="Tabla rápida: calendario" close={close} onClick={() => api.run('calendarTable')} />
                  </div>
                </div>
              )}
            </Menu>
          </Tool>
        </div>
      </Group>

      <Group label="Ilustraciones" weight={22}>
        <div className="wd-tools">
          <Tool grow={8}>
            <Menu icon={ImageIcon} label="Imágenes" text="Imágenes" width={240}>
              {(close) => (
                <>
                  <Item icon={ImagePlus} label="Este dispositivo…" close={close} onClick={() => api.run('imageDevice')} />
                  <Item icon={Globe} label="Desde URL…" close={close} onClick={() => api.run('imageUrl')} />
                  <Item icon={Images} label="Biblioteca libre (Wikimedia)…" close={close} onClick={() => api.run('imageLibrary')} />
                  <Sep label="También puedes arrastrar o pegar imágenes" />
                </>
              )}
            </Menu>
          </Tool>
          <Tool grow={7}>
            <Menu icon={Shapes} label="Formas" text="Formas" width={320}>
              {(close) => (
                <div className="wd-shape-menu">
                  {SHAPE_GROUPS.map((group) => (
                    <div key={group}>
                      <div className="wd-sep-label">{group}</div>
                      <div className="wd-shape-grid">
                        {Object.entries(SHAPES).filter(([, shape]) => shape.group === group).map(([type, shape]) => (
                          <button key={type} type="button" title={shape.label} aria-label={shape.label} onClick={() => { api.run('shape', type); close(); }} dangerouslySetInnerHTML={{ __html: shapePreviewSvg(type) }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Menu>
          </Tool>
          <Tool grow={7}>
            <Menu icon={Smile} label="Iconos" text="Iconos" width={230}>
              {(close) => (
                <>
                  <Item icon={Star} label="Buscar iconos…" close={close} onClick={() => api.run('icons')} />
                  <Item icon={FileUp} label="Insertar SVG…" close={close} onClick={() => api.run('svgFile')} />
                  <Sep label="Ilustraciones" />
                  {Object.entries(ILLUSTRATIONS).map(([key, item]) => <Item key={key} label={item.label} close={close} onClick={() => api.run('illustration', key)} />)}
                </>
              )}
            </Menu>
          </Tool>
        </div>
      </Group>

      <Group label="Vínculos" weight={25}>
        <div className="wd-tools">
          <Tool grow={7}><Btn icon={Link2} label="Vínculo" wide title="Vínculo (⌘K)" onClick={() => api.run('link')}>Vínculo</Btn></Tool>
          <Tool grow={8}><Btn icon={Bookmark} label="Marcador" wide onClick={() => api.run('bookmark')}>Marcador</Btn></Tool>
          <Tool grow={10}><Btn icon={Hash} label="Referencia cruzada" wide onClick={() => api.run('crossRef')}>Referencia cruzada</Btn></Tool>
        </div>
      </Group>

      <Group label="Encabezado y pie de página" weight={30}>
        <div className="wd-tools">
          <Tool grow={10}>
            <Menu icon={PanelTop} label="Encabezado" text="Encabezado" width={240}>
              {(close) => (
                <>
                  <Item icon={PanelTop} label="Editar encabezado" close={close} onClick={() => api.run('editHeader')} />
                  <Sep label="Campos" />
                  <Item label="Fecha" close={close} onClick={() => api.run('field', 'date')} />
                  <Item label="Hora" close={close} onClick={() => api.run('field', 'time')} />
                  <Item label="Nombre del documento" close={close} onClick={() => api.run('field', 'title')} />
                  <Item label="Autor" close={close} onClick={() => api.run('field', 'author')} />
                  <Item label="Página" close={close} onClick={() => api.run('field', 'page')} />
                  <Item label="Total de páginas" close={close} onClick={() => api.run('field', 'pages')} />
                  <Sep />
                  <Item label="Opciones de encabezado y pie…" close={close} onClick={() => api.run('headerOptions')} />
                </>
              )}
            </Menu>
          </Tool>
          <Tool grow={10}><Btn icon={PanelBottom} label="Pie de página" wide onClick={() => api.run('editFooter')}>Pie de página</Btn></Tool>
          <Tool grow={10}><Btn icon={Hash} label="Número de página" wide onClick={() => api.run('pageNumbers')}>Número de página</Btn></Tool>
        </div>
      </Group>

      <Group label="Texto" weight={49}>
        <div className="wd-tools">
          <Tool grow={10}><Btn icon={TextCursorInput} label="Cuadro de texto" wide onClick={() => api.run('textbox')}>Cuadro de texto</Btn></Tool>
          <Tool grow={9}>
            <Menu icon={Puzzle} label="Elementos rápidos" text="Elementos rápidos" width={260}>
              {(close) => (
                <>
                  <Item label="Campos automáticos…" close={close} onClick={() => api.run('fields')} />
                  <Item label="Texto reutilizable…" close={close} onClick={() => api.run('quickParts')} />
                  <Item label="Guardar selección como texto reutilizable…" close={close} onClick={() => api.run('saveQuickPart')} />
                  <Item label="Propiedad del documento…" close={close} onClick={() => api.run('propertyField')} />
                </>
              )}
            </Menu>
          </Tool>
          <Tool grow={7}>
            <Menu icon={CaseUpper} label="Letra capital" text="Letra capital" width={280} bare menuClass="is-dropcap-menu">
              {(close) => (
                <div className="wd-dropcap-panel">
                  <strong>Letra capital</strong>
                  <div className="wd-dropcap-choices">
                    {[['none', 'Ninguno'], ['dropped', 'En texto'], ['margin', 'En margen']].map(([mode, label]) => (
                      <button key={mode} type="button" className={`wd-dropcap-card is-${mode}`} onClick={() => { api.run('dropCap', mode); close(); }}>
                        <span aria-hidden="true"><b>A</b><i /><i /><i /></span>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Menu>
          </Tool>
          <Tool grow={8}><Btn icon={PenLine} label="Línea de firma" wide onClick={() => api.run('signature')}>Línea de firma</Btn></Tool>
          <Tool grow={8}>
            <Menu icon={Calendar} label="Fecha y hora" text="Fecha y hora" width={260}>
              {(close) => dateChoices().map(([id, label]) => <Item key={id} label={label} close={close} onClick={() => api.run('dateTime', id)} />)}
            </Menu>
          </Tool>
          <Tool grow={7}><Btn icon={Layers} label="Objeto" wide onClick={() => api.run('embedObject')}>Objeto</Btn></Tool>
        </div>
      </Group>

      <Group label="Símbolos" weight={15}>
        <div className="wd-tools">
          <Tool grow={8}>
            <Menu
              icon={Sigma}
              label="Ecuación"
              text="Ecuación"
              width={348}
              limit={420}
              bare
              menuClass="is-eq-menu"
              opened={Boolean(equation)}
              onOpenChange={(next) => { if (!next) setEquation(null); else setEquation((current) => current || { tex: 'E = mc^2', inline: false, el: null, key: Date.now() }); }}
            >
              {(close) => equation && (
                <EquationPanel
                  key={equation.key}
                  initial={equation.tex}
                  inline={equation.inline}
                  onCancel={close}
                  onInsert={(tex, inline) => { api.run('applyEquation', tex, inline, equation.el); close(); }}
                />
              )}
            </Menu>
          </Tool>
          <Tool grow={7}>
            <Menu icon={Omega} label="Símbolo" text="Símbolo" width={336} limit={420} bare menuClass="is-symbol-menu">
              {(close) => (
                <div className="wd-symbol-sheet">
                  <div className="wd-symbol-tabs" role="tablist" aria-label="Categorías de símbolos">
                    {[['signos', 'Símbolos'], ['especiales', 'Especiales'], ['emojis', 'Emojis']].map(([id, label]) => (
                      <button key={id} type="button" role="tab" aria-selected={symbols.cat === id} className={symbols.cat === id ? 'is-on' : ''} onClick={() => symbols.setCat(id)}>{label}</button>
                    ))}
                  </div>
                  {symbols.cat === 'especiales' ? (
                    <ScrollPane maxHeight={248}>
                      {SPECIAL_CHARS.map(([char, label]) => <Item key={label} label={label} close={close} onClick={() => api.insert(char)} />)}
                    </ScrollPane>
                  ) : (
                    <ScrollPane maxHeight={248}>
                      <div className={`wd-symbols${symbols.cat === 'emojis' ? ' is-emoji' : ''}`}>
                        {glyphs.map((symbol) => <button key={symbol} type="button" onClick={() => { api.insert(symbol); close(); }}>{symbol}</button>)}
                      </div>
                    </ScrollPane>
                  )}
                </div>
              )}
            </Menu>
          </Tool>
        </div>
      </Group>

      <Group label="Multimedia" weight={6}>
        <div className="wd-tools">
          <Tool grow={6}>
            <Menu icon={Clapperboard} label="Multimedia" text="Video" width={250}>
              {(close) => (
                <>
                  <Item icon={Youtube} label="Video de YouTube o Vimeo…" close={close} onClick={() => api.run('youtube')} />
                  <Item icon={Film} label="Archivo de video…" close={close} onClick={() => api.run('videoFile')} />
                  <Item icon={Music} label="Audio…" close={close} onClick={() => api.run('audioFile')} />
                  <Item icon={Clapperboard} label="GIF animado…" close={close} onClick={() => api.run('gif')} />
                  <Item icon={Paperclip} label="Archivo adjunto…" close={close} onClick={() => api.run('attachment')} />
                  <Item icon={FileType2} label="Vista previa de PDF…" close={close} onClick={() => api.run('pdfPreview')} />
                </>
              )}
            </Menu>
          </Tool>
        </div>
      </Group>
    </>
  );
}
