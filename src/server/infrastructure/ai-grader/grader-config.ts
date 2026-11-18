import { readFile } from 'node:fs/promises';
import { z } from 'zod';

// The mentor's AI command (docs/architecture.md §11.6). Read on every use so edits apply without a restart.
// Its content is never logged nor sent to a client: errors here say what is wrong, not what the file holds.

const GraderConfigSchema = z.object({
  command: z.string().trim().min(1),
  args: z.array(z.string()).max(50).default([]),
  timeoutSeconds: z.number().int().min(10).max(1800).default(120),
  concurrency: z.number().int().min(1).max(4).default(1),
  maxAnswerChars: z.number().int().min(100).max(200_000).default(20_000),
});

export type GraderConfig = z.infer<typeof GraderConfigSchema>;

// Flags the app sets itself, or that would give the AI tools, other directories, plugins/agents or skip permissions.
const FORBIDDEN = [
  '-p',
  '--print',
  '--mcp-config',
  '--tools',
  '--allowedtools',
  '--allowed-tools',
  '--disallowedtools',
  '--disallowed-tools',
  '--dangerously-skip-permissions',
  '--allow-dangerously-skip-permissions',
  '--add-dir',
  '--plugin-dir',
  '--agents',
  '--permission-mode',
  '--system-prompt',
  '--system-prompt-file',
  '--append-system-prompt',
  '--append-system-prompt-file',
  '--json-schema',
  '--output-format',
  '--input-format',
  '--resume',
  '-r',
  '--continue',
  '-c',
];

export type ConfigResult = { ok: true; config: GraderConfig } | { ok: false; problem: string };

/** Pure check of a parsed file, separate from reading it so it can be tested. */
export function checkGraderConfig(raw: unknown, platform: NodeJS.Platform = process.platform): ConfigResult {
  const parsed = GraderConfigSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, problem: 'Tệp cấu hình AI sai định dạng' };
  const cfg = parsed.data;
  const bad = cfg.args.find(a => FORBIDDEN.includes(a.split('=')[0]!.toLowerCase()));
  if (bad) return { ok: false, problem: `Cấu hình AI không được chứa cờ ${bad.split('=')[0]} (app tự đặt hoặc cờ không an toàn)` };
  // Node refuses to spawn .cmd/.bat without a shell, and a shell would parse the prompt (docs/architecture.md §11.6).
  if (platform === 'win32' && /\.(cmd|bat)$/i.test(cfg.command))
    return { ok: false, problem: 'Trên Windows, "command" không được là tệp .cmd/.bat: trỏ tới node (và đặt đường dẫn cli.js của Claude Code đầu "args") hoặc tới tệp .exe' };
  return { ok: true, config: cfg };
}

export async function loadGraderConfig(path: string): Promise<ConfigResult> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return { ok: false, problem: 'Chưa có tệp cấu hình AI' };
  }
  try {
    return checkGraderConfig(JSON.parse(text));
  } catch {
    return { ok: false, problem: 'Tệp cấu hình AI không phải JSON hợp lệ' };
  }
}
