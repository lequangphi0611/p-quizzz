import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Components } from 'react-markdown';

// Basic typography via Tailwind classes (no typography plugin). Code colours come from highlight.js' github-dark theme.
const components: Components = {
  p: p => <p className="my-2 leading-relaxed" {...p} />,
  ul: p => <ul className="my-2 list-disc pl-6" {...p} />,
  ol: p => <ol className="my-2 list-decimal pl-6" {...p} />,
  h1: p => <h1 className="mt-4 mb-2 text-2xl font-bold" {...p} />,
  h2: p => <h2 className="mt-4 mb-2 text-xl font-bold" {...p} />,
  h3: p => <h3 className="mt-3 mb-1 text-lg font-semibold" {...p} />,
  blockquote: p => <blockquote className="my-2 border-l-4 border-neutral-300 pl-3 text-neutral-600" {...p} />,
  a: p => <a target="_blank" rel="noreferrer" {...p} />,
  table: p => <div className="my-3 overflow-x-auto"><table className="w-full border-collapse text-sm" {...p} /></div>,
  th: p => <th className="border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-left font-semibold" {...p} />,
  td: p => <td className="border border-neutral-300 px-3 py-1.5" {...p} />,
  pre: p => <pre className="my-3 overflow-x-auto rounded-lg bg-[#0d1117] p-0 text-sm leading-relaxed" {...p} />,
  code: ({ className, children, ...rest }) => {
    // Fenced blocks get a `language-*`/`hljs` class from rehype-highlight; plain inline code does not.
    const block = /\b(hljs|language-)/.test(className ?? '');
    return block
      ? <code className={`${className} block p-4`} {...rest}>{children}</code>
      : <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[0.9em] text-neutral-900" {...rest}>{children}</code>;
  },
};

// Option texts and question prompts are one-liners: render without the block <p> wrapper.
const inlineComponents: Components = { ...components, p: ({ children }) => <>{children}</> };

export function Markdown({ source, className, inlineOnly = false }: { source: string; className?: string; inlineOnly?: boolean }) {
  if (inlineOnly) {
    return (
      <span className={className}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { detect: false }]]} components={inlineComponents}>
          {source}
        </ReactMarkdown>
      </span>
    );
  }
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { detect: false }]]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
