import React, { useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

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
  const [edges, setEdges] = useState({ up: false, down: false });

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
      const next = { up: viewport.scrollTop > EDGE_EPS, down: active && maxScroll - viewport.scrollTop > EDGE_EPS };
      setEdges((current) => (current.up === next.up && current.down === next.down ? current : next));
    };

    const nudge = (direction) => {
      viewport.scrollBy({
        top: direction * Math.round(viewport.clientHeight * 0.72),
        behavior: 'smooth',
      });
    };
    viewportRef.current.nudge = nudge;

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

  const nudge = (direction) => viewportRef.current?.nudge?.(direction);

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 overflow-x-hidden">
      <div
        ref={viewportRef}
        className="scroll-edge-fade no-scrollbar min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pr-4"
      >
        <div ref={contentRef} className="min-w-0 px-2 pb-10 pt-3">
          {children}
        </div>
      </div>
      {edges.up && (
        <button type="button" className="ps-scroll-arrow is-up" aria-label="Proyectos anteriores" onClick={() => nudge(-1)}>
          <ChevronUp size={16} />
        </button>
      )}
      {edges.down && (
        <button type="button" className="ps-scroll-arrow is-down" aria-label="Más proyectos" onClick={() => nudge(1)}>
          <ChevronDown size={16} />
        </button>
      )}
    </div>
  );
};

export default ProjectScroll;
