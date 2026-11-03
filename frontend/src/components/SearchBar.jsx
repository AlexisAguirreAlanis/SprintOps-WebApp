import { useEffect, useId } from 'react';
import { Search } from 'lucide-react';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');

const SearchBar = ({ onSearch, value = '' }) => {
  const inputId = useId();

  useEffect(() => {
    const onKey = (event) => {
      const shortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (!shortcut) return;
      event.preventDefault();
      document.getElementById(inputId)?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [inputId]);

  return (
    <div className="ps-search">
      <Search size={16} aria-hidden="true" />
      <input
        id={inputId}
        type="search"
        value={value}
        placeholder="Buscar proyectos…"
        aria-label="Buscar proyectos"
        onChange={(event) => onSearch?.(event.target.value)}
      />
      <kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
    </div>
  );
};

export default SearchBar;
