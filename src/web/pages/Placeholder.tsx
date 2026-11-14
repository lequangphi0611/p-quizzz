import { useParams } from 'react-router';

// Temporary page for routes whose real screens land in later stories.
export function Placeholder({ title, story }: { title: string; story: string }) {
  const params = useParams();
  const extra = Object.entries(params).map(([k, v]) => `${k}=${v}`).join(' · ');
  return (
    <div className="grid gap-1">
      <h1 style={{ font: 'var(--type-h1)', color: 'var(--text-title)', margin: 0 }}>{title}</h1>
      <p style={{ font: 'var(--type-meta)', color: 'var(--text-meta)', margin: 0 }}>Sẽ làm ở {story}{extra && ` · ${extra}`}</p>
    </div>
  );
}
