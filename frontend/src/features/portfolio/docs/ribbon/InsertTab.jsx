import {
  AtSign, BarChart3, Bookmark, BookOpen, Calendar, CalendarClock, CaseUpper, ChartNoAxesCombined, Clapperboard, FilePlus2, FileText, FileType2,
  FileUp, Film, Globe, Hash, Image as ImageIcon, ImagePlus, Images, Link2, ListChecks, Music, Network, PanelBottom, PanelTop, Paperclip,
  PenLine, Pentagon, Puzzle, Shapes, Sigma, Smile, Sparkles, SquareSplitVertical, Star, Table2, TextCursorInput, Type, Youtube, BookCopy,
  Layers, Gauge, Users, FileBarChart, ListPlus, Bug,
} from 'lucide-react';
import { Btn, GridPicker, Group, Item, Menu, Row, Sep } from '../ui/controls';
import { SHAPES, SHAPE_GROUPS, shapePreviewSvg } from '../render/shapes';
import { CHART_TYPES } from '../render/charts';
import { DIAGRAM_TYPES } from '../render/diagrams';
import { COVERS, EMOJIS, SPECIAL_CHARS, SYMBOLS } from '../render/blocks';
import { LIVE_BLOCKS } from '../sprintops';
import { ILLUSTRATIONS } from '../render/iconLibrary';

