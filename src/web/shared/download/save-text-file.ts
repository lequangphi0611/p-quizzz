import { saveBlobFile } from './save-blob-file.js';

/** Hands a text file to the browser's download (an invisible link to a Blob). Offline: nothing leaves the page. */
export function saveTextFile(filename: string, text: string, mime = 'text/markdown;charset=utf-8'): void {
  saveBlobFile(filename, new Blob([text], { type: mime }));
}
