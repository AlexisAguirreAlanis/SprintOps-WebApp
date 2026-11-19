import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export default function ProjectPhaseTabs({
  phases,
  tab,
  counts,
  onChange,
  ariaLabel = 'Filtrar por estado',
}) {
  const railRef = useRef(null);
  const tabRefs = useRef({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  const measure = useCallback(() => {
    const rail = railRef.current;
    const active = tabRefs.current[tab];
    if (!rail || !active) return;
    const railBox = rail.getBoundingClientRect();
    const tabBox = active.getBoundingClientRect();
    setIndicator({
      left: tabBox.left - railBox.left + rail.scrollLeft,
      width: tabBox.width,
      ready: true,
    });
  }, [tab]);

  useLayoutEffect(() => {
    measure();
    const rail = railRef.current;
    if (!rail) return undefined;
    const observer = new ResizeObserver(() => measure());
    observer.observe(rail);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure, counts, phases]);

  return (
    <div className="ps-tabs ps-tabs--slide" role="tablist" aria-label={ariaLabel} ref={railRef}>
      <span
        className={`ps-tab-indicator${indicator.ready ? ' is-ready' : ''}`}
        aria-hidden="true"
        style={{ width: indicator.width, transform: `translateX(${indicator.left}px)` }}
      />
      {phases.map((phase) => (
        <button
          key={phase.id}
          type="button"
          role="tab"
          aria-selected={tab === phase.id}
          className={tab === phase.id ? 'is-active' : ''}
          ref={(el) => { tabRefs.current[phase.id] = el; }}
          onClick={() => onChange(phase.id)}
        >
          {phase.label}
          {counts != null ? <span>{counts[phase.id] || 0}</span> : null}
        </button>
      ))}
    </div>
  );
}
