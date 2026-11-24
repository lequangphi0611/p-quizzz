/** Hands a file (a `Blob`: a zip, a text) to the browser's download through an invisible link. Offline: nothing leaves the page. */
export function saveBlobFile(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
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
