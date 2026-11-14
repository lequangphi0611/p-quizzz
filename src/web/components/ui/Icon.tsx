import type { CSSProperties } from 'react';

/** Lucide glyph from assets/icons, rendered as a currentColor mask (see styles/icons.css). */
export function Icon({ name, size = 16, spin = false, color, title, style }: { name: string; size?: number; spin?: boolean; color?: string; title?: string; style?: CSSProperties }) {
  return <span className={`pq-icon pq-icon-${name}${spin ? ' pq-spin' : ''}`} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} style={{ fontSize: size, color, ...style }} />;
}
