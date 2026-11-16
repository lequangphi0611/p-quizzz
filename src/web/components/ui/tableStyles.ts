import type { CSSProperties } from 'react';

// Mentor table cells (design system: uppercase label headers, hairline rows).
export const th: CSSProperties = { font: 'var(--type-label)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--text-faint)', textAlign: 'left', whiteSpace: 'nowrap', padding: '10px 16px', borderBottom: '1px solid var(--border-hairline)' };
export const td: CSSProperties = { whiteSpace: 'nowrap', font: 'var(--type-ui)', color: 'var(--text-body)', padding: '12px 16px', borderBottom: '1px solid var(--border-hairline)', verticalAlign: 'middle' };
