import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import SprintCard from './SprintCard';
import { formatSprintRange, SPRINT_PHASE_LABEL, sprintPhase } from './projectHub';

const SprintFlow = ({ sprints, onSprintClick, projectId, layout = 'flow', statsFor }) => {
  const scrollerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const sync = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
    const cards = [...el.querySelectorAll('.ph-card')];
    const host = el.getBoundingClientRect();
    const mid = host.left + host.width / 2;
    let best = 0;
    let bestDist = Infinity;
    cards.forEach((card, index) => {
      const box = card.getBoundingClientRect();
      const dist = Math.abs(box.left + box.width / 2 - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = index;
      }
    });
    setActiveIndex(best);
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || layout !== 'flow') return undefined;
    const index = sprints.findIndex((sprint) => sprintPhase(sprint) === 'active');
    const card = el.querySelectorAll('.ph-card')[index >= 0 ? index : 0];
    if (card) {
      const host = el.getBoundingClientRect();
      const box = card.getBoundingClientRect();
      el.scrollLeft += box.left - host.left - (host.width - box.width) / 2;
    }
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    return () => {
      el.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [sprints, layout]);

  const scrollToIndex = (index) => {
    const el = scrollerRef.current;
    const card = el?.querySelectorAll('.ph-card')[index];
    if (!el || !card) return;
    const host = el.getBoundingClientRect();
    const box = card.getBoundingClientRect();
    el.scrollBy({ left: box.left - host.left - (host.width - box.width) / 2, behavior: 'smooth' });
  };

  const cards = sprints.map((sprint) => (
    <SprintCard
      key={sprint.id}
      sprint={sprint}
      projectId={projectId}
      onClick={onSprintClick}
      phase={sprintPhase(sprint)}
      range={formatSprintRange(sprint.startDate, sprint.endDate)}
      stats={statsFor ? statsFor(sprint) : null}
    />
  ));

  if (layout === 'grid') {
    return <div className="ph-grid">{cards}</div>;
  }

  if (layout === 'list') {
    return (
      <div className="ph-list">
        {sprints.map((sprint) => {
          const phase = sprintPhase(sprint);
          const stats = statsFor ? statsFor(sprint) : null;
          const range = formatSprintRange(sprint.startDate, sprint.endDate);
          return (
            <button key={sprint.id} type="button" className="ph-row" onClick={() => onSprintClick(sprint.id)}>
              <strong>{sprint.name}</strong>
              <span className={`ph-pill ph-pill--${phase}`}>{SPRINT_PHASE_LABEL[phase]}</span>
              <span>{range || 'Sin fechas'}</span>
              <span>{stats ? (stats.total > 0 ? `${stats.done} / ${stats.total} issues` : '0 issues') : ''}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="ph-flow-wrap" style={{ width: '100%' }}>
      <div className="ph-flow">
        <button type="button" className="ph-nav" aria-label="Sprint anterior" disabled={atStart} onClick={() => scrollToIndex(Math.max(0, activeIndex - 1))}>
          <ChevronLeft size={18} />
        </button>
        <div
          ref={scrollerRef}
          className={`ph-scroller${atStart ? '' : ' has-fade-left'}${atEnd ? '' : ' has-fade-right'}`}
          data-hide-scrollbar
        >
          <div className="ph-track">
            {sprints.map((sprint, index) => (
              <React.Fragment key={sprint.id}>
                {cards[index]}
                {index < sprints.length - 1 && (
                  <div className="ph-link" aria-hidden="true">
                    <span />
                    <ArrowRight size={14} />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
        <button type="button" className="ph-nav" aria-label="Sprint siguiente" disabled={atEnd} onClick={() => scrollToIndex(Math.min(sprints.length - 1, activeIndex + 1))}>
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="ph-dots">
        {sprints.map((sprint, index) => (
          <button
            key={sprint.id}
            type="button"
            className={index === activeIndex ? 'is-active' : ''}
            aria-label={`Ver ${sprint.name}`}
            onClick={() => scrollToIndex(index)}
          />
        ))}
      </div>
    </div>
  );
};

export default SprintFlow;
