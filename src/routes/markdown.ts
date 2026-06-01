export function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n- /g, "\n<li>")
    .replace(/(<li>.*?)\n/g, "$1</li>\n")
    .replace(/((?:<li>.*?<\/li>\n?)+)/g, "<ul>$1</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[a-z/])(.+)$/gm, "<p>$1</p>")
    .replace(/<\/ul><p><\/p><ul>/g, "</ul><ul>")
    .replace(/<\/ul>\s*<p>\s*<\/p>\s*<ul>/g, "</ul><ul>")
    .replace(/<p><\/p>/g, "");
}

export function stripMarkdownPreview(md: string, maxLen: number = 200): string {
  return md
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#+\s/gm, "")
    .replace(/\n\n/g, " ")
    .replace(/\n/g, " ")
    .slice(0, maxLen)
    + (md.length > maxLen ? "..." : "");
}
