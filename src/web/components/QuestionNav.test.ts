import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QuestionNav } from './QuestionNav.js';

const render = (size: 'md' | 'screen', count: number) =>
  renderToStaticMarkup(createElement(QuestionNav, { count, current: 0, answered: [], size, onSelect: () => {} }));

describe('<QuestionNav>', () => {
  it('projector strip stays on one row for a long exam (the caller scrolls it sideways)', () => {
    // A wrapped second row overflowed the fixed-height bar of the discussion screen and covered the header.
    const html = render('screen', 34);
    expect(html).toContain('flex-wrap:nowrap');
    expect(html).not.toContain('flex-wrap:wrap');
    expect((html.match(/<button/g) ?? []).length).toBe(34);
  });

  it('the compact strip for members still wraps', () => {
    expect(render('md', 34)).toContain('flex-wrap:wrap');
  });
});
