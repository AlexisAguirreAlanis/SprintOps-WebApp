const FREE = (license) => {
  const value = String(license || '').toLowerCase();
  if (!value || value.includes('nc') || value.includes('nd')) return false;
  return value.includes('cc0') || value.includes('cc by') || value.includes('public domain') || value === 'pd';
};

export async function searchCommons(query, kind) {
  const text = query.trim();
  if (!text) return [];
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', kind === 'video' ? `${text} filetype:video` : text);
  url.searchParams.set('gsrlimit', '18');
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|mime|extmetadata');
  url.searchParams.set('iiurlwidth', '480');
  const response = await fetch(url);
  if (!response.ok) throw new Error('No se pudo buscar en Wikimedia Commons.');
  const data = await response.json();
  const pages = Object.values(data.query?.pages || {});
  return pages.flatMap((page) => {
    const info = page.imageinfo?.[0];
    if (!info) return [];
    const license = info.extmetadata?.LicenseShortName?.value || '';
    const mime = info.mime || '';
    const wanted = kind === 'video' ? mime.startsWith('video/') : mime.startsWith('image/');
    if (!wanted || !FREE(license)) return [];
    const title = String(page.title || '').replace(/^File:/, '');
    return [{
      title,
      mime,
      license,
      src: kind === 'video' ? info.url : (info.thumburl || info.url),
      poster: info.thumburl || '',
      credit: `${title} · ${license} · Wikimedia Commons`,
    }];
  });
}

export function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve({ src: canvas.toDataURL('image/jpeg', 0.82), width: canvas.width, height: canvas.height });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen.'));
    };
    image.src = url;
  });
}
