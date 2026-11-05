import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, CheckCircle2, Circle } from 'lucide-react';
import { timelineRepository } from '../../data/repositories/timelineRepository';
import {
  buildSprintCollageUrls,
  filterPhotoDatesInSprintRange,
  FALLBACK_COLLAGE_IMAGES,
} from './utils/sprintCollagePhotos';
import { SPRINT_PHASE_LABEL } from './projectHub';

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
        <div className="ph-preview-side">
          <CollageSlot src={u0} alt="" fallbackIndex={seed * 2} className="ph-shot" />
          <span className="ph-bar" style={{ height: 8, width: '75%' }} />
          <span className="ph-bar" style={{ height: 8, width: '50%' }} />
        </div>
        <div className="ph-preview-main">
          <div className="ph-tile" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 }}>
            <CollageSlot src={u1} alt="" fallbackIndex={seed * 2 + 1} className="ph-shot" style={{ width: 42 }} />
            <span style={{ display: 'grid', gap: 6, flex: 1 }}>
              <span className="ph-bar" style={{ height: 7, width: '80%' }} />
              <span className="ph-bar" style={{ height: 7, width: '45%' }} />
            </span>
          </div>
          <div className="ph-pair">
            <div className="ph-tile">
              <CollageSlot src={u2} alt="" fallbackIndex={seed + 3} />
              <span className="ph-bar" />
            </div>
            <div className="ph-tile">
              <CollageSlot src={u3} alt="" fallbackIndex={seed + 5} />
              <span className="ph-bar" />
            </div>
          </div>
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
