import React from 'react';

interface GFLogoProps {
  className?: string;
  size?: number | string;
}

export const GFLogo: React.FC<GFLogoProps> = ({ className = "w-full h-full", size }) => {
  const sizeProps = size ? { width: size, height: size } : {};

  return (
    <svg 
      viewBox="0 0 512 512" 
      className={className}
      {...sizeProps}
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Dark Squircle Background Gradient */}
        <radialGradient id="gf-badge-surface" cx="50%" cy="36%" r="65%">
          <stop offset="0%" stopColor="#2c3038" />
          <stop offset="48%" stopColor="#1a1c22" />
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
          <feDropShadow dx="0" dy="7" stdDeviation="8" floodColor="#000000" floodOpacity="0.65" />
        </filter>

        {/* Sharp and deep drop shadow for the white F overlay */}
        <filter id="gf-f-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="-4" dy="8" stdDeviation="7" floodColor="#000000" floodOpacity="0.75" />
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000000" floodOpacity="0.5" />
        </filter>
      </defs>

      {/* Main Squircle Container - Full Bleed / Zero Waste Margin */}
      <rect 
        x="12" 
        y="12" 
        width="488" 
        height="488" 
        rx="108" 
        ry="108" 
        fill="url(#gf-badge-surface)" 
        stroke="#ffffff" 
        strokeWidth="14" 
      />

      {/* Inner subtle rim border */}
      <rect 
        x="22" 
        y="22" 
        width="468" 
        height="468" 
        rx="98" 
        ry="98" 
        fill="none" 
        stroke="#475569" 
        strokeWidth="1.5" 
        strokeOpacity="0.3" 
      />

      {/* ========================================= */}
      {/* 1. BLUE 'G' / 'C' MONOGRAM LAYER          */}
      {/* ========================================= */}
      <g filter="url(#gf-blue-shadow)">
        {/* Main circular C arc on the left */}
        <path
          d="M 242 116
             A 140 140 0 0 0 95 256
             A 140 140 0 0 0 242 396
             L 242 336
             A 80 80 0 0 1 155 256
             A 80 80 0 0 1 242 176
             Z"
          fill="url(#gf-blue-gradient)"
        />

        {/* Upper blue angled wedge (inside upper gap of F) */}
        <path
          d="M 278 130
             L 278 222
             L 305 222
             L 305 172
             L 335 138
             Z"
          fill="url(#gf-blue-gradient)"
        />

        {/* Lower blue G spur / crossbar (interlocking below F middle bar) */}
        <path
          d="M 248 228
             L 345 228
             L 345 378
             L 290 378
             L 290 290
             L 248 290
             Z"
          fill="url(#gf-blue-gradient)"
        />
      </g>

      {/* ========================================= */}
      {/* 2. WHITE 'F' MONOGRAM OVERLAY             */}
      {/* ========================================= */}
      <g filter="url(#gf-f-shadow)">
        <path
          d="M 240 80
             L 425 80
             L 425 142
             L 302 142
             L 302 228
             L 410 228
             L 410 290
             L 302 290
             L 302 432
             L 240 432
             L 240 290
             L 254 290
             L 254 228
             L 240 228
             Z"
          fill="url(#gf-white-gradient)"
        />
      </g>
    </svg>
  );
};
