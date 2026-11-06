import {
  BookOpen, Columns2, Copy, ExternalLink, Expand, FileText, Focus, Globe, Grid3x3, LayoutGrid, ListTree, Maximize2, MoveHorizontal, NotebookPen,
  PanelLeft, Pilcrow, Ruler, ScanLine, Search, SplitSquareVertical, SquareDashed, ZoomIn, ZoomOut, ArrowLeftRight, Images, Hash,
} from 'lucide-react';
import { Btn, Group, Item, Menu, Row } from '../ui/controls';

export const VIEW_MODES = {
  print: { label: 'Diseño de impresión', icon: FileText },
  read: { label: 'Modo lectura', icon: BookOpen },
  web: { label: 'Diseño web', icon: Globe },
  outline: { label: 'Esquema', icon: ListTree },
  draft: { label: 'Borrador', icon: NotebookPen },
  focus: { label: 'Modo enfoque', icon: Focus },
};

export default function ViewTab({ api }) {
  const { view, setView } = api;
  return (
    <>
      <Group label="Vistas">
        <Row>
          {Object.entries(VIEW_MODES).slice(0, 3).map(([mode, meta]) => <Btn key={mode} icon={meta.icon} label={meta.label} active={view.mode === mode} wide onClick={() => setView({ mode })} />)}
        </Row>
        <Row>
          {Object.entries(VIEW_MODES).slice(3).map(([mode, meta]) => <Btn key={mode} icon={meta.icon} label={meta.label} active={view.mode === mode} wide onClick={() => setView({ mode })} />)}
          <Btn icon={Expand} label="Pantalla completa (F11)" onClick={() => api.run('fullscreen')} />
        </Row>
      </Group>
      <Group label="Mostrar">
        <Row>
          <Btn icon={Ruler} label="Regla horizontal" active={view.rulers} onClick={() => setView({ rulers: !view.rulers })} />
          <Btn icon={ScanLine} label="Regla vertical" active={view.vruler} onClick={() => setView({ vruler: !view.vruler })} />
          <Btn icon={Grid3x3} label="Cuadrícula" active={view.grid} onClick={() => setView({ grid: !view.grid })} />
        </Row>
        <Row>
          <Btn icon={PanelLeft} label="Panel de navegación" active={api.leftOpen} onClick={() => (api.leftOpen ? api.closeLeft() : api.openLeft('nav'))} />
          <Btn icon={SquareDashed} label="Límites del texto" active={view.bounds} onClick={() => setView({ bounds: !view.bounds })} />
          <Btn icon={Pilcrow} label="Marcas de formato" active={view.marks} onClick={() => setView({ marks: !view.marks })} />
        </Row>
      </Group>
      <Group label="Zoom">
        <Row>
          <Btn icon={ZoomOut} label="Alejar (⌘-)" onClick={() => api.run('zoom', -0.1)} />
          <Menu label="Zoom personalizado" text={`${Math.round(view.zoom * 100)}%`} width={180}>
            {(close) => (
              <>
                {[50, 75, 90, 100, 110, 125, 150, 200, 300].map((value) => <Item key={value} label={`${value}%`} active={Math.round(view.zoom * 100) === value} close={close} onClick={() => setView({ zoom: value / 100, fit: null })} />)}
                <Item label="Otro…" close={close} onClick={() => api.run('zoomCustom')} />
              </>
            )}
          </Menu>
          <Btn icon={ZoomIn} label="Acercar (⌘+)" onClick={() => api.run('zoom', 0.1)} />
        </Row>
        <Row>
          <Btn label="100 %" wide onClick={() => setView({ zoom: 1, fit: null, layout: 'single' })} />
          <Btn icon={Maximize2} label="Ajustar a página" onClick={() => setView({ fit: 'page', layout: 'single' })} />
          <Btn icon={MoveHorizontal} label="Ajustar al ancho" onClick={() => setView({ fit: 'width', layout: 'single' })} />
        </Row>
        <Row>
          <Btn icon={FileText} label="Una página" active={view.layout === 'single'} onClick={() => setView({ layout: 'single', fit: 'page' })} />
          <Btn icon={LayoutGrid} label="Varias páginas" active={view.layout === 'multi'} onClick={() => setView({ layout: 'multi', fit: 'multi' })} />
          <Btn icon={Columns2} label="Páginas lado a lado" active={view.layout === 'side'} onClick={() => setView({ layout: 'side', fit: 'side' })} />
        </Row>
      </Group>
      <Group label="Ventana">
        <Row>
          <Btn icon={SplitSquareVertical} label="Dividir ventana" active={view.split} onClick={() => setView({ split: !view.split, compare: null })} />
          <Btn icon={ExternalLink} label="Nueva ventana" onClick={() => api.run('newWindow')} />
          <Btn icon={Copy} label="Organizar ventanas (lado a lado)" onClick={() => api.run('arrangeWindows')} />
        </Row>
        <Row>
          <Btn icon={ArrowLeftRight} label="Ver en paralelo con otro documento" active={Boolean(view.compare)} onClick={() => api.run('sideBySide')} />
          <Btn icon={MoveHorizontal} label="Desplazamiento sincronizado" active={view.syncScroll} onClick={() => setView({ syncScroll: !view.syncScroll })} />
          <Btn icon={FileText} label="Cambiar de documento" onClick={() => api.run('switchDoc')} />
        </Row>
      </Group>
      <Group label="Navegación">
        <Row>
          <Btn icon={Images} label="Miniaturas" onClick={() => api.openLeft('pages')} />
          <Btn icon={ListTree} label="Encabezados" onClick={() => api.openLeft('nav')} />
          <Btn icon={Search} label="Resultados de búsqueda" onClick={() => api.openLeft('search')} />
          <Btn icon={Hash} label="Ir a página…" onClick={() => api.run('goto')} />
        </Row>
      </Group>
    </>
  );
}
