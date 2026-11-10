const sans = (name) => [`"${name}", sans-serif`, name, true];
const serif = (name) => [`"${name}", serif`, name, true];
const mono = (name) => [`"${name}", monospace`, name, true];
const hand = (name) => [`"${name}", cursive`, name, true];

const GOOGLE = [
  serif('Alegreya'), sans('Alegreya Sans'), hand('Amatic SC'), serif('Andada Pro'), sans('Anton'),
  sans('Archivo'), sans('Archivo Narrow'), sans('Arimo'), sans('Asap'), sans('Atkinson Hyperlegible'),
  sans('Barlow'), sans('Bebas Neue'), serif('Bitter'), sans('Cabin'), sans('Cairo'), sans('Cantarell'),
  serif('Cardo'), sans('Carlito'), sans('Catamaran'), hand('Caveat'), sans('Comfortaa'), sans('Commissioner'),
  serif('Cormorant Garamond'), serif('Crimson Pro'), sans('DM Sans'), serif('DM Serif Display'), hand('Dancing Script'),
  serif('Domine'), serif('EB Garamond'), sans('Exo 2'), sans('Figtree'), mono('Fira Code'), sans('Fira Sans'),
  serif('Fraunces'), serif('Gentium Plus'), hand('Great Vibes'), sans('Hind'), mono('IBM Plex Mono'),
  sans('IBM Plex Sans'), serif('IBM Plex Serif'), mono('Inconsolata'), hand('Indie Flower'), sans('Inter'),
  sans('Josefin Sans'), serif('Josefin Slab'), sans('Jost'), sans('Karla'), sans('Lato'), sans('Lexend'),
  serif('Libre Baskerville'), sans('Libre Franklin'), serif('Literata'), hand('Lobster'), serif('Lora'),
  sans('Manrope'), serif('Merriweather'), sans('Montserrat'), sans('Mukta'), sans('Mulish'), serif('Newsreader'),
  sans('Noto Sans'), serif('Noto Serif'), sans('Nunito'), sans('Nunito Sans'), sans('Open Sans'), sans('Oswald'),
  sans('Outfit'), sans('PT Sans'), serif('PT Serif'), hand('Pacifico'), hand('Permanent Marker'), serif('Petrona'),
  serif('Playfair Display'), sans('Poppins'), sans('Public Sans'), sans('Quicksand'), sans('Raleway'),
  sans('Red Hat Display'), sans('Red Hat Text'), sans('Roboto'), sans('Roboto Condensed'), mono('Roboto Mono'),
  serif('Roboto Slab'), sans('Rubik'), sans('Signika'), sans('Sora'), mono('Source Code Pro'), sans('Source Sans 3'),
  serif('Source Serif 4'), sans('Space Grotesk'), mono('Space Mono'), serif('Spectral'), sans('Teko'),
  sans('Ubuntu'), mono('Ubuntu Mono'), serif('Vollkorn'), sans('Work Sans'), serif('Zilla Slab'),
];

const SYSTEM = [
  ['Arial, Helvetica, sans-serif', 'Arial'],
  ['"Avenir Next", Avenir, sans-serif', 'Avenir'],
  ['Baskerville, "Palatino Linotype", serif', 'Baskerville'],
  ['"Comic Sans MS", "Comic Neue", cursive', 'Comic Sans'],
  ['"Courier New", Courier, monospace', 'Courier New'],
  ['Didot, "Bodoni MT", serif', 'Didot'],
  ['Futura, "Trebuchet MS", sans-serif', 'Futura'],
  ['Georgia, "Times New Roman", serif', 'Georgia'],
  ['"Gill Sans", "Gill Sans MT", sans-serif', 'Gill Sans'],
  ['"Helvetica Neue", Helvetica, Arial, sans-serif', 'Helvetica'],
  ['Impact, "Arial Narrow", sans-serif', 'Impact'],
  ['Menlo, Consolas, monospace', 'Menlo'],
  ['Monaco, Consolas, monospace', 'Monaco'],
  ['Optima, Candara, sans-serif', 'Optima'],
  ['Palatino, "Palatino Linotype", serif', 'Palatino'],
  ['Tahoma, Geneva, sans-serif', 'Tahoma'],
  ['"Times New Roman", Times, serif', 'Times New Roman'],
  ['"Trebuchet MS", sans-serif', 'Trebuchet'],
  ['Verdana, Geneva, sans-serif', 'Verdana'],
];

export const FONTS = [...GOOGLE.map(([stack, name]) => [stack, name]), ...SYSTEM].sort((a, b) => a[1].localeCompare(b[1], 'es'));

export function ensureFonts() {
  if (typeof document === 'undefined' || document.getElementById('wd-fonts')) return;
  const names = GOOGLE.map(([, name]) => name);
  for (let index = 0; index < names.length; index += 40) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.id = index === 0 ? 'wd-fonts' : `wd-fonts-${index}`;
    link.href = `https://fonts.googleapis.com/css2?${names.slice(index, index + 40).map((name) => `family=${name.replace(/ /g, '+')}`).join('&')}&display=swap`;
    document.head.appendChild(link);
  }
}
