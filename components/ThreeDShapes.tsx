import React from 'react';

export interface ThreeDBarProps {
  fill?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/**
 * Custom 3D Vertical Bar shape for Recharts.
 * Renders a highly polished isometric pillar with a shaded right face and highlighted top cap.
 */
export const ThreeDBarVertical = (props: ThreeDBarProps) => {
  const { fill, x = 0, y = 0, width = 0, height = 0 } = props;
  if (!width || !height || height <= 0) return null;

  // Adapt depth to the width to avoid visual artifacts on tiny bars
  const depth = Math.min(8, width / 4);

  return (
    <g className="transition-all duration-300 hover:brightness-110">
      {/* Right Side Shadow Face */}
      <path
        d={`M ${x + width - depth} ${y} L ${x + width} ${y - depth} L ${x + width} ${y + height - depth} L ${x + width - depth} ${y + height} Z`}
        fill={fill}
        filter="brightness(0.75)"
      />
      {/* Top Cap Highlight Face */}
      <path
        d={`M ${x} ${y} L ${x + depth} ${y - depth} L ${x + width} ${y - depth} L ${x + width - depth} ${y} Z`}
        fill={fill}
        filter="brightness(1.20)"
      />
      {/* Front Face */}
      <path
        d={`M ${x} ${y} L ${x + width - depth} ${y} L ${x + width - depth} ${y + height} L ${x} ${y + height} Z`}
        fill={fill}
      />
    </g>
  );
};

/**
 * Custom 3D Horizontal Bar shape for Recharts.
 * Renders an outstanding horizontal 3D block with right cap of highlight and bottom face of shadow.
 */
export const ThreeDBarHorizontal = (props: ThreeDBarProps) => {
  const { fill, x = 0, y = 0, width = 0, height = 0 } = props;
  if (!width || !height || width <= 0) return null;

  const depth = Math.min(8, height / 4);

  return (
    <g className="transition-all duration-300 hover:brightness-110">
      {/* Bottom Side Shadow Face */}
      <path
        d={`M ${x} ${y + height - depth} L ${x + depth} ${y + height} L ${x + width + depth} ${y + height} L ${x + width} ${y + height - depth} Z`}
        fill={fill}
        filter="brightness(0.70)"
      />
      {/* Right Cap Highlight Face */}
      <path
        d={`M ${x + width} ${y} L ${x + width + depth} ${y + depth} L ${x + width + depth} ${y + height} L ${x + width} ${y + height - depth} Z`}
        fill={fill}
        filter="brightness(1.15)"
      />
      {/* Front Face */}
      <path
        d={`M ${x} ${y} L ${x + width} ${y} L ${x + width} ${y + height - depth} L ${x} ${y + height - depth} Z`}
        fill={fill}
      />
    </g>
  );
};
