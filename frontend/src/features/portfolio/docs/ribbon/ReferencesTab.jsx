import { BookMarked, BookOpenText, ChevronLeft, ChevronRight, FileSignature, Hash, Image as ImageIcon, Library, ListTree, Quote, RefreshCw, Scale, SquareAsterisk, Table2, Tags } from 'lucide-react';
import { Btn, Group, Item, Menu, Row, Select, Sep } from '../ui/controls';
import { CITATION_STYLES } from '../references';

export default function ReferencesTab({ api }) {
  const { doc } = api;
  return (
    <>
      <Group label="Tabla de contenido">
        <Row>
          <Menu icon={ListTree} label="Tabla de contenido" text="Índice" width={250}>
            {(close) => (
              <>
                <Item label="Automática (niveles 1-3)" close={close} onClick={() => api.run('toc', { levels: 3 })} />
                <Item label="Automática (niveles 1-2)" close={close} onClick={() => api.run('toc', { levels: 2 })} />
                <Item label="Automática con números de página" close={close} onClick={() => api.run('toc', { levels: 3, pages: true })} />
                <Item label="Manual (editable)" close={close} onClick={() => api.run('toc', { levels: 3, manual: true })} />
                <Sep />
                <Item label="Personalizar índice…" close={close} onClick={() => api.run('tocDialog')} />
                <Item label="Quitar índice" close={close} onClick={() => api.run('removeToc')} />
              </>
            )}
          </Menu>
        </Row>
        <Row>
          <Btn icon={RefreshCw} label="Actualizar índice" onClick={() => api.run('updateToc')} />
          <Btn icon={BookOpenText} label="Navegar a secciones" onClick={() => api.openLeft('nav')} />
        </Row>
      </Group>
      <Group label="Notas">
        <Row>
          <Btn icon={SquareAsterisk} label="Insertar nota al pie (⌘⌥F)" wide onClick={() => api.run('note', 'foot')} />
          <Btn icon={BookMarked} label="Insertar nota al final" onClick={() => api.run('note', 'end')} />
        </Row>
        <Row>
          <Btn icon={ChevronLeft} label="Nota anterior" onClick={() => api.run('navNote', -1)} />
          <Btn icon={ChevronRight} label="Nota siguiente" onClick={() => api.run('navNote', 1)} />
          <Menu icon={Hash} label="Opciones de notas" width={240}>
            {(close) => (
              <>
                <Item label="Formato de numeración…" close={close} onClick={() => api.run('noteSettings')} />
                <Item label="Convertir todas: al pie → al final" close={close} onClick={() => api.run('convertNotes', 'end')} />
                <Item label="Convertir todas: al final → al pie" close={close} onClick={() => api.run('convertNotes', 'foot')} />
                <Item label="Editar la nota actual" close={close} onClick={() => api.run('editNote')} />
                <Item label="Eliminar la nota actual" close={close} onClick={() => api.run('deleteNote')} />
              </>
            )}
          </Menu>
        </Row>
      </Group>
      <Group label="Citas y bibliografía">
        <Row>
          <Btn icon={Quote} label="Insertar cita" wide onClick={() => api.run('citation')} />
          <Select label="Estilo de cita" width={96} value={doc.citationStyle} options={Object.entries(CITATION_STYLES).map(([id, style]) => [id, style.label])} onChange={(value) => api.run('citationStyle', value)} />
        </Row>
        <Row>
          <Btn icon={Library} label="Administrar fuentes" onClick={() => api.run('manageSources')} />
          <Menu icon={BookOpenText} label="Bibliografía" width={220}>
            {(close) => (
              <>
                <Item label="Bibliografía" close={close} onClick={() => api.run('bibliography', 'Bibliografía')} />
                <Item label="Referencias" close={close} onClick={() => api.run('bibliography', 'Referencias')} />
                <Item label="Obras citadas" close={close} onClick={() => api.run('bibliography', 'Obras citadas')} />
                <Sep />
                <Item label="Actualizar bibliografía" close={close} onClick={() => api.run('updateBibliography')} />
              </>
            )}
          </Menu>
        </Row>
      </Group>
      <Group label="Títulos">
        <Row>
          <Menu icon={ImageIcon} label="Insertar título" text="Título" width={220}>
            {(close) => (
              <>
                <Item label="Figura" close={close} onClick={() => api.run('caption', 'Figura')} />
                <Item label="Tabla" close={close} onClick={() => api.run('caption', 'Tabla')} />
                <Item label="Ecuación" close={close} onClick={() => api.run('caption', 'Ecuación')} />
              </>
            )}
          </Menu>
          <Btn icon={Table2} label="Insertar tabla de ilustraciones" onClick={() => api.run('tableOfFigures')} />
        </Row>
        <Row>
          <Btn icon={RefreshCw} label="Actualizar numeración de figuras y tablas" onClick={() => api.run('updateCaptions')} />
          <Btn icon={Hash} label="Referencia cruzada" onClick={() => api.run('crossRef')} />
        </Row>
      </Group>
      <Group label="Índice">
        <Row>
          <Btn icon={Tags} label="Marcar entrada" wide onClick={() => api.run('markEntry')} />
          <Btn icon={BookOpenText} label="Insertar índice alfabético" onClick={() => api.run('index')} />
        </Row>
        <Row>
          <Btn icon={RefreshCw} label="Actualizar índice alfabético" onClick={() => api.run('updateIndex')} />
          <Btn icon={FileSignature} label="Marcar cita para tabla de autoridades" onClick={() => api.run('markAuthority')} />
          <Btn icon={Scale} label="Insertar tabla de autoridades" onClick={() => api.run('authorities')} />
        </Row>
      </Group>
    </>
  );
}
