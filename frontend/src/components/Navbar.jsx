import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Menu } from 'lucide-react';
import SearchBar from './SearchBar';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useDismiss } from '../features/home/useDismiss';
import { notificationsRepository } from '../data/repositories/notificationsRepository';
import { closeProjectSettings } from '../features/home/ProjectActionsMenu';

const Navbar = ({ onSearch, searchQuery, onOpenNav }) => {
  const { user } = useAuth();
  const [notesOpen, setNotesOpen] = useState(false);
  const [ringKey, setRingKey] = useState(0);
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

        <Link to="/home" className="ps-brand-lockup flex shrink-0 items-center gap-2 py-1" aria-label="Pistache" onClick={closeProjectSettings}>
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
              onClick={() => {
                if (!notesOpen) setRingKey((key) => key + 1);
                setNotesOpen((open) => !open);
              }}
            >
              <span key={ringKey} className={`ps-bell${ringKey ? ' is-ringing' : ''}`}>
                <Bell size={18} />
                <span className="ps-bell-waves" aria-hidden="true">
                  <i /><i /><i /><i />
                </span>
              </span>
              {unread > 0 && <span className="ps-dot" aria-hidden="true" />}
            </button>
            <div className={`ps-notes${notesOpen ? ' is-open' : ''}`} role="dialog" aria-label="Notificaciones" aria-hidden={!notesOpen}>
              <div className="ps-notes-head">
                <span className="ps-notes-mark" aria-hidden="true"><Bell size={15} /></span>
                <span className="min-w-0">
                  <strong>Notificaciones</strong>
                  <small>{unread > 0 ? `${unread} sin leer` : 'Al día'}</small>
                </span>
              </div>
              {notes.length === 0 ? (
                <div className="ps-notes-empty">
                  <Bell size={20} aria-hidden="true" />
                  <p>No hay notificaciones</p>
                  <span>Cuando haya algo nuevo en tus proyectos, va a aparecer aquí.</span>
                </div>
              ) : (
                <ul className="ps-notes-list">
                  {notes.map((note) => (
                    <li key={note.id}>
                      <button
                        type="button"
                        className={`ps-notes-item${note.read ? ' is-read' : ''}`}
                        onClick={() => {
                          if (!note.read) notificationsRepository.markAsRead(note.id);
                          setNotesOpen(false);
                        }}
                      >
                        <i aria-hidden="true" />
                        <span className="min-w-0">
                          <strong>{note.title || note.message || 'Notificación'}</strong>
                          {note.message && note.message !== note.title && <small>{note.message}</small>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

        </div>
      </div>
    </header>
  );
};

export default Navbar;
