import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Menu } from 'lucide-react';
import SearchBar from './SearchBar';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useDismiss } from '../features/home/useDismiss';
import { notificationsRepository } from '../data/repositories/notificationsRepository';

const Navbar = ({ onSearch, searchQuery, onOpenNav }) => {
  const { user } = useAuth();
  const [notesOpen, setNotesOpen] = useState(false);
  const notesRef = useRef(null);
  useDismiss(notesOpen, () => setNotesOpen(false), notesRef);

  const notes = (() => {
    try {
      return notificationsRepository.getByUserId(user?.id) || [];
    } catch {
      return [];
    }
  })();
  const unread = notes.filter((note) => !note.read).length;

  return (
    <header className="app-header sticky top-0 z-40">
      <div className="flex min-w-0 flex-wrap items-center gap-3 px-4 py-3 md:px-6">
        <button
          type="button"
          className="ps-header-btn ps-nav-toggle"
          aria-label="Abrir navegación"
          onClick={onOpenNav}
        >
          <Menu size={20} />
        </button>

        <Link to="/home" className="ps-brand-lockup flex shrink-0 items-center gap-2 py-1" aria-label="Pistache">
          <span className="ps-brand" aria-hidden="true">
            <span className="ps-brand-ink" />
            <span className="ps-brand-leaf" />
          </span>
          <span className="ps-product-badge">SprintOps</span>
        </Link>

        <div className="order-last w-full min-w-0 md:order-none md:flex md:flex-1 md:justify-center md:px-4">
          <SearchBar onSearch={onSearch} value={searchQuery} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative" ref={notesRef}>
            <button
              type="button"
              className="ps-header-btn"
              aria-label={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'}
              aria-expanded={notesOpen}
              onClick={() => setNotesOpen((open) => !open)}
            >
              <Bell size={18} />
              {unread > 0 && <span className="ps-dot" aria-hidden="true" />}
            </button>
            {notesOpen && (
              <div className="ps-popover right-0 w-72" role="menu">
                <p className="px-3 py-2 text-sm font-bold">Notificaciones</p>
                {notes.length === 0 ? (
                  <p className="ps-muted px-3 pb-3 text-sm">No hay notificaciones.</p>
                ) : (
                  <ul className="max-h-72 overflow-y-auto">
                    {notes.map((note) => (
                      <li key={note.id}>
                        <button
                          type="button"
                          className="ps-menu-item w-full"
                          onClick={() => {
                            if (!note.read) notificationsRepository.markAsRead(note.id);
                            setNotesOpen(false);
                          }}
                        >
                          <span className="min-w-0 text-left">
                            <span className="block truncate font-semibold">{note.title || note.message || 'Notificación'}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};

export default Navbar;
