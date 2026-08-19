import React from 'react';

interface GFLogoProps {
  className?: string;
  size?: number | string;
}

export const GFLogo: React.FC<GFLogoProps> = ({ className = "w-full h-full", size }) => {
  const sizeProps = size ? { width: size, height: size } : {};

  return (
    <svg 
      viewBox="0 0 1000 1000" 
      className={className}
      {...sizeProps}
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Dark Squircle Background Gradient */}
        <radialGradient id="gf-badge-surface" cx="50%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#2c3038" />
          <stop offset="50%" stopColor="#1a1c22" />
          <stop offset="85%" stopColor="#121317" />
          <stop offset="100%" stopColor="#0a0b0d" />
        </radialGradient>

        {/* Vibrant Tech Azure Blue Gradient for C/G */}
        <linearGradient id="gf-blue-gradient" x1="20%" y1="15%" x2="80%" y2="85%">
          <stop offset="0%" stopColor="#00a8f3" />
          <stop offset="45%" stopColor="#008dd2" />
          <stop offset="100%" stopColor="#006fa8" />
        </linearGradient>

        {/* Pure White Surface Gradient for F */}
        <linearGradient id="gf-white-gradient" x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="85%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>

        {/* Drop shadow for the blue C/G element */}
        <filter id="gf-blue-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="12" stdDeviation="14" floodColor="#000000" floodOpacity="0.65" />
        </filter>

        {/* Sharp and deep drop shadow for the white F overlay */}
        <filter id="gf-f-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="-6" dy="14" stdDeviation="12" floodColor="#000000" floodOpacity="0.75" />
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000000" floodOpacity="0.5" />
        </filter>
      </defs>

      {/* Main Squircle Container */}
      <rect 
        x="130" 
        y="130" 
        width="740" 
        height="740" 
        rx="155" 
        ry="155" 
        fill="url(#gf-badge-surface)" 
        stroke="#ffffff" 
        strokeWidth="24" 
      />

      {/* Inner subtle rim border */}
      <rect 
        x="146" 
        y="146" 
        width="708" 
        height="708" 
        rx="140" 
        ry="140" 
        fill="none" 
        stroke="#475569" 
        strokeWidth="2.5" 
        strokeOpacity="0.3"
      />

      {/* ========================================= */}
      {/* 1. BLUE 'G' / 'C' MONOGRAM LAYER          */}
      {/* ========================================= */}
      <g filter="url(#gf-blue-shadow)">
        {/* Main circular C arc on the left */}
        <path
          d="M 475 295
             A 205 205 0 0 0 270 500
             A 205 205 0 0 0 475 705
             L 475 615
             A 115 115 0 0 1 360 500
             A 115 115 0 0 1 475 385
             Z"
          fill="url(#gf-blue-gradient)"
        />

        {/* Upper blue angled wedge (inside upper gap of F) */}
        <path
          d="M 525 315
             L 525 450
             L 560 450
             L 560 375
             L 600 325
             Z"
          fill="url(#gf-blue-gradient)"
        />

        {/* Lower blue G spur / crossbar (interlocking below F middle bar) */}
        <path
          d="M 480 460
             L 615 460
             L 615 675
             L 535 675
             L 535 550
             L 480 550
             Z"
          fill="url(#gf-blue-gradient)"
        />
      </g>

      {/* ========================================= */}
      {/* 2. WHITE 'F' MONOGRAM OVERLAY             */}
      {/* ========================================= */}
      <g filter="url(#gf-f-shadow)">
        <path
          d="M 470 240
             L 730 240
             L 730 330
             L 560 330
             L 560 460
             L 705 460
             L 705 545
             L 560 545
             L 560 760
             L 470 760
             L 470 550
             L 490 550
             L 490 460
             L 470 460
             Z"
          fill="url(#gf-white-gradient)"
        />
      </g>
    </svg>
  );
};
