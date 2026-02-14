import React from 'react';

const IconBase = ({
  size = 24,
  color = 'currentColor',
  strokeWidth = 2,
  absoluteStrokeWidth = false,
  className,
  style,
  viewBox = '0 0 24 24',
  fill = 'none',
  children,
  ...rest
}) => {
  const resolvedStrokeWidth = absoluteStrokeWidth ? strokeWidth : strokeWidth;
  return (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox={viewBox}
    fill={fill}
    stroke={color}
    strokeWidth={resolvedStrokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    {children}
  </svg>
  );
};

export const PlayIcon = ({ filled = false, ...props }) => (
  <IconBase {...props} fill={filled ? props.color || 'currentColor' : 'none'}>
    <polygon points="8 5 19 12 8 19 8 5" fill={filled ? props.color || 'currentColor' : 'none'} />
  </IconBase>
);

export const PauseIcon = ({ filled = false, ...props }) => (
  <IconBase {...props} fill={filled ? props.color || 'currentColor' : 'none'}>
    <rect x="7" y="5" width="3.5" height="14" rx="1" fill={filled ? props.color || 'currentColor' : 'none'} />
    <rect x="13.5" y="5" width="3.5" height="14" rx="1" fill={filled ? props.color || 'currentColor' : 'none'} />
  </IconBase>
);

export const ListMusicIcon = ({ ...props }) => (
  <IconBase {...props}>
    <path d="M11 18V6l9-2v12" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </IconBase>
);

export const Maximize2Icon = ({ ...props }) => (
  <IconBase {...props}>
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </IconBase>
);

export const SearchIcon = ({ ...props }) => (
  <IconBase {...props}>
    <circle cx="11" cy="11" r="7" />
    <line x1="16.65" y1="16.65" x2="21" y2="21" />
  </IconBase>
);

export const CloseIcon = ({ ...props }) => (
  <IconBase {...props}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </IconBase>
);

export const LibraryIcon = ({ ...props }) => (
  <IconBase {...props}>
    <path d="M4 4h5v16H4z" />
    <path d="M11.5 4.5l4.8-1.2 3.7 14.4-4.8 1.2z" />
  </IconBase>
);

export const VideoIcon = ({ ...props }) => (
  <IconBase {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <polygon points="10 9 16 12 10 15 10 9" />
  </IconBase>
);

export const DownloadIcon = ({ ...props }) => (
  <IconBase {...props}>
    <path d="M12 3v12" />
    <polyline points="7 11 12 16 17 11" />
    <path d="M4 20h16" />
  </IconBase>
);

export const InfoIcon = ({ ...props }) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="10" x2="12" y2="16" />
    <line x1="12" y1="7" x2="12.01" y2="7" />
  </IconBase>
);

export const SunIcon = ({ ...props }) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="2" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
    <line x1="4.9" y1="4.9" x2="7" y2="7" />
    <line x1="17" y1="17" x2="19.1" y2="19.1" />
    <line x1="17" y1="7" x2="19.1" y2="4.9" />
    <line x1="4.9" y1="19.1" x2="7" y2="17" />
  </IconBase>
);

export const MoonIcon = ({ ...props }) => (
  <IconBase {...props}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </IconBase>
);

export const MonitorIcon = ({ ...props }) => (
  <IconBase {...props}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <line x1="8" y1="20" x2="16" y2="20" />
    <line x1="12" y1="16" x2="12" y2="20" />
  </IconBase>
);

export const ChevronUpIcon = ({ ...props }) => (
  <IconBase {...props}>
    <polyline points="18 15 12 9 6 15" />
  </IconBase>
);

export const HeartIcon = ({ filled = false, ...props }) => (
  <IconBase {...props} fill={filled ? props.color || 'currentColor' : 'none'}>
    <path
      d="M12 20.8s-7-4.4-9.3-8.1C.6 9.5 2.2 5.8 5.6 5.2c2-.3 3.4.5 4.4 1.9 1-1.4 2.4-2.2 4.4-1.9 3.4.6 5 4.3 2.9 7.5C19 16.4 12 20.8 12 20.8z"
      fill={filled ? props.color || 'currentColor' : 'none'}
    />
  </IconBase>
);

export const RepeatIcon = ({ ...props }) => (
  <IconBase {...props}>
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </IconBase>
);

export const Repeat1Icon = ({ ...props }) => (
  <IconBase {...props}>
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    <line x1="12" y1="8" x2="12" y2="14" />
    <line x1="11" y1="14" x2="13" y2="14" />
  </IconBase>
);

export const ShuffleIcon = ({ ...props }) => (
  <IconBase {...props}>
    <polyline points="16 3 21 3 21 8" />
    <line x1="4" y1="20" x2="21" y2="3" />
    <polyline points="21 16 21 21 16 21" />
    <line x1="15" y1="15" x2="21" y2="21" />
    <line x1="4" y1="4" x2="9" y2="9" />
  </IconBase>
);
