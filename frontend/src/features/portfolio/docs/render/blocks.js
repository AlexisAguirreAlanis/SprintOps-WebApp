// Bloques inteligentes y su catálogo para el menú "/".

import { escapeHtml } from '../sanitize';
import { tableHtml } from '../engine/tables';
import { objectHtml } from '../engine/objects';
import { defaultChartSpec } from './charts';
import { defaultDiagramSpec } from './diagrams';
import { calendarHtml } from '../sprintops';

export const callout = (kind, text) => `<div class="wd-callout is-${kind}"><p>${escapeHtml(text)}</p></div><p><br></p>`;

export const progressHtml = (value = 50, label = 'Progreso') => `<div class="wd-progress-block" contenteditable="false" data-value="${value}" data-label="${escapeHtml(label)}"><span>${escapeHtml(label)}</span><div class="wd-progress"><span style="width:${value}%"></span></div><em>${value}%</em></div><p><br></p>`;

export const SLASH_COMMANDS = [
  { id: 'text', label: 'Texto', hint: 'Párrafo normal', keywords: 'parrafo p normal', block: 'P' },
  { id: 'h1', label: 'Encabezado 1', hint: 'Título de sección', keywords: 'titulo heading', block: 'H1' },
  { id: 'h2', label: 'Encabezado 2', hint: 'Subtítulo', keywords: 'heading', block: 'H2' },
  { id: 'h3', label: 'Encabezado 3', hint: 'Subsección', keywords: 'heading', block: 'H3' },
  { id: 'bullets', label: 'Lista con viñetas', hint: 'Lista simple', keywords: 'lista ul', command: 'insertUnorderedList' },
  { id: 'numbers', label: 'Lista numerada', hint: '1, 2, 3', keywords: 'lista ol', command: 'insertOrderedList' },
  { id: 'checklist', label: 'Checklist', hint: 'Tareas con casilla', keywords: 'todo tareas casillas', html: '<ul class="wd-checklist"><li data-checked="false">Tarea</li></ul><p><br></p>' },
  { id: 'quote', label: 'Cita', hint: 'Bloque de cita', keywords: 'quote blockquote', block: 'BLOCKQUOTE' },
  { id: 'code', label: 'Código', hint: 'Bloque de código', keywords: 'code pre', html: '<pre class="wd-code" data-lang="text"><code>código</code></pre><p><br></p>' },
  { id: 'toggle', label: 'Desplegable', hint: 'Contenido plegable', keywords: 'toggle details', html: '<details class="wd-toggle" open><summary>Título del desplegable</summary><p>Contenido</p></details><p><br></p>' },
  { id: 'divider', label: 'Separador', hint: 'Línea horizontal', keywords: 'hr linea', html: '<hr><p><br></p>' },
  { id: 'table', label: 'Tabla', hint: '3 × 3', keywords: 'tabla grid', html: tableHtml(3, 3) },
  { id: 'image', label: 'Imagen', hint: 'Desde el dispositivo', keywords: 'foto picture', action: 'image' },
  { id: 'video', label: 'Video', hint: 'YouTube o archivo', keywords: 'youtube video', action: 'video' },
  { id: 'file', label: 'Archivo', hint: 'Adjuntar archivo', keywords: 'adjunto attachment', action: 'file' },
  { id: 'info', label: 'Alerta', hint: 'Nota informativa', keywords: 'callout info nota', html: callout('info', 'Nota importante.') },
  { id: 'warn', label: 'Advertencia', hint: 'Llamado de atención', keywords: 'warning cuidado', html: callout('warn', 'Advertencia.') },
  { id: 'success', label: 'Éxito', hint: 'Mensaje positivo', keywords: 'ok success', html: callout('success', 'Listo.') },
  { id: 'error', label: 'Error', hint: 'Mensaje de error', keywords: 'error danger', html: callout('error', 'Error.') },
  { id: 'task', label: 'Tarea', hint: 'Elemento de checklist', keywords: 'task todo', html: '<ul class="wd-checklist"><li data-checked="false">Nueva tarea</li></ul><p><br></p>' },
  { id: 'issue', label: 'Issue', hint: 'Referenciar un issue', keywords: 'issue sprintops referencia', action: 'mention-issue' },
  { id: 'metrics', label: 'Métricas', hint: 'Métricas del proyecto', keywords: 'kpi metricas', action: 'live-metrics' },
  { id: 'issues-table', label: 'Tabla de issues', hint: 'Issues del proyecto', keywords: 'issues tabla backlog', action: 'live-issues' },
  { id: 'progress', label: 'Barra de progreso', hint: 'Avance editable', keywords: 'progreso barra', html: progressHtml(50) },
  { id: 'calendar', label: 'Calendario', hint: 'Mes actual', keywords: 'calendario mes', html: () => `${calendarHtml(new Date().getFullYear(), new Date().getMonth())}<p><br></p>` },
  { id: 'diagram', label: 'Diagrama', hint: 'Proceso, jerarquía, ciclo…', keywords: 'smartart diagrama', html: () => objectHtml('diagram', defaultDiagramSpec('process'), { width: 620, height: 160, wrap: 'topbottom' }) },
  { id: 'chart', label: 'Gráfico', hint: 'Columnas editables', keywords: 'grafico chart', html: () => objectHtml('chart', defaultChartSpec('column'), { width: 560, height: 332, wrap: 'topbottom' }) },
  { id: 'equation', label: 'Ecuación', hint: 'Fórmula matemática', keywords: 'ecuacion formula matematica', action: 'equation' },
  { id: 'latex', label: 'LaTeX', hint: 'Bloque LaTeX', keywords: 'latex tex katex', action: 'equation' },
  { id: 'mermaid', label: 'Mermaid', hint: 'Diagrama desde código', keywords: 'mermaid flowchart', action: 'mermaid' },
  { id: 'toc', label: 'Tabla de contenido', hint: 'Índice automático', keywords: 'indice toc contenido', action: 'toc' },
  { id: 'pagebreak', label: 'Salto de página', hint: 'Nueva página', keywords: 'salto pagina break', html: '<hr class="wd-break"><p><br></p>' },
  { id: 'ai', label: 'Escribir con IA', hint: 'Genera contenido', keywords: 'ia ai generar', action: 'ai' },
];

