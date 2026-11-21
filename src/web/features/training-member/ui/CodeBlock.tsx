import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../shared/ui/Button.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { copyText } from './copy-text.js';

type CopyState = 'idle' | 'copied' | 'manual';

/**
 * Text the member copies into a terminal or Claude Code: monospace, wrapped (never cut off), with a copy button.
 * Where copying is not possible (plain http, blocked clipboard) the text is selected instead and the member is told to press
 * Ctrl+C. Never shows anything the server collected: only what the member is asked to paste.
 */
export function CodeBlock({ code, label, maxHeight = 320, copyLabel = 'Sao chép' }: { code: string; label: string; maxHeight?: number; copyLabel?: string }) {
  const [state, setState] = useState<CopyState>('idle');
  const pre = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (state !== 'copied') return;
    const t = setTimeout(() => setState('idle'), 2500);
    return () => clearTimeout(t);
  }, [state]);

  function selectAll() {
    const el = pre.current;
    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    if (!el || !sel) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  async function copy() {
    if (await copyText(code)) setState('copied');
    else { selectAll(); setState('manual'); }
  }

  return (
    <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ font: 'var(--type-label)', color: 'var(--text-meta)' }}>{label}</span>
        <Button size="md" variant="secondary" icon={state === 'copied' ? 'check' : 'copy'} onClick={() => void copy()}>
          {state === 'copied' ? 'Đã sao chép' : copyLabel}
        </Button>
      </div>
      <pre ref={pre} tabIndex={0} aria-label={label}
        style={{ margin: 0, padding: '12px 14px', maxHeight, overflow: 'auto', boxSizing: 'border-box', background: 'var(--ink-050)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)',
          font: 'var(--type-code)', fontSize: 13, color: 'var(--ink-900)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', userSelect: 'text' }}>{code}</pre>
      <div aria-live="polite" style={{ minHeight: state === 'manual' ? undefined : 0 }}>
        {state === 'manual' && (
          <p style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'flex-start', font: 'var(--type-meta)', color: 'var(--warn-600)' }}>
            <Icon name="info" size={15} style={{ marginTop: 2 }} />
            <span>Trình duyệt không cho sao chép tự động qua địa chỉ này. Văn bản đã được chọn sẵn: nhấn <b>Ctrl+C</b> (hoặc <b>⌘C</b> trên Mac) để sao chép.</span>
          </p>
        )}
      </div>
    </div>
  );
}
