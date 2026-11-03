import { arrowPath, isArrow, textColor } from './portfolioDocument';

const SheetThumb = ({ elements = [], className = '' }) => {
  const visible = elements.filter((element) => element.visible !== false);
  if (visible.length === 0) {
    return <div className={`pf-thumb pf-thumb-empty ${className}`} />;
  }
  const boxes = visible.map((element) => {
    if (element.type === 'line' && element.points?.length >= 4) {
      const xs = [];
      const ys = [];
      for (let index = 0; index < element.points.length; index += 2) {
        xs.push(element.x + element.points[index]);
        ys.push(element.y + element.points[index + 1]);
      }
      return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    }
    return { x: element.x, y: element.y, width: element.width, height: element.height };
  });
  const x = Math.min(...boxes.map((box) => box.x)) - 24;
  const y = Math.min(...boxes.map((box) => box.y)) - 24;
  const right = Math.max(...boxes.map((box) => box.x + box.width)) + 24;
  const bottom = Math.max(...boxes.map((box) => box.y + box.height)) + 24;

  return (
    <svg className={`pf-thumb ${className}`} viewBox={`${x} ${y} ${Math.max(40, right - x)} ${Math.max(40, bottom - y)}`}>
      {visible.map((element) => {
        if (element.type === 'line' && element.points?.length >= 4) {
          const local = isArrow(element) ? arrowPath(element).points : element.points;
          const world = [];
          for (let index = 0; index < local.length; index += 2) {
            world.push(element.x + local[index], element.y + local[index + 1]);
          }
          const x2 = world[world.length - 2];
          const y2 = world[world.length - 1];
          const x1 = world[world.length - 4];
          const y1 = world[world.length - 3];
          const dx = x2 - x1;
          const dy = y2 - y1;
          const length = Math.hypot(dx, dy) || 1;
          const ux = dx / length;
          const uy = dy / length;
          const baseX = x2 - ux * 11;
          const baseY = y2 - uy * 11;
          const stroke = element.stroke || '#1e293b';
          const points = world.join(' ');
          return (
            <g key={element.id}>
              {element.closed ? (
                <polygon points={points} fill={element.fill && element.fill !== 'transparent' ? element.fill : 'none'} stroke={stroke} strokeWidth={element.strokeWidth || 2} />
              ) : (
                <polyline points={points} fill="none" stroke={stroke} strokeWidth={element.strokeWidth || 2} />
              )}
              {isArrow(element) && (
                <polygon points={`${x2},${y2} ${baseX - uy * 6},${baseY + ux * 6} ${baseX + uy * 6},${baseY - ux * 6}`} fill={stroke} />
              )}
            </g>
          );
        }
        if (element.type === 'text') {
          return (
            <text key={element.id} x={element.x} y={element.y + (element.fontSize || 16)} fill={textColor(element)} fontSize={element.fontSize || 16} fontWeight={element.fontWeight || 600}>
              {(element.text || '').slice(0, 32)}
            </text>
          );
        }
        if (element.type === 'ellipse') {
          return (
            <ellipse
              key={element.id}
              cx={element.x + element.width / 2}
              cy={element.y + element.height / 2}
              rx={element.width / 2}
              ry={element.height / 2}
              fill={element.fill || '#ffffff'}
              stroke={element.stroke && element.stroke !== 'transparent' ? element.stroke : 'none'}
              strokeWidth={element.strokeWidth || 0}
            />
          );
        }
        return (
          <rect
            key={element.id}
            x={element.x}
            y={element.y}
            width={element.width}
            height={element.height}
            rx={element.radius || 0}
            fill={element.fill || '#ffffff'}
            stroke={element.stroke && element.stroke !== 'transparent' ? element.stroke : 'none'}
            strokeWidth={element.strokeWidth || 0}
          />
        );
      })}
    </svg>
  );
};

export default SheetThumb;
