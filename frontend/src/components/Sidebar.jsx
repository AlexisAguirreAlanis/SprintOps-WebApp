import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChartColumn, ChevronLeft, CircleUser, Folder, LogOut, Palette, Settings, X } from 'lucide-react';
import Avatar from './Avatar';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useDismiss } from '../features/home/useDismiss';

const MAIN = [
  { to: '/home', label: 'Proyectos', icon: Folder, match: ['/home', '/projects'] },
];

const SETTINGS = [
  { to: '/profile', label: 'Perfil', icon: CircleUser, match: ['/profile'] },
  { to: '/settings/apariencia', label: 'Apariencia', icon: Palette, match: ['/settings/apariencia'] },
  { to: '/settings/plan', label: 'Plan & Uso', icon: ChartColumn, match: ['/settings/plan'] },
];

const isMatch = (item, path) => item.match.some((candidate) => path === candidate);

const Sidebar = ({ open, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const path = location.pathname;
  const previousPath = useRef(path);
  const accountRef = useRef(null);
  const onSettingsRoute = SETTINGS.some((item) => isMatch(item, path));
  const [settingsHeld, setSettingsHeld] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const showSettings = onSettingsRoute || settingsHeld;

  useDismiss(accountOpen, () => setAccountOpen(false), accountRef);

  useEffect(() => {
    if (!onSettingsRoute) setSettingsHeld(false);
  }, [path, onSettingsRoute]);

  useEffect(() => {
    if (previousPath.current === path) return;
    previousPath.current = path;
    setAccountOpen(false);
    onClose?.();
  }, [path, onClose]);

  const closeSettings = () => {
    setSettingsHeld(false);
    setAccountOpen(false);
    if (onSettingsRoute) navigate('/home');
  };

  const signOut = () => {
    logout();
    navigate('/login');
  };

  const links = showSettings ? SETTINGS : MAIN;

  return (
    <>
      <button
        type="button"
        className={`ps-drawer-backdrop md:hidden ${open ? 'is-open' : ''}`}
        aria-label="Cerrar navegación"
        onClick={onClose}
      />
      <aside className={`ps-sidebar ${open ? 'is-open' : ''}`} aria-label="Navegación">
        <div className="mb-2 flex items-center justify-between px-3 md:hidden">
          <p className="text-sm font-semibold">Menú</p>
          <button type="button" className="ps-side-btn" aria-label="Cerrar menú" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {showSettings && (
            <button type="button" className="ps-side-back" onClick={closeSettings}>
              <ChevronLeft size={18} strokeWidth={1.75} />
              <span className="ps-side-label">Ajustes</span>
            </button>
          )}
          {links.map((item) => {
            const Icon = item.icon;
            const active = isMatch(item, path);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                title={item.label}
                className={`ps-side-link ${active ? 'is-active' : ''}`}
              >
                <Icon size={18} strokeWidth={1.75} />
                <span className="ps-side-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ps-account" ref={accountRef}>
          <div className={`ps-account-drop ${accountOpen ? 'is-open' : ''}`}>
            <div className="ps-account-drop-inner" inert={accountOpen ? undefined : true}>
              <button type="button" className="ps-side-link ps-side-logout" onClick={signOut}>
                <LogOut size={18} strokeWidth={1.75} />
                <span className="ps-side-label">Cerrar sesión</span>
              </button>
            </div>
          </div>
          <div className="ps-account-row">
            <button
              type="button"
              className={`ps-account-card ${accountOpen ? 'is-open' : ''}`}
              aria-expanded={accountOpen}
              aria-label="Cuenta"
              onClick={() => setAccountOpen((value) => !value)}
            >
              <Avatar name={user?.name} avatarUrl={user?.avatarUrl} size="sm" />
              <span className="ps-account-copy">
                <span className="ps-account-name">{user?.name || 'Usuario'}</span>
                <span className="ps-account-email">{user?.email || ''}</span>
              </span>
            </button>
            <button
              type="button"
              className={`ps-account-gear ${showSettings ? 'is-active' : ''}`}
              aria-label="Ajustes"
              aria-pressed={showSettings}
              title="Ajustes"
              onClick={() => {
                setAccountOpen(false);
                if (showSettings) closeSettings();
                else setSettingsHeld(true);
              }}
            >
              <Settings size={18} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
