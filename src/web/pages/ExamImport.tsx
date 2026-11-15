import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router';
import type { CreateExamResponse } from '../../shared/api/index.js';
import type { ExamIssue, ParseResult } from '../../shared/exam-format/index.js';
import { fromParsed, QuestionPreview } from '../components/QuestionPreview.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { ErrorMessage } from '../components/ui/ErrorMessage.js';
import { Icon } from '../components/ui/Icon.js';
import { TextField } from '../components/ui/TextField.js';
import { api, ApiError } from '../lib/api.js';
import { countByType, retakeLabel, splitSourceLines, typeCountsLabel } from '../lib/exam-summary.js';

const PREVIEW_DEBOUNCE_MS = 400;
type View = 'edit' | 'lines';

const issueLines = (issues: ExamIssue[]) => new Set(issues.map(i => i.line));

// A numbered, read-only view of the source. Error lines are red, warning lines amber; `focus` is outlined.
function SourceLines({ source, errors, warnings, focus }: { source: string; errors: ExamIssue[]; warnings: ExamIssue[]; focus: number | null }) {
  const errorLines = useMemo(() => issueLines(errors), [errors]);
  const warnLines = useMemo(() => issueLines(warnings), [warnings]);
  const lines = useMemo(() => splitSourceLines(source), [source]);
  return (
    <div style={{ maxHeight: 520, overflow: 'auto', background: 'var(--paper)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', font: 'var(--type-code)', fontSize: 13 }}>
      {lines.map((text, i) => {
        const n = i + 1;
        const bad = errorLines.has(n);
        const warn = !bad && warnLines.has(n);
        return (
          <div key={n} id={`pq-line-${n}`} style={{ display: 'flex', background: bad ? 'var(--wrong-surface)' : warn ? 'var(--warn-surface)' : 'transparent', boxShadow: focus === n ? 'inset 0 0 0 2px var(--wrong-500)' : 'none' }}>
            <span className="pq-tabular" style={{ flex: 'none', width: 48, padding: '0 10px', textAlign: 'right', color: bad ? 'var(--wrong-600)' : 'var(--text-faint)', userSelect: 'none', borderRight: '1px solid var(--border-hairline)' }}>{n}</span>
            <span style={{ padding: '0 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', minWidth: 0, color: bad ? 'var(--wrong-600)' : 'var(--ink-800)' }}>{text || ' '}</span>
          </div>
        );
      })}
    </div>
  );
}

