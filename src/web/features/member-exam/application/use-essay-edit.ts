import { useCallback, useEffect, useRef, useState } from 'react';
import type { AttemptView } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { AnswerSaver, type SaveState } from './answer-saver.js';
import { useExamGateway } from './exam-gateway-context.js';
import { errorText } from './taking-controller.js';

export interface EssayEdit {
  view: AttemptView | null;
  texts: Record<number, string>;
  save: SaveState;
  error: string;
  /** The "Hoàn tất sửa bài?" dialog is open. */
  confirming: boolean;
  finishing: boolean;
  setText: (questionId: number, text: string) => void;
  retrySave: () => void;
  requestFinish: () => void;
  cancelFinish: () => void;
  finish: () => Promise<void>;
}

/**
 * The essays of an approved edit request (PRODUCT.md §7.21): loads the submitted attempt, autosaves typed text through
 * AnswerSaver, and ends the editing window for good with `finish`. Choice answers never change here.
 */
export function useEssayEdit(attemptId: number, onChanged: () => Promise<void>): EssayEdit {
  const gateway = useExamGateway();
  const [view, setView] = useState<AttemptView | null>(null);
  const [texts, setTexts] = useState<Record<number, string>>({});
  const [save, setSave] = useState<SaveState>('saved');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const saver = useRef<AnswerSaver | null>(null);
  const changed = useRef(onChanged);
  changed.current = onChanged;

  useEffect(() => {
    const s = new AnswerSaver(
      async (questionId, payload) => {
        try { await gateway.saveAnswer(attemptId, questionId, payload); }
        catch (err) {
          if (err instanceof ApiError && err.status === 409) { setError('Phiên đã đóng hoặc việc sửa bài đã kết thúc — không lưu thêm được.'); void changed.current(); }
          throw err;
        }
      },
      setSave,
    );
    saver.current = s;
    let live = true;
    gateway.getAttempt(attemptId).then(
      v => { if (live) { setView(v); setTexts(Object.fromEntries(v.answers.filter(a => a.textAnswer !== null).map(a => [a.questionId, a.textAnswer!]))); } },
      err => { if (live) setError(errorText(err, 'Không tải được bài làm')); },
    );
    return () => { live = false; void s.flushAll().finally(() => s.dispose()); };
  }, [gateway, attemptId]);

  const setText = useCallback((questionId: number, text: string) => {
    setTexts(t => ({ ...t, [questionId]: text }));
    saver.current?.queue(questionId, { textAnswer: text }, true);
  }, []);

  const finish = useCallback(async () => {
    setFinishing(true); setError('');
    try {
      if (!(await saver.current!.flushAll())) throw new Error('unsaved');
      await gateway.finishEdit(attemptId);
      await changed.current();
    } catch (err) {
      setConfirming(false);
      setError(err instanceof ApiError ? err.message : 'Còn phần chưa lưu được. Kiểm tra mạng rồi thử lại.');
      setFinishing(false);
    }
  }, [gateway, attemptId]);

  return { view, texts, save, error, confirming, finishing, setText, retrySave: () => void saver.current?.retry(), requestFinish: () => setConfirming(true), cancelFinish: () => setConfirming(false), finish };
}
