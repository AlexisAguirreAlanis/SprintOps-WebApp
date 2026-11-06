import DOMPurify from 'dompurify';

const EMBED_HOSTS = /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com)\//i;

let hooked = false;
function installHooks() {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName === 'iframe' && !EMBED_HOSTS.test(node.getAttribute('src') || '')) node.remove?.();
  });
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'IMG') {
      node.setAttribute('loading', 'lazy');
      node.setAttribute('decoding', 'async');
    }
    if (node.tagName === 'A' && /^https?:/i.test(node.getAttribute('href') || '')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

const CONFIG = {
  ADD_TAGS: ['iframe', 'details', 'summary', 'figure', 'figcaption', 'ins', 'del', 'mark', 'video', 'audio', 'source'],
  ADD_ATTR: ['contenteditable', 'target', 'allow', 'allowfullscreen', 'frameborder', 'controls', 'loop', 'muted', 'poster', 'colspan', 'rowspan', 'open', 'download', 'xmlns', 'viewBox', 'preserveAspectRatio'],
  ALLOW_DATA_ATTR: true,
  FORBID_TAGS: ['script', 'style', 'link', 'meta', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
};

export function sanitizeHtml(html) {
  installHooks();
  const clean = DOMPurify.sanitize(html || '', CONFIG);
  return clean.trim() ? clean : '<p><br></p>';
}

/** HTML pegado desde Word, Google Docs o páginas web: quita basura de Office y conserva el formato útil. */
export function cleanPastedHtml(html, mode = 'keep') {
  let source = String(html || '')
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?o:p[^>]*>/gi, '')
    .replace(/<\/?(w|m|v):[^>]*>/gi, '');
  const root = document.createElement('div');
  root.innerHTML = sanitizeHtml(source);
  root.querySelectorAll('b[id^="docs-internal-guid"]').forEach((node) => node.replaceWith(...node.childNodes));
  root.querySelectorAll('[class]').forEach((node) => {
    const kept = [...node.classList].filter((name) => name.startsWith('wd-'));
    if (kept.length) node.className = kept.join(' ');
    else node.removeAttribute('class');
  });
  root.querySelectorAll('[style]').forEach((node) => {
    const style = node.getAttribute('style')
      .split(';')
      .map((rule) => rule.trim())
      .filter((rule) => rule && !/^mso-|^tab-stops|^font-family:\s*["']?(Calibri|Arial)["']?\s*$|^line-height:\s*normal/i.test(rule))
      .join('; ');
    if (mode === 'merge' || !style) node.removeAttribute('style');
    else node.setAttribute('style', style);
  });
  if (mode === 'merge') {
    root.querySelectorAll('span, font').forEach((node) => node.replaceWith(...node.childNodes));
  }
  root.querySelectorAll('span:not([class]):not([style]):not([data-field])').forEach((node) => node.replaceWith(...node.childNodes));
  root.querySelectorAll('p:empty').forEach((node) => { node.innerHTML = '<br>'; });
  source = root.innerHTML;
  return source.trim() ? source : '';
}

export function escapeHtml(text) {
  return String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function textToHtml(text) {
  const blocks = String(text || '').replace(/\r\n?/g, '\n').split(/\n{2,}/);
  return blocks.map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>') || '<br>'}</p>`).join('');
}
