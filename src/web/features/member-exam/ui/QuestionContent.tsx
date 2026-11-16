import type { Ref, ReactNode } from 'react';
import type { MemberQuestion } from '../../../../shared/api/index.js';
import { Markdown } from '../../../components/Markdown.js';
import { ErrorMessage } from '../../../components/ui/ErrorMessage.js';
import { Icon } from '../../../components/ui/Icon.js';
import { Kbd } from '../../../components/ui/Kbd.js';
import { TextField } from '../../../components/ui/TextField.js';
import { formatPoints } from '../../../shared/format/points.js';
import { mText } from '../../../shared/ui/member/member-shell.js';
import type { Draft } from '../domain/answer-progress.js';
import { AnswerOptions } from './AnswerOptions.js';

const TYPE: Record<MemberQuestion['type'], [string, string]> = { single: ['circle-dot', 'Một đáp án'], multi: ['square-check', 'Nhiều đáp án'], essay: ['pencil', 'Tự luận'] };

/** The one question on screen: heading, optional body, the answer control and the notices under it. */
export function QuestionContent({ q, cur, total, desk, draft, showKeys, typing, onTyping, onPick, onText, saveEl, headRef, closed, submitError }: {
  q: MemberQuestion; cur: number; total: number; desk: boolean; draft: Draft; showKeys: boolean; typing: boolean; onTyping: (v: boolean) => void;
  onPick: (optionId: number) => void; onText: (text: string) => void;
  /** Phones show the save state in the question header; desktop has it in the app header. */
  saveEl?: ReactNode; headRef: Ref<HTMLHeadingElement>; closed: boolean; submitError: string;
}) {
  const { selected, text } = draft;
  const answer = q.type === 'essay' ? (
    <div onFocusCapture={() => onTyping(true)} onBlurCapture={() => onTyping(false)} style={{ display: 'grid', gap: 8, minWidth: 0 }}>
      <TextField key={`essay-${q.id}`} label="Câu trả lời của bạn" multiline mono rows={desk ? 20 : 10} value={text} onChange={onText} placeholder="Viết câu trả lời… có thể dán code nhiều dòng." spellCheck={false} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', ...mText.meta }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{showKeys && typing ? <><Icon name="info" size={14} />Phím tắt tạm tắt khi đang gõ · <Kbd>Esc</Kbd> để thoát ô</> : 'Tự động lưu khi bạn gõ'}</span>
        <span style={mText.mono}>{text ? text.split('\n').length : 0} dòng · {text.length} ký tự</span>
      </div>
    </div>
  ) : (
    <div style={{ display: 'grid', gap: 12, maxWidth: desk ? 800 : undefined }}>
      {q.type === 'multi' && <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, font: 'var(--type-ui)', fontSize: 14, fontWeight: 600, color: 'var(--brand-700)' }}><Icon name="list-checks" size={16} />Chọn tất cả đáp án đúng</p>}
      <AnswerOptions q={q} selected={selected} onPick={onPick} keys={showKeys} dimKeys={typing} />
    </div>
  );

  return (
    <div key={q.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: desk ? 24 : 18, minWidth: 0, animation: 'pq-reveal var(--dur-base) var(--ease-standard)' }}>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, ...mText.label }}>
          <span style={{ color: 'var(--brand-700)' }}>Câu {cur + 1}/{total}</span><span aria-hidden="true">·</span><span>{formatPoints(q.points)} điểm</span><span aria-hidden="true">·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name={TYPE[q.type][0]} size={13} />{TYPE[q.type][1]}</span>
          {saveEl && <span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0 }}>{saveEl}</span>}
        </div>
        <h2 ref={headRef} tabIndex={-1} data-pq-focus="" style={{ margin: 0, font: desk ? '600 22px/1.4 var(--font-sans)' : 'var(--type-question)', color: 'var(--text-title)', maxWidth: '72ch', textWrap: 'pretty', outline: 'none', boxShadow: 'none', overflowWrap: 'anywhere' }}>
          <Markdown inlineOnly source={q.prompt} />
        </h2>
      </div>
      {q.body && <div style={{ minWidth: 0 }}><Markdown source={q.body} /></div>}
      {answer}
      {closed && <ErrorMessage tone="warning" message="Phiên thi đã đóng — không lưu thêm được nữa." />}
      {submitError && <ErrorMessage message={submitError} />}
    </div>
  );
}
