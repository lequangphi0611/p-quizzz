import type { ParsedQuestion, QuestionType } from '../../shared/exam-format/index.js';
import { AnswerOption, type OptionResult } from './AnswerOption.js';
import { Markdown } from './Markdown.js';
import { Icon } from './ui/Icon.js';

// Shape shared by a parsed (import preview) question and a stored one (exam detail / review).
export interface PreviewQuestion {
  type: QuestionType;
  prompt: string;
  body: string;
  points: number;
  explanation: string | null;
  options: { id?: number; text: string; isCorrect: boolean }[];
}

export const fromParsed = (q: ParsedQuestion): PreviewQuestion => ({
  type: q.type,
  prompt: q.prompt,
  body: q.body,
  points: q.points,
  explanation: q.explanation,
  options: q.options.map(o => ({ text: o.text, isCorrect: o.correct })),
});

const TYPE_LABEL: Record<QuestionType, string> = { single: 'Một đáp án', multi: 'Nhiều đáp án', essay: 'Tự luận' };
const fmt = (n: number) => String(n).replace('.', ',');
const label = { font: 'var(--type-label)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--text-meta)' } as const;

// `preview` (mentor): correct answers marked, explanation shown.
// `review` (member after close, S16): compares `selectedIds` / `answerText` with the key and shows the score.
export function QuestionPreview({ question: q, index = 0, mode = 'preview', selectedIds = [], answerText, manualScore, feedback }: {
  question: PreviewQuestion; index?: number; mode?: 'preview' | 'review'; selectedIds?: number[]; answerText?: string; manualScore?: number | null; feedback?: string | null;
}) {
  const sel = new Set(selectedIds);
  const review = mode === 'review';
  const idOf = (o: { id?: number }, i: number) => o.id ?? i;

  let earned: number | null = null;
  if (review && q.type !== 'essay') earned = q.options.every((o, i) => o.isCorrect === sel.has(idOf(o, i))) ? q.points : 0;
  if (review && q.type === 'essay') earned = manualScore ?? null;

  return (
    <article style={{ background: 'var(--surface-card)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: 20, display: 'grid', gap: 14 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', font: 'var(--type-label)', color: 'var(--text-meta)' }}>
        <span style={{ color: 'var(--brand-700)' }}>Câu {index + 1}</span><span>·</span><span>{q.points} điểm</span><span>·</span><span>{TYPE_LABEL[q.type]}</span>
        {review && (
          <span style={{ marginLeft: 'auto', font: 'var(--type-score)', fontSize: 14, padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: earned == null ? 'var(--ink-100)' : earned > 0 ? 'var(--correct-surface)' : 'var(--wrong-surface)', color: earned == null ? 'var(--ink-600)' : earned > 0 ? 'var(--correct-600)' : 'var(--wrong-600)' }}>
            {earned == null ? 'Chưa chấm' : `${fmt(earned)}/${q.points}`}
          </span>
        )}
      </header>

      <h3 style={{ margin: 0, font: 'var(--type-question)', color: 'var(--text-title)', textWrap: 'pretty' }}><Markdown inlineOnly source={q.prompt} /></h3>
      {q.body && <Markdown source={q.body} />}
      {q.type === 'multi' && !review && <div style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Chọn tất cả đáp án đúng</div>}

      {q.type !== 'essay' && (
        <div style={{ display: 'grid', gap: 8 }}>
          {q.options.map((o, i) => {
            const chosen = sel.has(idOf(o, i));
            let result: OptionResult | undefined;
            if (!review) result = o.isCorrect ? 'correct' : 'neutral';
            else result = chosen ? (o.isCorrect ? 'correct' : 'wrong') : o.isCorrect ? 'missed' : 'neutral';
            return <AnswerOption key={idOf(o, i)} kind={q.type === 'multi' ? 'multi' : 'single'} text={o.text} result={result} selected={chosen} />;
          })}
        </div>
      )}

      {q.type === 'essay' && !review && (
        <div style={{ padding: '14px 16px', border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-md)', color: 'var(--text-faint)', font: 'var(--type-meta)' }}>Ô nhập câu trả lời tự luận</div>
      )}
      {q.type === 'essay' && review && (
        <div style={{ font: 'var(--type-code)', whiteSpace: 'pre-wrap', background: 'var(--ink-050)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-md)', padding: '12px 14px', color: 'var(--ink-900)' }}>
          {answerText || <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-sans)' }}>(Bỏ trống)</span>}
        </div>
      )}

      {review && feedback && (
        <div style={{ display: 'flex', gap: 8, font: 'var(--type-body)', fontSize: 15, color: 'var(--brand-800)', background: 'var(--brand-050)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
          <Icon name="message-square" size={16} style={{ marginTop: 4 }} /><span><b>Nhận xét:</b> {feedback}</span>
        </div>
      )}

      {q.explanation && (
        <div style={{ background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', padding: '12px 14px', display: 'grid', gap: 6 }}>
          <div style={label}>{q.type === 'essay' ? 'Đáp án mẫu & rubric' : 'Giải thích'}</div>
          <Markdown source={q.explanation} />
        </div>
      )}
    </article>
  );
}
