const STORAGE_KEY = 'sprintops.locale';

export const LOCALES = [
  { id: 'es', label: 'Español', hint: 'Documentos, revisión y fechas en español' },
  { id: 'en', label: 'English', hint: 'Documents, review and dates in English' },
];

export function loadLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'es' || stored === 'en') return stored;
  } catch { /* el navegador puede bloquear el almacenamiento */ }
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'es';
}

export function applyLocale(id) {
  const locale = id === 'en' ? 'en' : 'es';
  document.documentElement.lang = locale;
  return locale;
}

export function saveLocale(id) {
  const locale = applyLocale(id);
  try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('sprintops-locale', { detail: locale }));
  return locale;
}
