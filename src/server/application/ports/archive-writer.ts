/** One file to put in an archive. `name` is ASCII; `content` is UTF-8 text. */
export interface ArchiveFile {
  name: string;
  content: string;
}

/** Packs files into a zip the mentor can open anywhere (PRODUCT.md §7.36b). */
export interface ArchiveWriter {
  zip(files: readonly ArchiveFile[]): Promise<Buffer>;
}
