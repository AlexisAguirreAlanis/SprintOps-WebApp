import React, { useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import SprintCard from './SprintCard';

const SprintFlow = ({ sprints, onSprintClick, projectId }) => {
  const scrollRef = useRef(null);
  const [isDown, setIsDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e) => {
    setIsDown(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDown(false);
  };

  const handleMouseUp = () => {
    setIsDown(false);
  };

  const handleMouseMove = (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll speed
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  return (
    <div 
      ref={scrollRef}
      onMouseDown={handleMouseDown}
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      data-hide-scrollbar
      className={`w-full flex justify-start items-center gap-12 overflow-x-auto pb-12 pt-8 px-20 no-scrollbar select-none cursor-grab active:cursor-grabbing`}
    >
      <div className="flex items-center gap-12 mx-auto">
        {sprints.map((sprint, index) => (
          <React.Fragment key={sprint.id}>
            <SprintCard sprint={sprint} projectId={projectId} onClick={onSprintClick} />
            {index < sprints.length - 1 && (
              <div className="flex-shrink-0 text-slate-900 mx-4 pointer-events-none">
                <ArrowRight size={56} strokeWidth={4} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default SprintFlow;
