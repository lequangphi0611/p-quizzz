/** Hands a text file to the browser's download (an invisible link to a Blob). Offline: nothing leaves the page. */
export function saveTextFile(filename: string, text: string, mime = 'text/markdown;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Some browsers start the download after the click returns: free the URL a little later.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
