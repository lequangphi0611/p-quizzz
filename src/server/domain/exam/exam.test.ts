import { describe, expect, it } from 'vitest';
import { newExam, type NewExamInput } from './exam.js';

const input = (types: ('single' | 'multi' | 'essay')[], points = 2): NewExamInput => ({
  title: 'T',
  description: null,
  durationMinutes: null,
  sourceMarkdown: '# T',
  createdAt: new Date(5),
  questions: types.map(type => ({
    type,
    prompt: `Q-${type}`,
    body: '',
    points,
    explanation: null,
    options: type === 'essay' ? [] : [{ text: 'A', correct: true }, { text: 'B', correct: false }],
  })),
});

describe('newExam', () => {
  it('sums points and detects essay questions', () => {
    const exam = newExam(input(['single', 'multi', 'essay'], 3));
    expect(exam.totalPoints).toBe(9);
    expect(exam.hasEssay).toBe(true);
    expect(newExam(input(['single', 'multi'])).hasEssay).toBe(false);
  });

  it('numbers questions and options from 1, in the given order', () => {
    const exam = newExam(input(['single', 'essay', 'multi']));
    expect(exam.questions.map(q => [q.position, q.type])).toEqual([[1, 'single'], [2, 'essay'], [3, 'multi']]);
    expect(exam.questions[0]!.options.map(o => [o.position, o.text, o.isCorrect])).toEqual([[1, 'A', true], [2, 'B', false]]);
    expect(exam.questions[1]!.options).toEqual([]);
  });

  it('keeps title, description, source and creation time', () => {
    expect(newExam(input([]))).toMatchObject({ title: 'T', description: null, sourceMarkdown: '# T', createdAt: new Date(5), totalPoints: 0 });
  });
});
