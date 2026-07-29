/**
 * The agent answers in Markdown for the PWA, which renders it. WeChat's `Text`
 * shows raw characters, so emphasis, headings and list markers are flattened to
 * readable plain text instead of leaking `**` and `#` into the thread.
 *
 * Patterns avoid lookbehind, which older WeChat runtimes on iOS do not support.
 */
export function flattenMarkdown(source: string): string {
  return source
    .replace(/```[\w-]*\n?/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/gm, "")
    .replace(/^(\s*)[-*+]\s+/gm, "$1· ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/(^|[\s(])_([^_\n]+)_/g, "$1$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
