import { shapeElements } from './editorCatalog';

const ShapeGlyph = ({ id }) => {
  const element = shapeElements(id)[0];
  if (!element) return null;
  if (element.type === 'ellipse') {
    const width = element.width;
    const height = element.height;
    return (
      <svg className="pf-glyph" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <ellipse cx={width / 2} cy={height / 2} rx={width / 2 - 2} ry={height / 2 - 2} fill={element.fill || '#d3eaf8'} stroke={element.stroke || '#1e293b'} strokeWidth={element.strokeWidth || 3} />
      </svg>
    );
  }
  if (element.type === 'line' && element.closed && element.points?.length >= 6) {
    const pairs = [];
    for (let index = 0; index < element.points.length; index += 2) pairs.push(`${element.points[index]},${element.points[index + 1]}`);
    return (
      <svg className="pf-glyph" viewBox={`0 0 ${element.width} ${element.height}`} aria-hidden="true">
        <polygon points={pairs.join(' ')} fill={element.fill || '#f6f1e8'} stroke={element.stroke || '#1e293b'} strokeWidth="3" strokeLinejoin="round" />
      </svg>
    );
  }
  if (element.type === 'line') {
    return (
      <svg className="pf-glyph" viewBox="0 0 180 56" aria-hidden="true">
        <path d="M8 28 H148" fill="none" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" />
        <path d="M140 12 L172 28 L140 44 Z" fill="#1e293b" />
      </svg>
    );
  }
  const radius = element.radius > 80 ? Math.min(element.width, element.height) / 2 : 10;
  return (
    <svg className="pf-glyph" viewBox={`0 0 ${element.width} ${element.height}`} aria-hidden="true">
      <rect x="2" y="2" width={element.width - 4} height={element.height - 4} rx={radius} fill={element.fill || '#ffffff'} stroke="#1e293b" strokeWidth="3" />
    </svg>
  );
};

export default ShapeGlyph;
