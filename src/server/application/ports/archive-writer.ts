/** One file to put in an archive. `name` is ASCII; `content` is UTF-8 text. */
export interface ArchiveFile {
  name: string;
  content: string;
}

/**
 * Packs files into a zip the mentor can open anywhere (PRODUCT.md §7.36b). Files can arrive one by one (an async iterable), so the
 * caller never has to hold every file's text at once; the writer keeps only the compressed bytes of each.
 */
export interface ArchiveWriter {
  zip(files: Iterable<ArchiveFile> | AsyncIterable<ArchiveFile>): Promise<Buffer>;
}
