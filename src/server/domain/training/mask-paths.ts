/**
 * Replaces the home folder of a user in a path with `~` (PRODUCT.md §7.39j): `/home/<name>`, `/var/home/<name>` (Fedora Silverblue and co.), `/Users/<name>`, WSL `/mnt/c/Users/<name>`, `C:\Users\<name>` and
 * `C:/Users/<name>` for any drive. The user name is the part that tells who ran the command. Used for the teaching examples only
 * (the report and the zip keep what was collected). Idempotent. A hint like `maskSecrets`: it knows these shapes and no others.
 */
const NAME = String.raw`[^\\/\s"'\`<>|:*?;,()\[\]{}]+`;
const POSIX = new RegExp(String.raw`(?<![\w.~-])/(?:var/home|home|Users|mnt/[a-z]/Users)/${NAME}`, 'gi');
const WINDOWS = new RegExp(String.raw`(?<![A-Za-z0-9])[A-Za-z]:[\\/]Users[\\/]${NAME}`, 'gi');

export const maskHomePaths = (text: string): string => text.replace(WINDOWS, '~').replace(POSIX, '~');
