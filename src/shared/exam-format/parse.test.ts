import { describe, expect, it } from 'vitest';
import { parseExam } from './parse.js';

const fm = (body: string, title = 'Đề test') => `---\ntitle: ${title}\n---\n\n${body}`;
const lineOf = (src: string, needle: string) => src.split('\n').findIndex((l) => l.includes(needle)) + 1;

describe('parseExam — valid input', () => {
  it('parses single, multi and essay questions', () => {
    const src = fm(`## Lệnh nào tạo branch mới?
- [ ] git branch
- [x] git checkout -b new
> checkout -b tạo + chuyển.

## Lệnh nào viết lại lịch sử? {points=2}
- [x] git rebase
- [x] git commit --amend
- [ ] git status
> Cả hai tạo commit mới.

## So sánh merge và rebase {essay, points=5}
> Rubric: 2đ merge, 2đ rebase, 1đ khi nào dùng.
`);
    const { exam, errors } = parseExam(src);
    expect(errors).toEqual([]);
    expect(exam!.title).toBe('Đề test');
    expect(exam!.questions.map((q) => q.type)).toEqual(['single', 'multi', 'essay']);
    expect(exam!.questions.map((q) => q.points)).toEqual([1, 2, 5]);
    expect(exam!.totalPoints).toBe(8);
    expect(exam!.hasEssay).toBe(true);
    expect(exam!.questions[2]!.prompt).toBe('So sánh merge và rebase');
    expect(exam!.questions[0]!.line).toBe(lineOf(src, 'Lệnh nào tạo branch'));
  });

  it('keeps code blocks in the body and ignores markers inside them', () => {
    const src = fm(`## Đoạn code sau in ra gì?
\`\`\`js
## not a heading
- [x] not an option
> not an explanation
console.log(1 + '1');
\`\`\`
- [x] 11
- [ ] 2
> Cộng chuỗi.`);
    const { exam, errors } = parseExam(src);
    expect(errors).toEqual([]);
    const q = exam!.questions[0]!;
    expect(q.body).toContain('## not a heading');
    expect(q.body.startsWith('```js')).toBe(true);
    expect(q.options).toEqual([
      { text: '11', correct: true },
      { text: '2', correct: false },
    ]);
  });

  it('treats non-meta braces in the heading as prompt text', () => {
    const { exam, errors } = parseExam(fm(`## Kết quả của \`{a: 1}\` là gì?\n- [x] object\n- [ ] array\n> x`));
    expect(errors).toEqual([]);
    expect(exam!.questions[0]!.prompt).toBe('Kết quả của `{a: 1}` là gì?');
  });

  it('accepts multi-paragraph explanations, CRLF and BOM', () => {
    const src = '﻿' + fm(`## Q\n- [x] a\n- [ ] b\n> đoạn 1\n\n> đoạn 2`).replace(/\n/g, '\r\n');
    const { exam, errors } = parseExam(src);
    expect(errors).toEqual([]);
    expect(exam!.questions[0]!.explanation).toBe('đoạn 1\n\nđoạn 2');
  });

  it('keeps a fenced code block inside the explanation (each line prefixed with `>`)', () => {
    const src = fm('## Viết hàm {essay, points=2}\n> Đáp án mẫu:\n>\n> ```kotlin\n> fun f() {\n>\n>     println(1)\n> }\n> ```\n> Rubric: 2đ.');
    const { exam, errors } = parseExam(src);
    expect(errors).toEqual([]);
    expect(exam!.questions[0]!.explanation).toBe('Đáp án mẫu:\n\n```kotlin\nfun f() {\n\n    println(1)\n}\n```\nRubric: 2đ.');
  });
});

