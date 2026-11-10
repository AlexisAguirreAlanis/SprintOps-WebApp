import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, CheckCircle2, Circle } from 'lucide-react';
import { timelineRepository } from '../../data/repositories/timelineRepository';
import {
  buildSprintCollageUrls,
  filterPhotoDatesInSprintRange,
  FALLBACK_COLLAGE_IMAGES,
} from './utils/sprintCollagePhotos';
import { SPRINT_PHASE_LABEL } from './projectHub';

const COLLAGE_ORDERS = [
  ['top', 'bottom', 'middle', 'top'],
  ['bottom', 'middle', 'top', 'bottom'],
  ['middle', 'top', 'bottom', 'middle'],
  ['top', 'middle', 'bottom', 'top'],
  ['bottom', 'top', 'middle', 'bottom'],
];

function collageVariant(seed, slot) {
  return COLLAGE_ORDERS[Math.abs(seed) % COLLAGE_ORDERS.length][slot];
}

function lineWidths(seed, slot) {
  const wide = 58 + ((seed * 13 + slot * 17) % 28);
  const narrow = 34 + ((seed * 7 + slot * 19) % 26);
  return [`${wide}%`, `${narrow}%`];
}

function TextLines({ widths }) {
  return (
    <span className="ph-lines">
      {widths.map((width, index) => <span key={index} className="ph-bar" style={{ width }} />)}
    </span>
  );
}

function MiniCard({ variant, src, fallbackIndex, className = '' }) {
  const photo = <CollageSlot src={src} alt="" fallbackIndex={fallbackIndex} className="ph-shot" />;
  const lines = <TextLines widths={lineWidths(fallbackIndex, variant.length)} />;
  return (
    <div className={`ph-mini is-${variant} ${className}`}>
      {variant === 'bottom' && lines}
      {variant === 'middle' && <TextLines widths={[lineWidths(fallbackIndex, 1)[0]]} />}
      {photo}
      {variant === 'top' && lines}
      {variant === 'middle' && lines}
    </div>
  );
}

function CollageSlot({ src, alt, className, style, fallbackIndex }) {
  const fb = FALLBACK_COLLAGE_IMAGES[fallbackIndex % FALLBACK_COLLAGE_IMAGES.length];
  const [current, setCurrent] = useState(src);

  useEffect(() => {
    setCurrent(src);
  }, [src]);

  const onError = useCallback(() => {
    setCurrent((prev) => (prev !== fb ? fb : prev));
  }, [fb]);

  return (
    <img src={current} alt={alt} className={className} style={style} onError={onError} loading="lazy" />
  );
}

const SprintCard = ({ sprint, projectId, onClick, phase = 'planned', range, stats, className = '' }) => {
  const [collageUrls, setCollageUrls] = useState(() => buildSprintCollageUrls(projectId, sprint, []));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!projectId) {
        setCollageUrls(buildSprintCollageUrls(0, sprint, []));
        return;
      }
      try {
        const allDates = await timelineRepository.getPhotoDates(projectId);
        if (cancelled) return;
        const inRange = filterPhotoDatesInSprintRange(allDates, sprint?.startDate, sprint?.endDate);
        setCollageUrls(buildSprintCollageUrls(projectId, sprint, inRange));
      } catch {
        if (!cancelled) setCollageUrls(buildSprintCollageUrls(projectId, sprint, []));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, sprint?.id, sprint?.startDate, sprint?.endDate]);

  const [u0, u1, u2, u3] = collageUrls;
  const seed = Number(sprint.id) || 0;
  const complete = stats && stats.total > 0 && stats.done === stats.total;
  const countLabel = !stats ? null : stats.total > 0 ? `${stats.done} / ${stats.total} issues` : '0 issues';

  return (
    <button
      type="button"
      onClick={() => onClick(sprint.id)}
      className={`ph-card${phase === 'active' ? ' is-current' : ''} ${className}`}
    >
      <div className="ph-card-top">
        <h3>{sprint.name}</h3>
        <span className={`ph-pill ph-pill--${phase}`}>{SPRINT_PHASE_LABEL[phase]}</span>
      </div>
      <div className="ph-preview" aria-hidden="true">
        <MiniCard variant={collageVariant(seed, 0)} src={u0} fallbackIndex={seed * 2} className="is-side" />
        <MiniCard variant={collageVariant(seed, 1)} src={u1} fallbackIndex={seed * 2 + 1} className="is-head" />
        <div className="ph-pair">
          <MiniCard variant={collageVariant(seed, 2)} src={u2} fallbackIndex={seed + 3} />
          <MiniCard variant={collageVariant(seed, 3)} src={u3} fallbackIndex={seed + 5} />
        </div>
      </div>
      <div className="ph-card-foot">
        <span>{range ? <><Calendar size={13} /> {range}</> : 'Sin fechas'}</span>
        {countLabel && (
          <span className="ph-count">
            {complete ? <CheckCircle2 size={14} /> : <Circle size={14} />}
            {countLabel}
          </span>
        )}
      </div>
    </button>
  );
};

export default SprintCard;
