import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Box } from 'lucide-react';

const handleStyle = { opacity: 0, left: '50%', top: '50%', width: 1, height: 1, border: 0 };

const SunNode = ({ data }) => (
  <div className="iu-sun">
    <Box size={26} strokeWidth={1.75} />
    <strong>{data.label}</strong>
    <Handle type="source" position={Position.Right} style={handleStyle} />
  </div>
);

export const RingsNode = () => <div className="iu-rings" />;

export default memo(SunNode);
