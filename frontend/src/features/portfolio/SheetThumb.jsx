import { useId } from 'react';
import { arrowPath, isArrow, textColor } from './portfolioDocument';
import { headKind, lineCount, parallelCopies } from './connectorGeometry';

const SheetThumb = ({ elements = [], className = '' }) => {
  const clipBase = useId().replace(/:/g, '');
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
      {visible.map((element, index) => {
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
          const copies = element.closed ? [world] : parallelCopies(world, lineCount(element), (element.strokeWidth || 2) + 4);
          return (
            <g key={element.id}>
              {copies.map((copy, index) => (
                element.closed ? (
                  <polygon key={index} points={copy.join(' ')} fill={element.fill && element.fill !== 'transparent' ? element.fill : 'none'} stroke={stroke} strokeWidth={element.strokeWidth || 2} />
                ) : (
                  <polyline key={index} points={copy.join(' ')} fill="none" stroke={stroke} strokeWidth={element.strokeWidth || 2} />
                )
              ))}
              {isArrow(element) && headKind(element, true) !== 'none' && (
                <polygon points={`${x2},${y2} ${baseX - uy * 6},${baseY + ux * 6} ${baseX + uy * 6},${baseY - ux * 6}`} fill={stroke} />
              )}
            </g>
          );
        }
        if (element.type === 'text') {
          const size = Math.max(8, Number(element.fontSize) || 16);
          const weight = element.fontWeight || 600;
          const anchor = element.align === 'center' ? 'middle' : element.align === 'right' ? 'end' : 'start';
          const origin = element.align === 'center' ? element.x + element.width / 2 : element.align === 'right' ? element.x + element.width - 4 : element.x + 4;
          const lines = wrapThumbText(element.text || '', size, element.width, element.height);
          const clipId = `${clipBase}-${element.id || index}`;
          return (
            <g key={element.id || index} clipPath={`url(#${clipId})`}>
              <clipPath id={clipId}>
                <rect x={element.x} y={element.y} width={Math.max(8, element.width)} height={Math.max(8, element.height)} />
              </clipPath>
              <text x={origin} y={element.y + size} fill={textColor(element)} fontSize={size} fontWeight={weight} textAnchor={anchor}>
                {lines.map((line, index) => (
                  <tspan key={index} x={origin} dy={index === 0 ? 0 : size * 1.25}>{line}</tspan>
                ))}
              </text>
            </g>
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

function wrapThumbText(text, fontSize, width, height) {
  const maxChars = Math.max(4, Math.floor((width || 80) / (fontSize * 0.56)));
  const maxLines = Math.max(1, Math.floor((height || fontSize) / (fontSize * 1.25)));
  const words = String(text).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const chunk = word.length > maxChars ? `${word.slice(0, maxChars - 1)}…` : word;
    const next = line ? `${line} ${chunk}` : chunk;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = chunk;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

export default SheetThumb;