export default function InsertTab({ api }) {
  const customCovers = api.storage.get('covers', []);
  return (
    <>
      <Group label="Páginas">
        <Row>
          <Menu icon={BookOpen} label="Portada" text="Portada" width={240}>
            {(close) => (
              <>
                <Sep label="Prediseñadas" />
                {COVERS.map((cover) => <Item key={cover.id} label={cover.label} close={close} onClick={() => api.run('cover', cover.id)} />)}
                {customCovers.length > 0 && <Sep label="Personalizadas" />}
                {customCovers.map((cover) => <Item key={cover.id} label={cover.name} close={close} onClick={() => api.run('cover', cover.id, cover.html)} />)}
                <Sep />
                <Item label="Guardar primera página como portada…" close={close} onClick={() => api.run('saveCover')} />
                <Item label="Quitar portada" close={close} onClick={() => api.run('removeCover')} />
              </>
            )}
          </Menu>
        </Row>
        <Row>
          <Btn icon={FilePlus2} label="Página en blanco" onClick={() => api.run('blankPage')} />
          <Btn icon={SquareSplitVertical} label="Salto de página (⌘Enter)" onClick={() => api.run('pageBreak')} />
        </Row>
      </Group>

      <Group label="Tablas">
        <Menu icon={Table2} label="Tabla" text="Tabla" width={250}>
          {(close) => (
            <>
              <GridPicker close={close} onPick={(rows, cols) => api.run('table', rows, cols)} />
              <Sep />
              <Item label="Insertar tabla…" close={close} onClick={() => api.run('tableDialog')} />
              <Item label="Dibujar tabla…" close={close} onClick={() => api.run('drawTable')} />
              <Item label="Convertir texto en tabla…" close={close} onClick={() => api.run('textToTable')} />
              <Item label="Tabla rápida: calendario" close={close} onClick={() => api.run('calendarTable')} />
            </>
          )}
        </Menu>
      </Group>

      <Group label="Ilustraciones">
        <Row>
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
        </Row>
        <Row>
          <Menu icon={BarChart3} label="Gráfico" text="Gráfico" width={210}>
            {(close) => Object.entries(CHART_TYPES).map(([type, label]) => <Item key={type} icon={ChartNoAxesCombined} label={label} close={close} onClick={() => api.run('chart', type)} />)}
          </Menu>
          <Menu icon={Network} label="Diagrama" text="SmartArt" width={210}>
            {(close) => Object.entries(DIAGRAM_TYPES).map(([type, label]) => <Item key={type} icon={Network} label={label} close={close} onClick={() => api.run('diagram', type)} />)}
          </Menu>
        </Row>
      </Group>

      <Group label="Vínculos">
        <Row>
          <Btn icon={Link2} label="Vínculo (⌘K)" wide onClick={() => api.run('link')} />
        </Row>
        <Row>
          <Btn icon={Bookmark} label="Marcador" onClick={() => api.run('bookmark')} />
          <Btn icon={Hash} label="Referencia cruzada" onClick={() => api.run('crossRef')} />
        </Row>
      </Group>

      <Group label="Encabezado y pie">
        <Row>
          <Btn icon={PanelTop} label="Encabezado" onClick={() => api.run('editHeader')} />
          <Btn icon={PanelBottom} label="Pie de página" onClick={() => api.run('editFooter')} />
          <Btn icon={Hash} label="Número de página…" onClick={() => api.run('pageNumbers')} />
        </Row>
        <Row>
          <Menu icon={CalendarClock} label="Campos de encabezado" width={240}>
            {(close) => (
              <>
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
        </Row>
      </Group>

      <Group label="Texto">
        <Row>
          <Btn icon={TextCursorInput} label="Cuadro de texto" onClick={() => api.run('textbox')} />
          <Btn icon={Type} label="WordArt" onClick={() => api.run('wordart')} />
          <Btn icon={CaseUpper} label="Letra capital" onClick={() => api.run('dropCap')} />
          <Btn icon={PenLine} label="Línea de firma" onClick={() => api.run('signature')} />
          <Btn icon={Calendar} label="Fecha y hora…" onClick={() => api.run('dateTime')} />
        </Row>
        <Row>
          <Menu icon={Puzzle} label="Elementos rápidos" width={250}>
            {(close) => (
              <>
                <Item label="Campos automáticos…" close={close} onClick={() => api.run('fields')} />
                <Item label="Texto reutilizable…" close={close} onClick={() => api.run('quickParts')} />
                <Item label="Guardar selección como texto reutilizable…" close={close} onClick={() => api.run('saveQuickPart')} />
                <Item label="Propiedad del documento…" close={close} onClick={() => api.run('propertyField')} />
              </>
            )}
          </Menu>
          <Btn icon={Layers} label="Objeto incrustado (archivo)" onClick={() => api.run('embedObject')} />
          <Btn icon={Sigma} label="Ecuación" onClick={() => api.run('equation')} />
          <Menu icon={Pentagon} label="Símbolos" width={300}>
            {(close) => (
              <>
                <div className="wd-symbols">{SYMBOLS.map((symbol) => <button key={symbol} type="button" onClick={() => { api.insert(symbol); close(); }}>{symbol}</button>)}</div>
                <Sep label="Caracteres especiales" />
                {SPECIAL_CHARS.map(([char, label]) => <Item key={label} label={label} close={close} onClick={() => api.insert(char)} />)}
              </>
            )}
          </Menu>
          <Menu icon={Smile} label="Emojis" width={300}>
            {(close) => <div className="wd-symbols is-emoji">{EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => { api.insert(emoji); close(); }}>{emoji}</button>)}</div>}
          </Menu>
        </Row>
      </Group>

      <Group label="Multimedia">
        <Row>
          <Btn icon={Youtube} label="Video de YouTube o Vimeo…" onClick={() => api.run('youtube')} />
          <Btn icon={Film} label="Archivo de video…" onClick={() => api.run('videoFile')} />
          <Btn icon={Music} label="Audio…" onClick={() => api.run('audioFile')} />
        </Row>
        <Row>
          <Btn icon={Clapperboard} label="GIF animado…" onClick={() => api.run('gif')} />
          <Btn icon={Paperclip} label="Archivo adjunto…" onClick={() => api.run('attachment')} />
          <Btn icon={FileType2} label="Vista previa de PDF…" onClick={() => api.run('pdfPreview')} />
        </Row>
      </Group>

      <Group label="SprintOps">
        <Row>
          <Btn icon={Bug} label="Referenciar issue (@)" onClick={() => api.run('mention', 'issue')} />
          <Btn icon={AtSign} label="Mencionar usuario" onClick={() => api.run('mention', 'user')} />
          <Btn icon={Gauge} label="Referenciar sprint" onClick={() => api.run('mention', 'sprint')} />
          <Menu icon={ListChecks} label="Elementos del proyecto" width={240}>
            {(close) => (
              <>
                {Object.entries(LIVE_BLOCKS).map(([kind, label]) => <Item key={kind} label={label} close={close} onClick={() => api.run('live', kind)} />)}
                <Sep />
                <Item icon={FileBarChart} label="Generar reporte del proyecto" close={close} onClick={() => api.run('projectReport')} />
              </>
            )}
          </Menu>
        </Row>
        <Row>
          <Btn icon={ListPlus} label="Convertir selección en issue" onClick={() => api.run('textToIssue')} />
          <Btn icon={Sparkles} label="Crear issues desde el documento (IA)" onClick={() => api.run('aiExtract', 'issues')} />
          <Btn icon={Users} label="Vincular documento a sprints, issues, usuarios o reuniones" onClick={() => api.run('linkItems')} />
          <Btn icon={BookCopy} label="Actualizar referencias" onClick={() => api.run('refreshRefs')} />
          <Btn icon={FileText} label="Ir al elemento vinculado" onClick={() => api.openLeft('linked')} />
        </Row>
      </Group>
    </>
  );
}
