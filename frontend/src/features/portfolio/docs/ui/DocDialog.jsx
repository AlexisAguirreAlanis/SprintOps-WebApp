import { useEffect, useState } from 'react';
import Modal from '../../../../components/Modal';

/** Diálogo genérico: formulario descrito por campos, o contenido libre (render). */
export default function DocDialog({ dialog, onClose }) {
  const [values, setValues] = useState({});

  useEffect(() => {
    if (!dialog?.fields) return;
    setValues(Object.fromEntries(dialog.fields.filter((field) => field.name).map((field) => [field.name, field.value ?? (field.type === 'checkbox' ? false : '')])));
  }, [dialog]);

  if (!dialog) return <Modal isOpen={false} onClose={onClose} title="" />;
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }));
  const finish = (result) => {
    dialog.resolve(result);
    onClose();
  };

  return (
    <Modal isOpen onClose={() => finish(null)} title={dialog.title} maxWidthClass={dialog.width || 'max-w-lg'} bodyClassName="p-5">
      {dialog.render ? (
        <div className="wd-dialog">{dialog.render({ close: finish })}</div>
      ) : (
        <form className="wd-dialog wd-form" onSubmit={(event) => { event.preventDefault(); finish(values); }}>
          {dialog.description && <p className="wd-muted">{dialog.description}</p>}
          <div className="wd-form-grid">
            {dialog.fields.map((field, index) => {
              if (field.type === 'info') return <p key={index} className="wd-muted wd-form-full">{field.label}</p>;
              if (field.show && !field.show(values)) return null;
              const id = `wd-f-${field.name}`;
              const common = { id, value: values[field.name] ?? '', onChange: (event) => set(field.name, field.type === 'number' || field.type === 'range' ? Number(event.target.value) : event.target.value) };
              return (
                <label key={field.name} htmlFor={id} className={`wd-field-row${field.full || field.type === 'textarea' ? ' wd-form-full' : ''}${field.type === 'checkbox' ? ' is-check' : ''}`}>
                  <span>{field.label}</span>
                  {field.type === 'textarea' && <textarea rows={field.rows || 5} placeholder={field.placeholder} {...common} />}
                  {field.type === 'select' && (
                    <select {...common}>
                      {field.options.map((option) => {
                        const [val, text] = Array.isArray(option) ? option : [option, option];
                        return <option key={val} value={val}>{text}</option>;
                      })}
                    </select>
                  )}
                  {field.type === 'checkbox' && <input id={id} type="checkbox" checked={Boolean(values[field.name])} onChange={(event) => set(field.name, event.target.checked)} />}
                  {field.type === 'color' && <input type="color" {...common} value={values[field.name] || '#000000'} />}
                  {field.type === 'range' && <span className="wd-range"><input type="range" min={field.min} max={field.max} step={field.step || 1} {...common} /><em>{values[field.name]}{field.suffix || ''}</em></span>}
                  {(!field.type || field.type === 'text' || field.type === 'number' || field.type === 'password' || field.type === 'url' || field.type === 'email' || field.type === 'date' || field.type === 'month') && (
                    <input type={field.type || 'text'} placeholder={field.placeholder} min={field.min} max={field.max} step={field.step} autoFocus={index === 0} {...common} />
                  )}
                  {field.help && <small>{field.help}</small>}
                </label>
              );
            })}
          </div>
          <div className="wd-dialog-actions">
            <button type="button" className="ps-quiet" onClick={() => finish(null)}>Cancelar</button>
            <button type="submit" className="wd-primary">{dialog.submitLabel || 'Aplicar'}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
