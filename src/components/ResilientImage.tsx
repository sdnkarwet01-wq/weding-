import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface ResilientImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  lazy?: boolean;
}

export function ResilientImage({
  src,
  alt,
  className = '',
  fallbackLabel,
  lazy = true,
}: ResilientImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#F1EAE0] via-[#FAF7F2] to-[#E6DFD3] text-[#737C68] ${className}`}
      >
        <ImageIcon className="w-7 h-7 opacity-45 mb-1.5" strokeWidth={1.3} />
        {fallbackLabel && (
          <span className="text-xs tracking-wide opacity-70 px-3 text-center">
            {fallbackLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading={lazy ? 'lazy' : 'eager'}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
