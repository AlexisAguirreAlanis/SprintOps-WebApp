import { useMemo, useState } from 'react';
import {
  FileText,
  Lightbulb,
  Presentation,
  Search,
  Shapes,
  Sparkles,
  AppWindow,
  X,
} from 'lucide-react';
import { AnimatedPopup } from '../../components/PopupPortal';
import { TEMPLATE_GROUPS } from './portfolioDocument';
import SheetThumb from './SheetThumb';

const ICONS = {
  foryou: Sparkles,
  diagrams: Shapes,
  slides: Presentation,
  documents: FileText,
  interfaces: AppWindow,
  ideas: Lightbulb,
};

function TemplateGallery({ open, templates, busy, onClose, onPick }) {
  const [group, setGroup] = useState('foryou');
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!needle) return templates;
    return templates.filter((item) => `${item.name} ${item.blurb}`.toLowerCase().includes(needle));
  }, [templates, needle]);

  const sections = needle
    ? [{ id: 'results', label: 'Resultados', items: filtered }]
    : group === 'foryou'
      ? [
          { id: 'featured', label: 'Recomendadas', items: templates.filter((item) => item.featured) },
          { id: 'popular', label: 'Populares', items: templates.filter((item) => item.popular) },
        ]
      : [{ id: group, label: TEMPLATE_GROUPS.find((item) => item.id === group)?.label || 'Plantillas', items: templates.filter((item) => item.category === group) }];

  return (
    <AnimatedPopup open={open}>
      <div className="popup-overlay pf-gallery-overlay" onMouseDown={onClose}>
        <div
          className="popup-panel pf-gallery"
          role="dialog"
          aria-modal="true"
          aria-label="Plantillas"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <header className="pf-gallery-top">
            <h2>Plantillas</h2>
            <label className="pf-gallery-search">
              <Search size={16} />
              <input
                value={query}
                placeholder="Busca en todas las plantillas..."
                aria-label="Busca en todas las plantillas"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <button type="button" className="pf-icon-btn" aria-label="Cerrar plantillas" onClick={onClose}><X size={18} /></button>
          </header>
          <div className="pf-gallery-body">
            <nav className="pf-gallery-nav" aria-label="Tipos de plantilla">
              {TEMPLATE_GROUPS.map((item) => {
                const Icon = ICONS[item.id] || Shapes;
                return (
                  <button key={item.id} type="button" className={!needle && group === item.id ? 'is-active' : ''} onClick={() => { setGroup(item.id); setQuery(''); }}>
                    <Icon size={16} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
            <div className="pf-gallery-main">
              {sections.map((section) => (
                <section key={section.id}>
                  <h3>{section.label}</h3>
                  {section.items.length === 0 ? (
                    <p className="pf-kicker">No hay plantillas con esa búsqueda.</p>
                  ) : (
                    <div className="pf-gallery-grid">
                      {section.items.map((template) => (
                        <button key={`${section.id}-${template.id}`} type="button" className="pf-gallery-card" disabled={busy} onClick={() => onPick(template.id)}>
                          <div className={`pf-gallery-art${template.kind === 'document' ? ' is-doc' : ''}${template.kind === 'slides' ? ' is-slides' : ''}`}>
                            <SheetThumb elements={template.elements} />
                          </div>
                          <strong>{template.name}</strong>
                          <span>{template.blurb}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AnimatedPopup>
  );
}

export default TemplateGallery;
