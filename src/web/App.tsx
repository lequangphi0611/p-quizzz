import { useEffect, useState } from 'react';
import type { HealthResponse } from '../shared/api.js';

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json() as Promise<HealthResponse>)
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <main>
      <h1>p-quizzz</h1>
      <p>Server: {health ? `${health.status} (v${health.version})` : 'đang kết nối...'}</p>
    </main>
  );
}
