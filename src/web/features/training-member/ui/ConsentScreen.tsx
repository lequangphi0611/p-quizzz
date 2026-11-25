import { useEffect, useId, useState, type FormEvent } from 'react';
import { Button } from '../../../shared/ui/Button.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { TextField } from '../../../shared/ui/TextField.js';
import { PageCard, mText } from '../../../shared/ui/member/member-shell.js';
import { HANDLING_ITEMS, NOT_SENT_ITEMS, OTHER_FOLDER_CAVEAT, PERMISSION_RISK, PERMISSION_RISK_TITLE, SECRET_WARNING, SENT_ITEMS, TEACHING_BADGE, TEACHING_CHECKBOX_LABEL, TEACHING_ITEMS, TEACHING_TITLE, REQUIRED_CHECKBOX_LABEL, REQUIRED_TITLE, consentSummary } from '../domain/consent-copy.js';
import type { TrainingJoinFailure } from '../domain/join-failure.js';
import { Callout, FactList, Heading } from './parts.js';

const NAME_MAX = 30;

const checkStyle = { boxSizing: 'border-box', width: '100%', display: 'flex', alignItems: 'center', gap: 12, minHeight: 'var(--tap-min)', padding: '8px 14px', border: '1.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)', background: 'var(--paper)', cursor: 'pointer', font: 'var(--type-ui)', fontSize: 16, color: 'var(--text-title)' } as const;
const checkInput = { width: 22, height: 22, margin: 0, accentColor: 'var(--brand-600)', flex: 'none', cursor: 'pointer' } as const;

/**
 * Screen 1: name + what is sent + consent. Both buttons are the same size and sit on one row; "Đồng ý và tiếp tục" works
 * only once the box is ticked, "Không tham gia" always works. Nothing is pre-ticked and nothing is hidden in small print.
 */
export function ConsentScreen({ desk, title, busy, error, onJoin, onDecline }: {
  desk: boolean;
  title: string;
  busy: boolean;
  error: TrainingJoinFailure | null;
  onJoin: (displayName: string, consented: boolean, teachingConsent: boolean) => Promise<boolean>;
  onDecline: () => void;
}) {
  const [name, setName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [teaching, setTeaching] = useState(false); // optional and never pre-ticked (PRODUCT.md §7.39a)
  const [lockedFor, setLockedFor] = useState(0); // seconds left after too many wrong codes (server 429)
  const checkId = useId();
  const teachingId = useId();

  useEffect(() => { if (error?.kind === 'locked') setLockedFor(error.seconds); }, [error]);
  useEffect(() => {
    if (lockedFor <= 0) return;
    const t = setTimeout(() => setLockedFor(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [lockedFor]);
  const locked = lockedFor > 0;
  const ready = agreed && name.trim().length > 0 && !locked;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (ready && !busy) void onJoin(name, agreed, teaching);
  }

  const nameError = error && (error.kind === 'taken' || error.kind === 'name') ? error.message : '';
  const half = { flex: '1 1 0', minWidth: 0 } as const;

  return (
    <PageCard desk={desk}>
      <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 22 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={mText.label}>Buổi training AI</span>
          <h1 style={mText.h1}>{title}</h1>
          <p style={mText.meta}>Trong buổi này, Claude Code trên máy bạn gửi một phần hoạt động về máy mentor để mentor góp ý. Đọc kỹ rồi mới đồng ý.</p>
        </div>

        {locked && <ErrorMessage message={`Bạn nhập sai quá nhiều lần, thử lại sau ${lockedFor} giây.`} />}
        {error?.kind === 'offline' && <ErrorMessage message={error.message} />}

        <TextField label="Tên của bạn" size="lg" value={name} onChange={setName} maxLength={NAME_MAX} placeholder="vd. Minh Anh" autoComplete="nickname" error={nameError}
          hint={nameError ? undefined : 'Mentor thấy tên này trong buổi training.'} />

        <section style={{ display: 'grid', gap: 12 }}>
          <Heading>Những gì được gửi về máy mentor</Heading>
          <FactList items={SENT_ITEMS} label="Những gì được gửi về máy mentor" />
          <Callout tone="warn" icon="shield-alert" title="Có thể chứa bí mật">{SECRET_WARNING}</Callout>
          <Callout tone="warn" icon="triangle-alert" title={PERMISSION_RISK_TITLE}>{PERMISSION_RISK}</Callout>
        </section>

        <section style={{ display: 'grid', gap: 12 }}>
          <Heading>Những gì không gửi</Heading>
          <FactList items={NOT_SENT_ITEMS} label="Những gì không gửi" />
          <p style={{ ...mText.meta, fontSize: 14 }}>{OTHER_FOLDER_CAVEAT}</p>
        </section>

        <section style={{ display: 'grid', gap: 12 }}>
          <Heading>Ai xem, giữ bao lâu, rút lại thế nào</Heading>
          <FactList items={HANDLING_ITEMS} label="Ai xem, giữ bao lâu, rút lại thế nào" />
        </section>

        <section aria-labelledby={`${teachingId}-title`} style={{ display: 'grid', gap: 12, padding: '16px 16px 18px', border: '1.5px solid var(--border-strong)', borderRadius: 'var(--radius-lg, 14px)', background: 'var(--surface-sunken)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 id={`${teachingId}-title`} style={{ margin: 0, font: 'var(--type-h2)', color: 'var(--text-title)' }}>{TEACHING_TITLE}</h2>
            <span style={{ padding: '2px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--ink-300)', background: 'var(--paper)', font: 'var(--type-label)', fontSize: 12, color: 'var(--ink-800)' }}>{TEACHING_BADGE}</span>
          </div>
          <FactList items={TEACHING_ITEMS} label={TEACHING_TITLE} />
          <label htmlFor={teachingId} style={checkStyle}>
            <input id={teachingId} type="checkbox" checked={teaching} onChange={e => setTeaching(e.target.checked)} style={checkInput} />
            <span style={{ minWidth: 0, textWrap: 'pretty' }}>{TEACHING_CHECKBOX_LABEL}</span>
          </label>
        </section>

        <div role="separator" aria-label={REQUIRED_TITLE} style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-meta)', font: 'var(--type-label)' }}>
          <span aria-hidden="true" style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />{REQUIRED_TITLE}<span aria-hidden="true" style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
        </div>

        <label htmlFor={checkId} style={checkStyle}>
          <input id={checkId} type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={checkInput} />
          <span style={{ minWidth: 0 }}>{REQUIRED_CHECKBOX_LABEL}</span>
        </label>

        <div data-consent-summary style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--brand-050)', border: '1px solid var(--brand-200)', font: 'var(--type-ui)', fontSize: 15, color: 'var(--ink-900)' }}>
          {consentSummary(agreed, teaching)}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={half}><Button type="submit" size="lg" block loading={busy} disabled={!ready} style={{ padding: '0 8px' }}>Đồng ý và tiếp tục</Button></div>
          <div style={half}><Button variant="secondary" size="lg" block disabled={busy} onClick={onDecline} style={{ padding: '0 8px' }}>Không tham gia</Button></div>
        </div>
        {!ready && !locked && <p style={{ ...mText.meta, marginTop: -10 }}>Nút "Đồng ý và tiếp tục" bật sau khi bạn nhập tên và tick ô "Tôi đã đọc và đồng ý tham gia buổi này".</p>}
      </form>
    </PageCard>
  );
}
