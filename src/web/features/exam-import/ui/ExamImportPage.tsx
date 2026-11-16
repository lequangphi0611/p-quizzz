import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../../shared/ui/Button.js';
import { Card } from '../../../shared/ui/Card.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { fromParsed, QuestionPreview } from '../../../shared/ui/QuestionPreview.js';
import { TextField } from '../../../shared/ui/TextField.js';
import { useImportExam } from '../application/exam-context.js';
import { countByType, attemptRuleLabel, typeCountsLabel } from '../domain/exam-summary.js';
import { IssueList } from './IssueList.js';
import { SourceLines } from './SourceLines.js';

type View = 'edit' | 'lines';

export function ExamImportPage() {
  const nav = useNavigate();
  const { state, ctrl } = useImportExam();
  const { markdown, result, checking, previewError, importError, busy } = state;
  const [view, setView] = useState<View>('edit');
  const [focusLine, setFocusLine] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Scroll to the clicked issue once the lines view is on screen.
  useEffect(() => {
    if (view === 'lines' && focusLine) document.getElementById(`pq-line-${focusLine}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [view, focusLine]);

  async function loadFile(file: File | undefined) {
    if (!file) return;
    try {
      ctrl.setMarkdown(await file.text());
      setView('edit');
    } catch {
      ctrl.reportFileError();
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

  const { exam, errors, warnings, canImport } = ctrl;

  async function doImport() {
    const id = await ctrl.import();
    if (id !== null) nav(`/admin/exams/${id}`);
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
                onChange={v => ctrl.setMarkdown(v)}
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
              <div>{attemptRuleLabel(exam.hasEssay)}</div>
            </div>
          </Card>
          {importError && <ErrorMessage message={importError} />}
          {exam.questions.map((q, i) => <QuestionPreview key={i} index={i} question={fromParsed(q)} />)}
        </>
      )}
    </div>
  );
}