export const COVERS = [
  { id: 'band', label: 'Banda', html: (t) => `<div class="wd-cover wd-cover-band"><div class="wd-cover-bar"></div><h1 class="wd-style-title">${t}</h1><p class="wd-style-subtitle">Subtítulo del documento</p><p class="wd-cover-meta">Autor · ${new Date().getFullYear()}</p></div><hr class="wd-break">` },
  { id: 'center', label: 'Centrada', html: (t) => `<div class="wd-cover wd-cover-center"><p class="wd-cover-kicker">PISTACHE SPRINTOPS</p><h1 class="wd-style-title">${t}</h1><hr><p class="wd-style-subtitle">Subtítulo</p><p class="wd-cover-meta">Fecha</p></div><hr class="wd-break">` },
  { id: 'block', label: 'Bloque de color', html: (t) => `<div class="wd-cover wd-cover-block"><h1 class="wd-style-title">${t}</h1><p class="wd-style-subtitle">Resumen en una línea</p></div><p class="wd-cover-meta">Preparado por · Equipo</p><hr class="wd-break">` },
  { id: 'minimal', label: 'Minimalista', html: (t) => `<div class="wd-cover wd-cover-minimal"><p class="wd-cover-meta">${new Date().getFullYear()}</p><h1 class="wd-style-title">${t}</h1><p class="wd-style-subtitle">Versión 1.0</p></div><hr class="wd-break">` },
];

export const SYMBOLS = '© ® ™ § ¶ † ‡ • … ‰ ′ ″ ‹ › « » “ ” ‘ ’ – — ± × ÷ ≠ ≈ ≤ ≥ ∞ √ ∑ ∏ ∫ ∂ ∆ ∇ ∈ ∉ ∩ ∪ ⊂ ⊃ ∀ ∃ ¬ ∧ ∨ → ← ↑ ↓ ↔ ⇒ ⇔ α β γ δ ε θ λ μ π σ φ ω Ω € £ ¥ ¢ ₿ ° ½ ¼ ¾ ¹ ² ³ ✓ ✗ ★ ☆ ♥ ♦ ♣ ♠ ☐ ☑ ☒ ✉ ☎ ⌘ ⌥ ⇧'.split(' ');

export const SPECIAL_CHARS = [
  ['\u2014', 'Raya (—)'], ['\u2013', 'Guion corto (–)'], ['\u00a0', 'Espacio de no separación'], ['\u2011', 'Guion de no separación'],
  ['\u00ad', 'Guion opcional'], ['\u2009', 'Espacio fino'], ['\u2003', 'Espacio largo'], ['\u200b', 'Espacio de ancho cero'],
  ['\u00a7', 'Sección (§)'], ['\u00b6', 'Párrafo (¶)'], ['\u2026', 'Puntos suspensivos'], ['\u00bf', 'Apertura de interrogación'], ['\u00a1', 'Apertura de exclamación'],
];

export const EMOJIS = '😀 😃 😄 😁 😆 😅 😂 🙂 😉 😊 😍 🤩 😎 🤔 😐 😴 😮 😢 😭 😡 👍 👎 👏 🙌 🙏 💪 👀 🎉 🎯 🚀 ⭐ 🔥 💡 ✅ ❌ ⚠️ ❓ ❗ 📌 📎 📝 📅 📊 📈 📉 🗂️ 📁 🔒 🔑 🧩 🛠️ ⚙️ 🐛 💻 📱 ☁️ 🌱 🥑 🍕 ☕ ❤️ 💚 💙 💜 🧡 💛'.split(' ');
