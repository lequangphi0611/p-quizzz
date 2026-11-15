import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Markdown } from './Markdown.js';

const render = (source: string) => renderToStaticMarkup(createElement(Markdown, { source }));

describe('<Markdown>', () => {
  it('highlights fenced code blocks', () => {
    const html = render('```bash\necho "hi"\n```');
    expect(html).toContain('<pre');
    expect(html).toContain('hljs');
    expect(html).toContain('hljs-string');
  });

  it('renders GFM tables', () => {
    const html = render('| a | b |\n|---|---|\n| 1 | 2 |');
    expect(html).toContain('<table');
    expect(html).toContain('<th');
  });

  it('renders inline code without block styling', () => {
    const html = render('chạy `git status` ngay');
    expect(html).toContain('<code class="rounded');
    expect(html).not.toContain('hljs');
  });

  it('inlineOnly renders inline code without a block <p> wrapper', () => {
    const html = renderToStaticMarkup(createElement(Markdown, { source: 'Chạy `git add`', inlineOnly: true }));
    expect(html).not.toContain('<p');
    expect(html).toContain('<code');
  });
});
