import { ArrowDownAZ, ChevronLeft, ChevronRight, Eye, FileStack, Filter, GitBranch, Mail, MailPlus, Send, StickyNote, Tags, Users } from 'lucide-react';
import { Btn, Group, Item, Menu, Row, Sep } from '../ui/controls';

export default function MailingsTab({ api }) {
  const { doc } = api;
  const fields = doc.recipients.fields;
  const total = api.mergeRows.length;
  return (
    <>
      <Group label="Crear">
        <Row>
          <Btn icon={StickyNote} label="Cartas" active={doc.mailType === 'letter'} wide onClick={() => api.run('mailType', 'letter')} />
          <Btn icon={Mail} label="Correos" active={doc.mailType === 'email'} wide onClick={() => api.run('mailType', 'email')} />
        </Row>
        <Row>
          <Btn icon={MailPlus} label="Sobres" active={doc.mailType === 'envelope'} wide onClick={() => api.run('mailType', 'envelope')} />
          <Btn icon={Tags} label="Etiquetas" active={doc.mailType === 'labels'} wide onClick={() => api.run('mailType', 'labels')} />
        </Row>
      </Group>
      <Group label="Destinatarios">
        <Row>
          <Menu icon={Users} label="Seleccionar destinatarios" text={`Destinatarios (${doc.recipients.rows.length})`} width={260}>
            {(close) => (
              <>
                <Item label="Escribir una lista nueva…" close={close} onClick={() => api.run('recipients', 'edit')} />
                <Item label="Importar CSV / TSV…" close={close} onClick={() => api.run('recipients', 'import')} />
                <Item label="Miembros del proyecto vinculado" close={close} onClick={() => api.run('recipients', 'members')} />
                <Item label="Issues del proyecto vinculado" close={close} onClick={() => api.run('recipients', 'issues')} />
                <Sep />
                <Item label="Editar lista de destinatarios…" close={close} onClick={() => api.run('recipients', 'edit')} />
              </>
            )}
          </Menu>
        </Row>
        <Row>
          <Btn icon={Filter} label="Filtrar destinatarios" onClick={() => api.run('filterRecipients')} />
          <Btn icon={ArrowDownAZ} label="Ordenar destinatarios" onClick={() => api.run('sortRecipients')} />
        </Row>
      </Group>
      <Group label="Escribir e insertar campos">
        <Row>
          <Menu icon={FileStack} label="Insertar campo combinado" text="Campo" width={220} disabled={!fields.length}>
            {(close) => fields.map((field) => <Item key={field} label={`«${field}»`} close={close} onClick={() => api.run('mergeField', field)} />)}
          </Menu>
          <Btn icon={GitBranch} label="Reglas (Si… entonces… si no…)" wide onClick={() => api.run('mergeRule')} disabled={!fields.length} />
        </Row>
        <Row>
          <Btn label="Bloque de direcciones" wide onClick={() => api.run('addressBlock')} disabled={!fields.length} />
          <Btn label="Línea de saludo" wide onClick={() => api.run('greetingLine')} disabled={!fields.length} />
        </Row>
      </Group>
      <Group label="Vista previa">
        <Row>
          <Btn icon={Eye} label="Vista previa de resultados" active={api.mergePreview !== null} wide onClick={() => api.run('mergePreview', api.mergePreview === null ? 0 : null)} disabled={!total} />
        </Row>
        <Row>
          <Btn icon={ChevronLeft} label="Registro anterior" disabled={api.mergePreview === null || api.mergePreview <= 0} onClick={() => api.run('mergePreview', api.mergePreview - 1)} />
          <span className="wd-mini-label">{api.mergePreview === null ? '—' : `${api.mergePreview + 1} / ${total}`}</span>
          <Btn icon={ChevronRight} label="Registro siguiente" disabled={api.mergePreview === null || api.mergePreview >= total - 1} onClick={() => api.run('mergePreview', api.mergePreview + 1)} />
        </Row>
      </Group>
      <Group label="Finalizar">
        <Menu icon={Send} label="Finalizar y combinar" text="Finalizar y combinar" width={260} disabled={!total}>
          {(close) => (
            <>
              <Item label="Documento del registro actual" close={close} onClick={() => api.run('mergeDocs', 'single')} />
              <Item label="Un documento con todos los registros" close={close} onClick={() => api.run('mergeDocs', 'all')} />
              <Item label="Un documento por registro" close={close} onClick={() => api.run('mergeDocs', 'each')} />
              <Item label="Enviar correos personalizados…" close={close} onClick={() => api.run('mergeEmails')} />
              <Item label="Imprimir documentos combinados" close={close} onClick={() => api.run('mergePrint')} />
            </>
          )}
        </Menu>
      </Group>
    </>
  );
}
