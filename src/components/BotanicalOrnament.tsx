import React from 'react';
import { TemplateConfig } from '../data/templates';

export function BotanicalOrnament({
  type,
  color = 'currentColor',
  className = '',
}: {
  type: TemplateConfig['ornamentType'];
  color?: string;
  className?: string;
}) {
  if (type === 'line') {
    return (
      <svg
        viewBox="0 0 180 24"
        fill="none"
        className={`w-36 h-6 mx-auto ${className}`}
        aria-hidden="true"
      >
        <line x1="8" y1="12" x2="72" y2="12" stroke={color} strokeWidth="0.8" strokeOpacity="0.45" />
        <path
          d="M90 4C90 4 94 9 90 12C86 9 90 4 90 4ZM90 20C90 20 94 15 90 12C86 15 90 20 90 20ZM82 12C82 12 87 8 90 12C87 16 82 12 82 12ZM98 12C98 12 93 8 90 12C93 16 98 12 98 12Z"
          stroke={color}
          strokeWidth="0.9"
          strokeOpacity="0.7"
        />
        <line x1="108" y1="12" x2="172" y2="12" stroke={color} strokeWidth="0.8" strokeOpacity="0.45" />
      </svg>
    );
  }

  if (type === 'olive') {
    return (
      <svg
        viewBox="0 0 160 40"
        fill="none"
        className={`w-32 h-8 mx-auto ${className}`}
        aria-hidden="true"
      >
        <path
          d="M20 28C48 16 112 16 140 28"
          stroke={color}
          strokeWidth="0.9"
          strokeOpacity="0.55"
        />
        <path d="M52 21C47 13 55 10 59 17C56 20 52 21 52 21Z" stroke={color} strokeWidth="0.9" fill={color} fillOpacity="0.12" />
        <path d="M80 18C77 9 86 8 87 16C84 18 80 18 80 18Z" stroke={color} strokeWidth="0.9" fill={color} fillOpacity="0.12" />
        <path d="M108 21C113 13 105 10 101 17C104 20 108 21 108 21Z" stroke={color} strokeWidth="0.9" fill={color} fillOpacity="0.12" />
      </svg>
    );
  }

  if (type === 'gold-crest' || type === 'double-border') {
    return (
      <svg
        viewBox="0 0 140 32"
        fill="none"
        className={`w-32 h-7 mx-auto ${className}`}
        aria-hidden="true"
      >
        <line x1="6" y1="16" x2="54" y2="16" stroke={color} strokeWidth="0.8" strokeOpacity="0.5" />
        <polygon
          points="70,5 79,16 70,27 61,16"
          stroke={color}
          strokeWidth="1"
          fill="none"
        />
        <circle cx="70" cy="16" r="2.2" fill={color} />
        <line x1="86" y1="16" x2="134" y2="16" stroke={color} strokeWidth="0.8" strokeOpacity="0.5" />
      </svg>
    );
  }

  // Default botanical / floral wreath sprig
  return (
    <svg
      viewBox="0 0 160 36"
      fill="none"
      className={`w-36 h-8 mx-auto ${className}`}
      aria-hidden="true"
    >
      <path
        d="M25 22C48 22 62 18 80 12C98 18 112 22 135 22"
        stroke={color}
        strokeWidth="0.8"
        strokeOpacity="0.45"
      />
      <path
        d="M80 6C83 11 83 16 80 20C77 16 77 11 80 6Z"
        stroke={color}
        strokeWidth="0.9"
        fill={color}
        fillOpacity="0.14"
      />
      <path
        d="M66 14C62 10 56 12 60 17C63 18 66 16 66 14Z"
        stroke={color}
        strokeWidth="0.9"
        fill={color}
        fillOpacity="0.1"
      />
      <path
        d="M94 14C98 10 104 12 100 17C97 18 94 16 94 14Z"
        stroke={color}
        strokeWidth="0.9"
        fill={color}
        fillOpacity="0.1"
      />
      <circle cx="80" cy="24" r="1.5" fill={color} fillOpacity="0.65" />
    </svg>
  );
}
