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

  it('never renders a remote image (offline LAN, and it would leak the viewer IP); shows a placeholder instead', () => {
    for (const src of ['https://evil.test/a.png', 'http://evil.test/a.png', '//evil.test/a.png', 'HTTPS://EVIL.TEST/a.png']) {
      const html = render(`![sơ đồ](${src})`);
      expect(html).not.toContain('<img');
      expect(html).not.toContain('evil.test');
      expect(html).toContain('Ảnh ngoài bị chặn');
    }
  });

  it('keeps same-origin and data: images', () => {
    expect(render('![a](/assets/a.png)')).toContain('<img');
    expect(render('![a](a.png)')).toContain('<img');
    expect(render('![a](data:image/png;base64,AAAA)')).toContain('<img');
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
