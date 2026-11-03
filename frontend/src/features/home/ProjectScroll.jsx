import React, { useLayoutEffect, useRef } from 'react';

const EDGE_EPS = 2;

function computeFadeSize(clientHeight) {
  if (clientHeight <= 0) return 56;
  const proportional = Math.round(clientHeight * 0.11);
  const preferred = Math.min(80, Math.max(52, proportional));
  const maxFit = Math.floor(clientHeight * 0.3);
  return Math.max(20, Math.min(preferred, maxFit));
}

function fadeLength(distance, fadeMax) {
  const range = Math.max(96, fadeMax * 1.35);
  const t = Math.min(1, Math.max(0, distance / range));
  const eased = t * t * (3 - 2 * t);
  return `${Math.round(fadeMax * eased)}px`;
}

/**
 * Scroll de las tarjetas de proyectos.
 * La máscara vive en el viewport. La cápsula la pinta AppScrollbar,
 * fuera de la máscara, para que el desvanecimiento no la recorte.
 */
const ProjectScroll = ({ children }) => {
  const viewportRef = useRef(null);
  const contentRef = useRef(null);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return undefined;

    let alive = true;
    let frame = 0;

    const update = () => {
      frame = 0;
      if (!alive) return;
      const fadeMax = computeFadeSize(viewport.clientHeight);
      const maxScroll = viewport.scrollHeight - viewport.clientHeight;
      const active = maxScroll > EDGE_EPS;
      viewport.style.setProperty('--fade-top', active ? fadeLength(viewport.scrollTop, fadeMax) : '0px');
      viewport.style.setProperty(
        '--fade-bottom',
        active ? fadeLength(maxScroll - viewport.scrollTop, fadeMax) : '0px',
      );
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    const ro = new ResizeObserver(schedule);
    ro.observe(viewport);
    ro.observe(content);
    const mo = new MutationObserver(schedule);
    mo.observe(content, { childList: true });
    viewport.addEventListener('scroll', schedule, { passive: true });
    update();

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      viewport.removeEventListener('scroll', schedule);
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-x-hidden">
      <div
        ref={viewportRef}
        className="scroll-edge-fade no-scrollbar min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pr-4 pb-2"
      >
        <div ref={contentRef} className="min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
};

export default ProjectScroll;
