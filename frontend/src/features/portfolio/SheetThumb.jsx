import { textColor } from './portfolioDocument';

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
          return (
            <line
              key={element.id}
              x1={element.x + element.points[0]}
              y1={element.y + element.points[1]}
              x2={element.x + element.points[2]}
              y2={element.y + element.points[3]}
              stroke={element.stroke || '#1e293b'}
              strokeWidth={element.strokeWidth || 2}
            />
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
