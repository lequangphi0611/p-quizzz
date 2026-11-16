import { createContext } from 'react';
import type { TokenStore } from './token-store.js';

/** The composition root provides the TokenStore to features that need to remember who the member is. */
export const TokenStoreContext = createContext<TokenStore | null>(null);
