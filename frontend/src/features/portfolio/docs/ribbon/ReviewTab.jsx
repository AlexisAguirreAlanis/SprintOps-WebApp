import {
  Accessibility, BookA, Check, CheckCheck, ChevronLeft, ChevronRight, FileDiff, GitMerge, Languages, Lock, LockOpen, MessageSquare,
  MessageSquarePlus, MessagesSquare, Mic, PanelRight, Pause, ShieldCheck, SpellCheck, Stamp, Trash2, X, XCircle, Calculator, BookType, Globe, Sparkles,
} from 'lucide-react';
import { Btn, Group, Item, Menu, Row, Select, Sep } from '../ui/controls';

export const LANGUAGES = [['es', 'Español'], ['en', 'Inglés'], ['pt', 'Portugués'], ['fr', 'Francés'], ['de', 'Alemán'], ['it', 'Italiano'], ['ca', 'Catalán'], ['ja', 'Japonés'], ['zh', 'Chino']];

export default function ReviewTab({ api }) {
  const { doc } = api;
  const owner = api.meta?.canManage;
  return (
    <>
      <Group label="Revisión">
        <Row>
          <Btn icon={SpellCheck} label="Ortografía y gramática (IA)" wide onClick={() => api.run('grammar')} />
          <Btn icon={BookType} label="Revisión ortográfica del navegador" active={api.view.spellcheck} onClick={() => api.setView({ spellcheck: !api.view.spellcheck })} />
        </Row>
        <Row>
          <Btn icon={BookA} label="Sinónimos" onClick={() => api.run('synonyms')} />
          <Btn icon={Calculator} label="Contar palabras" onClick={() => api.run('wordCount')} />
          <Btn icon={Sparkles} label="Corrección automática" active={doc.autocorrect} onClick={() => api.patchDoc({ autocorrect: !doc.autocorrect })} />
          <Btn icon={BookA} label="Diccionario personalizado" onClick={() => api.run('dictionary')} />
        </Row>
      </Group>
      <Group label="Voz y accesibilidad">
        <Row>
          <Btn icon={api.reading ? Pause : Mic} label={api.reading ? 'Detener lectura' : 'Leer en voz alta'} wide onClick={() => api.run(api.reading ? 'stopReading' : 'readAloud')} />
        </Row>
        <Row>
          <Btn icon={Accessibility} label="Comprobar accesibilidad" wide onClick={() => api.run('accessibility')} />
        </Row>
      </Group>
      <Group label="Idioma">
        <Row>
          <Select label="Idioma del documento" width={110} value={doc.language} options={LANGUAGES} onChange={(language) => api.patchDoc({ language })} />
          <Btn icon={Globe} label="Detectar idioma" onClick={() => api.run('detectLanguage')} />
        </Row>
        <Row>
          <Menu icon={Languages} label="Traducir" text="Traducir" width={240}>
            {(close) => (
              <>
                <Sep label="Traducir selección a" />
                {LANGUAGES.map(([code, label]) => <Item key={`s-${code}`} label={label} close={close} onClick={() => api.run('translate', 'selection', label)} />)}
                <Sep label="Traducir documento (copia nueva) a" />
                {LANGUAGES.map(([code, label]) => <Item key={`d-${code}`} label={label} close={close} onClick={() => api.run('translate', 'document', label)} />)}
              </>
            )}
          </Menu>
        </Row>
      </Group>
      <Group label="Comentarios">
        <Row>
          <Btn icon={MessageSquarePlus} label="Nuevo comentario (⌘⌥M)" wide onClick={() => api.run('comment')} disabled={!api.canComment} />
        </Row>
        <Row>
          <Btn icon={ChevronLeft} label="Comentario anterior" onClick={() => api.run('navComment', -1)} />
          <Btn icon={ChevronRight} label="Comentario siguiente" onClick={() => api.run('navComment', 1)} />
          <Btn icon={MessagesSquare} label="Panel de comentarios" active={api.rightTab === 'comments'} onClick={() => api.openRight('comments')} />
          <Btn icon={Trash2} label="Eliminar comentarios resueltos" disabled={!api.canEdit} onClick={() => api.run('deleteResolved')} />
        </Row>
      </Group>
      <Group label="Seguimiento">
        <Row>
          <Btn icon={MessageSquare} label={doc.tracking ? 'Control de cambios: activado' : 'Control de cambios: desactivado'} active={doc.tracking} wide onClick={() => api.run('toggleTracking')} disabled={!api.canEdit} />
        </Row>
        <Row>
          <Select label="Mostrar marcas" width={150} value={api.view.markup} options={[['all', 'Todas las marcas'], ['simple', 'Marcas simples'], ['none', 'Sin marcas (final)'], ['original', 'Original']]} onChange={(markup) => api.setView({ markup })} />
          <Btn icon={PanelRight} label="Panel de revisiones" onClick={() => api.openRight('changes')} />
        </Row>
      </Group>
      <Group label="Cambios">
        <Row>
          <Btn icon={Check} label="Aceptar cambio" onClick={() => api.run('acceptChange')} disabled={!api.canEdit} />
          <Btn icon={X} label="Rechazar cambio" onClick={() => api.run('rejectChange')} disabled={!api.canEdit} />
          <Btn icon={ChevronLeft} label="Cambio anterior" onClick={() => api.run('navChange', -1)} />
          <Btn icon={ChevronRight} label="Cambio siguiente" onClick={() => api.run('navChange', 1)} />
        </Row>
        <Row>
          <Btn icon={CheckCheck} label="Aceptar todos" onClick={() => api.run('acceptAll')} disabled={!api.canEdit} />
          <Btn icon={XCircle} label="Rechazar todos" onClick={() => api.run('rejectAll')} disabled={!api.canEdit} />
          <Btn icon={FileDiff} label="Comparar documentos" onClick={() => api.run('compare')} />
          <Btn icon={GitMerge} label="Combinar revisiones" onClick={() => api.run('combine')} disabled={!api.canEdit} />
        </Row>
      </Group>
      <Group label="Proteger">
        <Row>
          <Menu icon={ShieldCheck} label="Restringir edición" text="Restringir" width={260} disabled={!owner}>
            {(close) => (
              <>
                <Item label="Sin restricciones" active={doc.protection.mode === 'none'} close={close} onClick={() => api.run('protect', 'none')} />
                <Item label="Solo lectura" active={doc.protection.mode === 'readonly'} close={close} onClick={() => api.run('protect', 'readonly')} />
                <Item label="Solo comentarios" active={doc.protection.mode === 'comments'} close={close} onClick={() => api.run('protect', 'comments')} />
                <Item label="Solo cambios controlados (seguimiento obligatorio)" active={doc.protection.mode === 'tracked'} close={close} onClick={() => api.run('protect', 'tracked')} />
                <Sep />
                <Item label="Permisos por persona…" close={close} onClick={() => api.run('permissions')} />
              </>
            )}
          </Menu>
          <Btn icon={Stamp} label={doc.protection.mode === 'final' ? 'Quitar "Marcado como final"' : 'Marcar como final'} active={doc.protection.mode === 'final'} disabled={!owner} onClick={() => api.run('protect', doc.protection.mode === 'final' ? 'none' : 'final')} />
        </Row>
        <Row>
          <Btn icon={doc.lock ? LockOpen : Lock} label={doc.lock ? `Desbloquear documento (bloqueado por ${doc.lock.name})` : 'Bloquear documento para los demás'} active={Boolean(doc.lock)} disabled={!api.canEdit} onClick={() => api.run('lockDoc')} />
          <Btn icon={Lock} label="Bloquear sección seleccionada" disabled={!api.canEdit} onClick={() => api.run('lockSection')} />
          <Btn icon={LockOpen} label="Desbloquear sección" disabled={!api.canEdit} onClick={() => api.run('unlockSection')} />
        </Row>
      </Group>
    </>
  );
}
