const argValue = (flag: string): string | undefined => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0', // 0.0.0.0 so members on the LAN can connect
  dbFile: process.env.DB_FILE ?? 'data/p-quizzz.db',
  serveWeb: process.argv.includes('--serve-web'),
  // By default /api/admin/* answers only on the mentor's own machine. Opt in to remote admin with the flag or env.
  allowRemoteAdmin: process.argv.includes('--allow-remote-admin') || process.env.ALLOW_REMOTE_ADMIN === '1',
  // The mentor's own AI grading command (PRODUCT.md §7.28g). Not committed: config/*.local.json is gitignored.
  aiGraderConfig: argValue('--ai-grader-config') ?? process.env.AI_GRADER_CONFIG ?? 'config/ai-grader.local.json',
};