describe('parseExam — errors (with line numbers)', () => {
  const cases: [string, string, string][] = [
    ['missing frontmatter', '## Q\n- [x] a\n- [ ] b', 'Thiếu frontmatter'],
    ['missing title', '---\ndescription: x\n---\n## Q\n- [x] a\n- [ ] b', 'thiếu `title`'],
    ['no questions', fm(''), 'chưa có câu hỏi'],
    ['content before first question', fm('Giới thiệu đề\n## Q\n- [x] a\n- [ ] b'), 'ngoài câu hỏi'],
    ['no correct answer', fm('## Q\n- [ ] a\n- [ ] b'), 'chưa đánh dấu đáp án đúng'],
    ['single option', fm('## Q\n- [x] a'), 'ít nhất 2 đáp án'],
    ['no options, not essay', fm('## Q\nnội dung'), 'Nếu là câu tự luận'],
    ['letter-style options', fm('## Q\nA. một\nB. hai'), 'dạng "A. …"'],
    ['essay with options', fm('## Q {essay}\n- [x] a\n- [ ] b'), 'không được có đáp án'],
    ['unknown meta key (typo)', fm('## Q {esay}\n> x'), 'Thuộc tính không hợp lệ'],
    ['bad points', fm('## Q {points=0}\n- [x] a\n- [ ] b'), 'points phải là số nguyên'],
    ['text after options', fm('## Q\n- [x] a\ndòng lạc\n- [ ] b'), 'không phải đáp án'],
    ['option after explanation', fm('## Q\n- [x] a\n> x\n- [ ] b'), 'sau phần giải thích'],
    ['text after explanation', fm('## Q\n- [x] a\n- [ ] b\n> x\nthêm'), 'Sau phần giải thích'],
    ['code block after options', fm('## Q\n- [x] a\n- [ ] b\n```\nx\n```'), 'trước danh sách đáp án'],
    ['unclosed code block', fm('## Q\n```js\nx'), 'chưa được đóng'],
    ['wrong heading level', fm('# Tiêu đề\n## Q\n- [x] a\n- [ ] b'), 'Chỉ dùng `## `'],
    ['duplicate option', fm('## Q\n- [x] a\n- [ ] A'), 'Đáp án trùng'],
    ['duplicate question', fm('## Q\n- [x] a\n- [ ] b\n## q\n- [x] a\n- [ ] b'), 'Câu hỏi trùng'],
  ];

  it.each(cases)('%s', (_name, src, message) => {
    const { exam, errors } = parseExam(src);
    expect(exam).toBeNull();
    expect(errors.some((e) => e.message.includes(message))).toBe(true);
    for (const e of errors) expect(e.line).toBeGreaterThanOrEqual(1);
  });

  it('points at the offending line', () => {
    const src = fm('## Q1\n- [x] a\n- [ ] b\n> ok\n\n## Q2\n- [ ] a\n- [ ] b');
    const { errors } = parseExam(src);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.line).toBe(lineOf(src, '## Q2'));
  });

  it('reports every error in one pass', () => {
    const { errors } = parseExam(fm('## Q1\n- [ ] a\n- [ ] b\n## Q2 {essay}\n- [x] a\n## Q3\n- [x] a'));
    expect(errors).toHaveLength(3);
  });
});

describe('parseExam — warnings (exam still valid)', () => {
  it('warns on missing explanation and positional options', () => {
    const src = fm('## Q\n- [x] Tất cả các đáp án trên\n- [ ] b\n- [ ] A và B');
    const { exam, warnings } = parseExam(src);
    expect(exam).not.toBeNull();
    expect(warnings.filter((w) => w.message.includes('trộn'))).toHaveLength(2);
    expect(warnings.some((w) => w.message.includes('Nên có giải thích'))).toBe(true);
  });

  it('warns about images that point outside the LAN, but not local ones', () => {
    const src = fm('## Q ![x](https://evil.test/a.png)\n- [x] a\n- [ ] b\n> g\n\n## R ![y](/img/a.png)\n- [x] a\n- [ ] b\n> g');
    const { exam, warnings } = parseExam(src);
    expect(exam).not.toBeNull();
    const ext = warnings.filter(w => w.message.includes('bên ngoài'));
    expect(ext).toHaveLength(1);
    expect(ext[0]!.line).toBeGreaterThan(0);
  });

  it('does not flag ordinary wording like "cả hai mục"', () => {
    const { warnings } = parseExam(fm('## Q\n- [x] Xuất hiện ở cả hai mục\n- [ ] Untracked\n> x'));
    expect(warnings).toEqual([]);
  });

  it('warns on essay without rubric and all-correct options', () => {
    const { warnings } = parseExam(fm('## E {essay}\n\n## M\n- [x] a\n- [x] b\n> x'));
    expect(warnings.some((w) => w.message.includes('rubric'))).toBe(true);
    expect(warnings.some((w) => w.message.includes('Tất cả đáp án đều đúng'))).toBe(true);
  });
});
