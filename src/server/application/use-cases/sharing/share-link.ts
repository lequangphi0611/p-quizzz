import type { ShareLinkInfo } from '../../../../shared/api/index.js';
import type { SharedSessionReader, ShareTokenStore } from '../../ports/share.js';
import type { TokenGenerator } from '../../ports/token-generator.js';

interface Deps { store: ShareTokenStore; tokens: TokenGenerator; shared: SharedSessionReader }

/** Mentor: the share page's token (made the first time it is asked for) and how many sessions it lists. */
export class GetShareLink {
  constructor(private readonly deps: Deps) {}

  async execute(): Promise<ShareLinkInfo> {
    const token = (await this.deps.store.get()) ?? (await this.deps.store.getOrCreate(this.deps.tokens.generate()));
    return { token, sharedCount: (await this.deps.shared.listShared()).length };
  }
}

/** "Đổi link" (PRODUCT.md §7.33b): a new token; everyone holding the old link gets the neutral "link không mở được". */
export class RotateShareLink {
  constructor(private readonly deps: Deps) {}

  async execute(): Promise<ShareLinkInfo> {
    const token = this.deps.tokens.generate();
    await this.deps.store.replace(token);
    return { token, sharedCount: (await this.deps.shared.listShared()).length };
  }
}
