import { useEffect, useState, type ReactNode, type Ref } from 'react';

export const STAGE_W = 1920;
export const STAGE_H = 1080;

// Projector pages are laid out once for a 1920×1080 screen and scaled to whatever window they are shown in,
// so text keeps its proportions on any display (laptop 1366×768 included). `reduceMotion` zeroes the motion tokens.
export function ScreenStage({ children, stageRef, reduceMotion = false }: { children: ReactNode; stageRef?: Ref<HTMLDivElement>; reduceMotion?: boolean }) {
  const fit = () => Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
  const [scale, setScale] = useState(fit);
  useEffect(() => {
    const on = () => setScale(fit());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const still = reduceMotion ? { '--dur-fast': '0ms', '--dur-base': '0ms', '--dur-slow': '0ms', '--dur-pop': '0ms' } : null;
  return (
    <div ref={stageRef} style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--screen-bg)' }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: STAGE_W, height: STAGE_H, transform: `translate(-50%, -50%) scale(${scale})`, ...still }}>{children}</div>
    </div>
  );
}
