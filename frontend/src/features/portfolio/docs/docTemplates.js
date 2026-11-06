// Plantillas de documento de SprintOps. Cada una produce el modelo de documento inicial.

const table = (head, rows = 2) => `<table><tbody><tr>${head.map((cell) => `<th>${cell}</th>`).join('')}</tr>${
  Array.from({ length: rows }, () => `<tr>${head.map(() => '<td><br></td>').join('')}</tr>`).join('')
}</tbody></table>`;

const meta = (pairs) => pairs.map(([label, value = '']) => `<p><strong>${label}:</strong> ${value}</p>`).join('');

const checklist = (items) => `<ul class="wd-checklist">${items.map((item) => `<li data-checked="false">${item}</li>`).join('')}</ul>`;

const callout = (kind, html) => `<div class="wd-callout is-${kind}"><p>${html}</p></div>`;

function doc(html, extra = {}) {
  return { pageSize: 'letter', margins: { top: 96, right: 96, bottom: 96, left: 96 }, header: '', footer: '', pageNumbers: true, pages: [{ id: 'page-1', html }], ...extra };
}

const ENTRIES = [
  ['doc-sprint-planning', 'Sprint Planning', 'Objetivo, capacidad y compromiso del sprint.', `
    <h1>Sprint Planning</h1>${meta([['Sprint'], ['Fechas'], ['Facilitador']])}
    <h2>Objetivo del sprint</h2><p>Qué valor entregamos al terminar el sprint.</p>
    <h2>Capacidad del equipo</h2>${table(['Persona', 'Días disponibles', 'Horas'], 3)}
    <h2>Backlog comprometido</h2>${table(['Issue', 'Puntos', 'Responsable', 'Prioridad'], 4)}
    <h2>Riesgos y dependencias</h2><ul><li>Dependencia externa.</li></ul>
    <h2>Definición de terminado</h2>${checklist(['Código revisado', 'Pruebas pasando', 'Documentación actualizada'])}`],
  ['doc-sprint-review', 'Sprint Review', 'Qué se entregó y qué opinan los interesados.', `
    <h1>Sprint Review</h1>${meta([['Sprint'], ['Fecha'], ['Asistentes']])}
    <h2>Objetivo y resultado</h2><p>¿Se cumplió el objetivo del sprint?</p>
    <h2>Entregado</h2>${table(['Issue', 'Estado', 'Demo'], 3)}
    <h2>No entregado</h2><ul><li>Issue y motivo.</li></ul>
    <h2>Retroalimentación</h2><ul><li>Comentario del interesado.</li></ul>
    <h2>Ajustes al backlog</h2><ol><li>Cambio propuesto.</li></ol>`],
  ['doc-sprint-retro', 'Sprint Retrospective', 'Qué funcionó, qué no y qué cambiamos.', `
    <h1>Sprint Retrospective</h1>${meta([['Sprint'], ['Fecha']])}
    ${callout('info', 'Ambiente seguro: hablamos de procesos, no de personas.')}
    <h2>Qué funcionó</h2><ul><li><br></li></ul>
    <h2>Qué no funcionó</h2><ul><li><br></li></ul>
    <h2>Ideas</h2><ul><li><br></li></ul>
    <h2>Acciones</h2>${table(['Acción', 'Responsable', 'Fecha'], 3)}`],
  ['doc-daily', 'Daily Standup', 'Ayer, hoy y bloqueos de cada persona.', `
    <h1>Daily Standup</h1>${meta([['Fecha'], ['Sprint']])}
    ${table(['Persona', 'Ayer', 'Hoy', 'Bloqueos'], 4)}
    <h2>Bloqueos a escalar</h2>${checklist(['Bloqueo y quién lo resuelve'])}`],
  ['doc-prd', 'Product Requirements Document', 'Problema, usuarios, requisitos y métricas.', `
    <h1>Product Requirements Document</h1>${meta([['Producto'], ['Autor'], ['Estado', 'Borrador'], ['Versión', '0.1']])}
    <h2>1. Problema</h2><p>Qué duele hoy y a quién.</p>
    <h2>2. Objetivos y métricas</h2>${table(['Objetivo', 'Métrica', 'Meta'], 2)}
    <h2>3. Usuarios</h2><ul><li>Persona principal y su necesidad.</li></ul>
    <h2>4. Requisitos</h2>${table(['ID', 'Requisito', 'Prioridad', 'Notas'], 4)}
    <h2>5. Fuera de alcance</h2><ul><li><br></li></ul>
    <h2>6. Preguntas abiertas</h2><ol><li><br></li></ol>`],
  ['doc-srs', 'Software Requirements Specification', 'Especificación formal de requisitos (IEEE 830).', `
    <h1>Especificación de Requisitos de Software</h1>${meta([['Proyecto'], ['Versión', '1.0'], ['Fecha']])}
    <h2>1. Introducción</h2><h3>1.1 Propósito</h3><p><br></p><h3>1.2 Alcance</h3><p><br></p><h3>1.3 Definiciones</h3>${table(['Término', 'Definición'], 2)}
    <h2>2. Descripción general</h2><h3>2.1 Perspectiva del producto</h3><p><br></p><h3>2.2 Restricciones</h3><ul><li><br></li></ul>
    <h2>3. Requisitos funcionales</h2>${table(['RF', 'Descripción', 'Prioridad', 'Criterio de aceptación'], 4)}
    <h2>4. Requisitos no funcionales</h2>${table(['RNF', 'Categoría', 'Descripción'], 3)}
    <h2>5. Interfaces externas</h2><p><br></p>`],
  ['doc-techdoc', 'Documentación técnica', 'Propósito, componentes, instalación y uso.', `
    <h1>Documentación técnica</h1>
    <h2>Propósito</h2><p><br></p>
    <h2>Arquitectura</h2><p>Componentes principales y cómo se comunican.</p>
    <h2>Instalación</h2><pre class="wd-code" data-lang="bash"><code>npm install</code></pre>
    <h2>Configuración</h2>${table(['Variable', 'Descripción', 'Valor por defecto'], 3)}
    <h2>Uso</h2><p><br></p>
    <h2>Solución de problemas</h2>${callout('warn', 'Errores comunes y cómo resolverlos.')}`],
  ['doc-api', 'Documentación de API', 'Endpoints, parámetros, respuestas y errores.', `
    <h1>Documentación de API</h1>${meta([['Base URL', '/api'], ['Autenticación'], ['Versión', 'v1']])}
    <h2>GET /recurso</h2><p>Descripción del endpoint.</p>
    <h3>Parámetros</h3>${table(['Nombre', 'Tipo', 'Requerido', 'Descripción'], 2)}
    <h3>Respuesta</h3><pre class="wd-code" data-lang="json"><code>{ "id": 1 }</code></pre>
    <h3>Errores</h3>${table(['Código', 'Significado'], 2)}`],
  ['doc-adr', 'Registro de decisiones', 'Contexto, decisión y consecuencias (ADR).', `
    <h1>ADR-001: Título de la decisión</h1>${meta([['Estado', 'Propuesta'], ['Fecha'], ['Decisores']])}
    <h2>Contexto</h2><p>Qué fuerza esta decisión.</p>
    <h2>Opciones consideradas</h2>${table(['Opción', 'Ventajas', 'Desventajas'], 3)}
    <h2>Decisión</h2><p><br></p>
    <h2>Consecuencias</h2><ul><li><br></li></ul>`],
  ['doc-bug', 'Reporte de errores', 'Pasos, resultado esperado y evidencia.', `
    <h1>Reporte de error</h1>${meta([['ID'], ['Severidad', 'Media'], ['Entorno'], ['Reportado por']])}
    <h2>Resumen</h2><p><br></p>
    <h2>Pasos para reproducir</h2><ol><li><br></li></ol>
    <h2>Resultado esperado</h2><p><br></p>
    <h2>Resultado actual</h2><p><br></p>
    <h2>Evidencia</h2><p>Capturas o registros.</p>`],
  ['doc-progress', 'Reporte de avance', 'Estado, logros, bloqueos y próximos pasos.', `
    <h1>Reporte de avance</h1>${meta([['Periodo'], ['Proyecto'], ['Estado general', 'En curso']])}
    <h2>Resumen</h2><p><br></p>
    <h2>Logros</h2><ul><li><br></li></ul>
    <h2>Indicadores</h2>${table(['Indicador', 'Plan', 'Real'], 3)}
    <h2>Bloqueos</h2><ul><li><br></li></ul>
    <h2>Próximos pasos</h2><ol><li><br></li></ol>`],
  ['doc-sprint-report', 'Reporte de sprint', 'Resultados, métricas y aprendizajes del sprint.', `
    <h1>Reporte de sprint</h1>${meta([['Sprint'], ['Fechas'], ['Objetivo']])}
    <h2>Métricas</h2>${table(['Métrica', 'Valor'], 4)}
    <h2>Issues completados</h2><ul><li><br></li></ul>
    <h2>Issues movidos al siguiente sprint</h2><ul><li><br></li></ul>
    <h2>Aprendizajes</h2><p><br></p>`],
  ['doc-user-manual', 'Manual de usuario', 'Guía paso a paso para quien usa el producto.', `
    <h1>Manual de usuario</h1>
    <h2>Introducción</h2><p>Para quién es este manual.</p>
    <h2>Primeros pasos</h2><ol><li>Inicia sesión.</li><li>Configura tu perfil.</li></ol>
    <h2>Funciones principales</h2><h3>Función 1</h3><p><br></p>
    ${callout('success', 'Consejo: atajos y buenas prácticas.')}
    <h2>Preguntas frecuentes</h2><details class="wd-toggle"><summary>¿Pregunta?</summary><p>Respuesta.</p></details>`],
  ['doc-tech-manual', 'Manual técnico', 'Operación, mantenimiento y despliegue.', `
    <h1>Manual técnico</h1>
    <h2>Requisitos del sistema</h2>${table(['Componente', 'Versión'], 3)}
    <h2>Despliegue</h2><ol><li><br></li></ol>
    <h2>Monitoreo</h2><p><br></p>
    <h2>Respaldo y recuperación</h2><p><br></p>
    <h2>Mantenimiento</h2>${checklist(['Actualizar dependencias', 'Rotar credenciales'])}`],
  ['doc-test-plan', 'Plan de pruebas', 'Alcance, estrategia, entorno y criterios.', `
    <h1>Plan de pruebas</h1>${meta([['Proyecto'], ['Versión'], ['Responsable']])}
    <h2>Alcance</h2><p><br></p>
    <h2>Estrategia</h2>${table(['Tipo de prueba', 'Herramienta', 'Responsable'], 3)}
    <h2>Entorno</h2><p><br></p>
    <h2>Criterios de entrada y salida</h2><ul><li><br></li></ul>
    <h2>Cronograma</h2>${table(['Actividad', 'Inicio', 'Fin'], 3)}`],
  ['doc-test-cases', 'Casos de prueba', 'Pasos, datos y resultado esperado.', `
    <h1>Casos de prueba</h1>
    ${table(['ID', 'Descripción', 'Pasos', 'Datos', 'Esperado', 'Resultado'], 5)}`],
  ['doc-risks', 'Análisis de riesgos', 'Probabilidad, impacto y mitigación.', `
    <h1>Análisis de riesgos</h1>${meta([['Proyecto'], ['Fecha']])}
    ${table(['Riesgo', 'Probabilidad', 'Impacto', 'Mitigación', 'Responsable'], 4)}
    <h2>Plan de contingencia</h2><p><br></p>`],
  ['doc-architecture', 'Documento de arquitectura', 'Vistas, decisiones y atributos de calidad.', `
    <h1>Documento de arquitectura</h1>
    <h2>Contexto</h2><p><br></p>
    <h2>Vista de componentes</h2><figure class="wd-mermaid" contenteditable="false" data-code="graph LR&#10;  Cliente --> API&#10;  API --> BD[(Base de datos)]"></figure>
    <h2>Decisiones</h2><ul><li><br></li></ul>
    <h2>Atributos de calidad</h2>${table(['Atributo', 'Escenario', 'Táctica'], 3)}
    <h2>Riesgos técnicos</h2><ul><li><br></li></ul>`],
  ['doc-research', 'Informe de investigación', 'Pregunta, método, hallazgos y conclusiones.', `
    <h1>Informe de investigación</h1>${meta([['Autor'], ['Fecha']])}
    <h2>Resumen</h2><p><br></p>
    <h2>Pregunta de investigación</h2><p><br></p>
    <h2>Metodología</h2><p><br></p>
    <h2>Hallazgos</h2><ol><li><br></li></ol>
    <h2>Conclusiones</h2><p><br></p>
    <h2>Referencias</h2><p><br></p>`],
];

export const DOC_TEMPLATES = ENTRIES.map(([id, name, blurb, html]) => ({
  id,
  name,
  kind: 'document',
  category: 'documents',
  strip: false,
  blurb,
  buildDoc: () => doc(html.trim()),
}));
