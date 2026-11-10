import {
  AlignHorizontalJustifyCenter, ArrowDownToLine, ArrowUpToLine, BringToFront, Columns2, Columns3, FileStack, Group as GroupIcon, Layers,
  ListOrdered, Maximize, RectangleHorizontal, RectangleVertical, RotateCw, ScanLine, SendToBack, SeparatorHorizontal, Settings2, SquareStack,
  Ungroup, WrapText,
} from 'lucide-react';
import { Btn, Group, Item, Menu, NumberField, Row, Sep } from '../ui/controls';
import { MARGIN_PRESETS, PAGE_SIZES } from '../model';
import { WRAP_MODES } from '../engine/objects';

const toCm = (px) => Math.round((px / 96) * 2.54 * 100) / 100;
const toPx = (cm) => Math.round((Number(cm) / 2.54) * 96);
const pxToPt = (px) => Math.round((parseFloat(px) || 0) * 0.75);
const ptToPx = (pt) => Math.round(Number(pt) / 0.75);

export default function LayoutTab({ api, sel }) {
  const { doc } = api;
  const block = sel.blockStyle || {};
  const objects = api.objects;
  return (
    <>
      <Group label="Configurar página">
        <Row>
          <Menu icon={Maximize} label="Márgenes" text="Márgenes" width={240}>
            {(close) => (
              <>
                {Object.entries(MARGIN_PRESETS).map(([id, preset]) => (
                  <Item key={id} close={close} active={['top', 'right', 'bottom', 'left'].every((side) => Math.round(doc.margins[side]) === Math.round(preset[side]))} onClick={() => api.patchDoc({ margins: { top: preset.top, right: preset.right, bottom: preset.bottom, left: preset.left } })}>
                    <b>{preset.label}</b> <small>Sup {toCm(preset.top)} · Izq {toCm(preset.left)} cm</small>
                  </Item>
                ))}
                <Sep />
                <Item label="Márgenes personalizados…" close={close} onClick={() => api.run('customMargins')} />
              </>
            )}
          </Menu>
          <Menu icon={doc.orientation === 'landscape' ? RectangleHorizontal : RectangleVertical} label="Orientación" text="Orientación" width={190}>
            {(close) => (
              <>
                <Item icon={RectangleVertical} label="Vertical" active={doc.orientation !== 'landscape'} close={close} onClick={() => api.patchDoc({ orientation: 'portrait' })} />
                <Item icon={RectangleHorizontal} label="Horizontal" active={doc.orientation === 'landscape'} close={close} onClick={() => api.patchDoc({ orientation: 'landscape' })} />
              </>
            )}
          </Menu>
          <Menu icon={FileStack} label="Tamaño" text="Tamaño" width={240}>
            {(close) => (
              <>
                {Object.entries(PAGE_SIZES).map(([id, size]) => <Item key={id} active={doc.pageSize === id} close={close} onClick={() => api.patchDoc({ pageSize: id })}><b>{size.label}</b> <small>{toCm(size.width)} × {toCm(size.height)} cm</small></Item>)}
                <Sep />
                <Item label="Tamaño personalizado…" active={doc.pageSize === 'custom'} close={close} onClick={() => api.run('customSize')} />
              </>
            )}
          </Menu>
          <Menu icon={Columns2} label="Columnas" text="Columnas" width={230}>
            {(close) => (
              <>
                {[1, 2, 3].map((count) => <Item key={count} icon={count === 3 ? Columns3 : Columns2} label={count === 1 ? 'Una' : count === 2 ? 'Dos' : 'Tres'} active={doc.columns.count === count} close={close} onClick={() => api.patchDoc({ columns: { ...doc.columns, count } })} />)}
                <Sep />
                <Item label={doc.columns.divider ? 'Quitar línea divisoria' : 'Línea divisoria entre columnas'} close={close} onClick={() => api.patchDoc({ columns: { ...doc.columns, divider: !doc.columns.divider } })} />
                <Item label="Columnas personalizadas…" close={close} onClick={() => api.run('customColumns')} />
              </>
            )}
          </Menu>
        </Row>
        <Row>
          <Menu icon={SeparatorHorizontal} label="Saltos" text="Saltos" width={260}>
            {(close) => (
              <>
                <Sep label="Saltos de página" />
                <Item label="Página" hint="⌘↵" close={close} onClick={() => api.run('pageBreak')} />
                <Item label="Columna" hint="⌘⇧↵" close={close} onClick={() => api.run('columnBreak')} />
                <Sep label="Saltos de sección" />
                <Item label="Página siguiente" close={close} onClick={() => api.run('sectionBreak', 'next')} />
                <Item label="Continua" close={close} onClick={() => api.run('sectionBreak', 'continuous')} />
                <Item label="Página par" close={close} onClick={() => api.run('sectionBreak', 'even')} />
                <Item label="Página impar" close={close} onClick={() => api.run('sectionBreak', 'odd')} />
              </>
            )}
          </Menu>
          <Menu icon={ListOrdered} label="Números de línea" width={220}>
            {(close) => (
              <>
                <Item label="Ninguno" active={!doc.lineNumbers} close={close} onClick={() => api.patchDoc({ lineNumbers: false })} />
                <Item label="Continuo" active={doc.lineNumbers} close={close} onClick={() => api.patchDoc({ lineNumbers: true })} />
                <Item label="Suprimir en el párrafo actual" close={close} onClick={() => api.run('toggleBlockClass', 'wd-no-linenum')} />
              </>
            )}
          </Menu>
          <Menu icon={ScanLine} label="Guiones" width={230}>
            {(close) => (
              <>
                <Item label="Ninguno" active={doc.hyphenation === 'none'} close={close} onClick={() => api.patchDoc({ hyphenation: 'none' })} />
                <Item label="Automático" active={doc.hyphenation === 'auto'} close={close} onClick={() => api.patchDoc({ hyphenation: 'auto' })} />
                <Item label="Manual (solo guiones opcionales)" active={doc.hyphenation === 'manual'} close={close} onClick={() => api.patchDoc({ hyphenation: 'manual' })} />
                <Item label="Insertar guion opcional aquí" close={close} onClick={() => api.insert('\u00ad')} />
              </>
            )}
          </Menu>
          <Btn icon={Settings2} label="Configuración de página y secciones…" onClick={() => api.run('pageSetup')} />
        </Row>
      </Group>

      <Group label="Párrafo">
        <Row>
          <span className="wd-mini-label">Sangría</span>
          <NumberField label="Sangría izquierda" value={toCm(parseFloat(block.marginLeft) || 0)} min={0} max={12} step={0.25} suffix="izq" width={108} onChange={(value) => api.block({ marginLeft: `${toPx(value)}px` })} />
          <NumberField label="Sangría derecha" value={toCm(parseFloat(block.marginRight) || 0)} min={0} max={12} step={0.25} suffix="der" width={108} onChange={(value) => api.block({ marginRight: `${toPx(value)}px` })} />
        </Row>
        <Row>
          <span className="wd-mini-label">Espaciado</span>
          <NumberField label="Espaciado anterior" value={pxToPt(block.marginTop)} min={0} max={120} step={2} suffix="ant" width={108} onChange={(value) => api.block({ marginTop: `${ptToPx(value)}px` })} />
          <NumberField label="Espaciado posterior" value={pxToPt(block.marginBottom)} min={0} max={120} step={2} suffix="pos" width={108} onChange={(value) => api.block({ marginBottom: `${ptToPx(value)}px` })} />
        </Row>
      </Group>

      <Group label="Organizar">
        <Row>
          <Menu icon={WrapText} label="Ajustar texto" text="Ajuste" width={230} disabled={!api.object}>
            {(close) => (
              <>
                {Object.entries(WRAP_MODES).map(([mode, label]) => <Item key={mode} label={label} active={api.object?.dataset?.wrap === mode} close={close} onClick={() => api.run('wrap', mode)} />)}
                <Sep />
                <Item label="Fijar posición en la página" close={close} onClick={() => api.run('wrap', 'front')} />
                <Item label="Mover con el texto" close={close} onClick={() => api.run('wrap', 'square')} />
                <Item label="Distancia respecto al texto…" close={close} onClick={() => api.run('wrapDistance')} />
              </>
            )}
          </Menu>
          <Menu icon={Layers} label="Posición" width={220} disabled={!api.object}>
            {(close) => (
              <>
                {[['left', 'Arriba a la izquierda', 'top'], ['center', 'Arriba al centro', 'top'], ['right', 'Arriba a la derecha', 'top'], ['left', 'Centro izquierda', 'middle'], ['center', 'Centro', 'middle'], ['right', 'Centro derecha', 'middle'], ['left', 'Abajo a la izquierda', 'bottom'], ['center', 'Abajo al centro', 'bottom'], ['right', 'Abajo a la derecha', 'bottom']].map(([h, label, v]) => (
                  <Item key={label} label={label} close={close} onClick={() => api.run('position', h, v)} />
                ))}
              </>
            )}
          </Menu>
          <Btn icon={BringToFront} label="Traer adelante" disabled={!api.object} onClick={() => api.run('zorder', 'forward')} />
          <Btn icon={SendToBack} label="Enviar atrás" disabled={!api.object} onClick={() => api.run('zorder', 'backward')} />
          <Btn icon={ArrowUpToLine} label="Traer al frente" disabled={!api.object} onClick={() => api.run('zorder', 'front')} />
          <Btn icon={ArrowDownToLine} label="Enviar al fondo" disabled={!api.object} onClick={() => api.run('zorder', 'back')} />
        </Row>
        <Row>
          <Menu icon={AlignHorizontalJustifyCenter} label="Alinear y distribuir" width={220} disabled={!objects.length}>
            {(close) => (
              <>
                {[['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha'], ['top', 'Arriba'], ['middle', 'En medio'], ['bottom', 'Abajo']].map(([mode, label]) => <Item key={mode} label={`Alinear: ${label}`} close={close} onClick={() => api.run('alignObjects', mode)} />)}
                <Sep />
                <Item label="Distribuir horizontalmente" disabled={objects.length < 3} close={close} onClick={() => api.run('distribute', 'h')} />
                <Item label="Distribuir verticalmente" disabled={objects.length < 3} close={close} onClick={() => api.run('distribute', 'v')} />
              </>
            )}
          </Menu>
          <Btn icon={GroupIcon} label="Agrupar (Mayús+clic para seleccionar varios)" disabled={objects.length < 2} onClick={() => api.run('group')} />
          <Btn icon={Ungroup} label="Desagrupar" disabled={api.object?.dataset?.kind !== 'group'} onClick={() => api.run('ungroup')} />
          <Menu icon={RotateCw} label="Girar" width={200} disabled={!api.object}>
            {(close) => (
              <>
                <Item label="Girar 90° a la derecha" close={close} onClick={() => api.run('rotate', 90)} />
                <Item label="Girar 90° a la izquierda" close={close} onClick={() => api.run('rotate', -90)} />
                <Item label="Voltear horizontalmente" close={close} onClick={() => api.run('flip', 'h')} />
                <Item label="Voltear verticalmente" close={close} onClick={() => api.run('flip', 'v')} />
                <Item label="Ángulo exacto…" close={close} onClick={() => api.run('rotateExact')} />
              </>
            )}
          </Menu>
          <Btn icon={SquareStack} label="Panel de selección" onClick={() => api.run('selectionPane')} />
        </Row>
      </Group>
    </>
  );
}