function IssueList({ title, issues, tone, onPick }: { title: string; issues: ExamIssue[]; tone: 'error' | 'warning'; onPick: (line: number) => void }) {
  if (issues.length === 0) return null;
  const color = tone === 'error' ? 'var(--wrong-600)' : 'var(--warn-600)';
  return (
    <Card title={`${title} (${issues.length})`}>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
        {issues.map((it, i) => (
          <li key={i}>
            <button type="button" onClick={() => onPick(it.line)} style={{ display: 'flex', gap: 10, width: '100%', textAlign: 'left', padding: '8px 10px', background: 'var(--surface-sunken)', border: 0, borderRadius: 'var(--radius-sm)', cursor: 'pointer', font: 'var(--type-ui)', color: 'var(--ink-800)' }}>
              <span className="pq-tabular" style={{ flex: 'none', fontWeight: 700, color }}>Dòng {it.line}</span>
              <span>{it.message}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ExamImport() {
  const nav = useNavigate();
  const [markdown, setMarkdown] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [previewedFor, setPreviewedFor] = useState('');
  const [checking, setChecking] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [view, setView] = useState<View>('edit');
  const [focusLine, setFocusLine] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState('');
  const submitting = useRef(false); // blocks a second submit before the `busy` re-render lands
  const fileInput = useRef<HTMLInputElement>(null);

  // Debounced preview; a stale response is dropped when the text changed meanwhile.
  useEffect(() => {
    if (!markdown.trim()) {
      setResult(null);
      setPreviewError('');
      setChecking(false);
      return;
    }
    let stale = false;
    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        const r = await api.post<ParseResult>('/api/admin/exams/preview', { markdown });
        if (stale) return;
        setResult(r);
        setPreviewedFor(markdown);
        setPreviewError('');
      } catch (err) {
        if (!stale) setPreviewError(err instanceof ApiError ? err.message : 'Không kiểm tra được đề');
      } finally {
        if (!stale) setChecking(false);
      }
    }, PREVIEW_DEBOUNCE_MS);
    return () => { stale = true; clearTimeout(timer); };
  }, [markdown]);

  // Scroll to the clicked issue once the lines view is on screen.
  useEffect(() => {
    if (view === 'lines' && focusLine) document.getElementById(`pq-line-${focusLine}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [view, focusLine]);

  async function loadFile(file: File | undefined) {
    if (!file) return;
    try {
      setMarkdown(await file.text());
      setView('edit');
      setImportError('');
    } catch {
      setPreviewError('Không đọc được file');
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void loadFile(e.dataTransfer.files[0]);
  }

  function jumpTo(line: number) {
    setFocusLine(line);
    setView('lines');
  }

  const exam = result?.exam ?? null;
  const errors = result?.errors ?? [];
  const warnings = result?.warnings ?? [];
  const upToDate = !checking && previewedFor === markdown;
  const canImport = !!exam && errors.length === 0 && upToDate && !busy;

  async function doImport() {
    if (!canImport || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setImportError('');
    try {
      const res = await api.post<CreateExamResponse>('/api/admin/exams', { markdown });
      nav(`/admin/exams/${res.exam.id}`);
    } catch (err) {
      setImportError(err instanceof ApiError ? err.message : 'Không import được đề');
      submitting.current = false;
      setBusy(false);
    }
  }

  const segBtn = (v: View, label: string) => (
    <button type="button" onClick={() => setView(v)} aria-pressed={view === v} style={{ padding: '6px 12px', border: 0, borderRadius: 'var(--radius-sm)', cursor: 'pointer', font: 'var(--type-ui)', fontSize: 13, background: view === v ? 'var(--paper)' : 'transparent', color: view === v ? 'var(--text-title)' : 'var(--text-meta)', boxShadow: view === v ? 'var(--shadow-card)' : 'none' }}>{label}</button>
  );

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <button onClick={() => nav('/admin/exams')} style={{ justifySelf: 'start', display: 'inline-flex', gap: 6, alignItems: 'center', background: 'none', border: 0, padding: 0, color: 'var(--text-meta)', font: 'var(--type-meta)', cursor: 'pointer' }}><Icon name="arrow-left" size={14} />Đề thi</button>
      <h1 style={{ font: 'var(--type-h1)', color: 'var(--text-title)', margin: 0 }}>Import đề</h1>

      <Card
        title="Nội dung đề (Markdown)"
        subtitle="Chọn file .md, kéo thả vào khung, hoặc dán nội dung."
        actions={
          <>
            <input ref={fileInput} type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" hidden onChange={e => { void loadFile(e.target.files?.[0]); e.target.value = ''; }} />
            <Button size="sm" variant="secondary" icon="upload" onClick={() => fileInput.current?.click()}>Chọn file</Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          <div role="group" aria-label="Chế độ xem" style={{ display: 'inline-flex', justifySelf: 'start', gap: 2, padding: 3, borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)' }}>
            {segBtn('edit', 'Soạn / dán')}
            {segBtn('lines', 'Xem theo dòng')}
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            style={{ position: 'relative', borderRadius: 'var(--radius-md)', outline: dragging ? '2px dashed var(--brand-500)' : 'none', outlineOffset: 2 }}
          >
            {view === 'edit' ? (
              <TextField
                multiline
                mono
                rows={14}
                spellCheck={false}
                value={markdown}
                onChange={v => { setMarkdown(v); setImportError(''); }}
                placeholder={'---\ntitle: Tên đề\n---\n\n## Câu hỏi?\n- [x] Đáp án đúng\n- [ ] Đáp án sai'}
              />
            ) : markdown ? (
              <SourceLines source={markdown} errors={errors} warnings={warnings} focus={focusLine} />
            ) : (
              <div style={{ padding: 24, color: 'var(--text-faint)', font: 'var(--type-meta)' }}>Chưa có nội dung.</div>
            )}
          </div>

          <div role="status" style={{ minHeight: 20, font: 'var(--type-meta)', color: 'var(--text-meta)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {checking ? <><Icon name="loader-circle" size={14} spin />Đang kiểm tra…</>
              : !result ? (previewError ? '' : 'Chưa có nội dung để kiểm tra.')
              : errors.length > 0 ? <span style={{ color: 'var(--wrong-600)', fontWeight: 600 }}>{errors.length} lỗi — chưa import được</span>
              : <span style={{ color: 'var(--correct-600)', fontWeight: 600 }}>Đề hợp lệ{warnings.length > 0 ? `, ${warnings.length} cảnh báo` : ''}</span>}
          </div>
          {previewError && <ErrorMessage message={previewError} />}
        </div>
      </Card>

      <IssueList title="Lỗi" issues={errors} tone="error" onPick={jumpTo} />
      <IssueList title="Cảnh báo" issues={warnings} tone="warning" onPick={jumpTo} />

      {exam && errors.length === 0 && (
        <>
          <Card
            tone="brand"
            title={exam.title}
            subtitle={exam.description}
            actions={<Button icon="check" loading={busy} disabled={!canImport} onClick={doImport}>Import</Button>}
          >
            <div style={{ display: 'grid', gap: 4, font: 'var(--type-ui)', color: 'var(--ink-800)' }}>
              <div><b className="pq-tabular">{exam.questions.length}</b> câu ({typeCountsLabel(countByType(exam.questions))}) · tổng <b className="pq-tabular">{exam.totalPoints}</b> điểm</div>
              <div>{retakeLabel(exam.hasEssay)}</div>
            </div>
          </Card>
          {importError && <ErrorMessage message={importError} />}
          {exam.questions.map((q, i) => <QuestionPreview key={i} index={i} question={fromParsed(q)} />)}
        </>
      )}
    </div>
  );
}
