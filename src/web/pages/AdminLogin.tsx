import { useState, type FormEvent } from 'react';
import { useLoaderData, useNavigate } from 'react-router';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { ErrorMessage } from '../components/ui/ErrorMessage.js';
import { api, ApiError } from '../lib/api.js';
import { MIN_PASSWORD_LENGTH } from '../../shared/api/index.js';

const inputStyle = { width: '100%', height: 48, padding: '0 14px', font: 'var(--type-ui)', fontSize: 16, color: 'var(--text-title)', background: 'var(--paper)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)' } as const;

function Field({ label, value, onChange, autoFocus }: { label: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <label style={{ display: 'grid', gap: 6, font: 'var(--type-ui)', fontWeight: 600, color: 'var(--text-title)' }}>
      {label}
      <input type="password" style={inputStyle} value={value} onChange={e => onChange(e.target.value)} autoFocus={autoFocus} autoComplete={label.startsWith('Nhập lại') ? 'new-password' : undefined} />
    </label>
  );
}

// First run (no password yet) → set one (typed twice); afterwards → plain login.
export function AdminLogin() {
  const { setupDone } = useLoaderData() as { setupDone: boolean };
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const validation = setupDone ? '' : pw.length < MIN_PASSWORD_LENGTH ? `Mật khẩu tối thiểu ${MIN_PASSWORD_LENGTH} ký tự` : pw !== pw2 ? 'Hai mật khẩu chưa khớp' : '';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (validation) return setError(validation);
    setBusy(true);
    setError('');
    try {
      await api.post(setupDone ? '/api/admin/login' : '/api/admin/setup', { password: pw });
      nav('/admin/exams', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Có lỗi xảy ra');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: 'var(--surface-page)' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <Card>
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <div style={{ font: '800 22px/1 var(--font-sans)', letterSpacing: '-0.03em', color: 'var(--brand-600)' }}>p-quizzz</div>
              <h1 style={{ font: 'var(--type-h1)', color: 'var(--text-title)', margin: '10px 0 4px' }}>{setupDone ? 'Đăng nhập mentor' : 'Đặt mật khẩu mentor'}</h1>
              {!setupDone && <p style={{ font: 'var(--type-meta)', color: 'var(--text-meta)', margin: 0 }}>Lần chạy đầu tiên — đặt mật khẩu để quản lý đề và phiên thi.</p>}
            </div>
            <Field label="Mật khẩu" value={pw} onChange={v => { setPw(v); setError(''); }} autoFocus />
            {!setupDone && <Field label="Nhập lại mật khẩu" value={pw2} onChange={v => { setPw2(v); setError(''); }} />}
            {error && <ErrorMessage message={error} />}
            <Button type="submit" size="lg" block icon="log-in" loading={busy} disabled={!pw}>{setupDone ? 'Đăng nhập' : 'Đặt mật khẩu'}</Button>
          </div>
        </Card>
      </div>
    </form>
  );
}
