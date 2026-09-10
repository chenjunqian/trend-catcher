function inline(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

export function renderMarkdown(md: string): string {
  const blocks = md.trim().split(/\n{2,}/);
  const html: string[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").filter((line) => line.trim().length > 0);
    let paragraph: string[] = [];

    const flushParagraph = () => {
      if (paragraph.length > 0) {
        html.push(`<p>${inline(paragraph.join(" "))}</p>`);
        paragraph = [];
      }
    };

    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();

      if (/^[-*]\s+/.test(line)) {
        flushParagraph();
        const items: string[] = [];
        while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
          items.push(`<li>${inline(lines[i].trim().replace(/^[-*]\s+/, ""))}</li>`);
          i++;
        }
        html.push(`<ul>${items.join("")}</ul>`);
        continue;
      }

      if (/^\d+[.)]\s+/.test(line)) {
        flushParagraph();
        const items: string[] = [];
        while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
          items.push(`<li>${inline(lines[i].trim().replace(/^\d+[.)]\s+/, ""))}</li>`);
          i++;
        }
        html.push(`<ol>${items.join("")}</ol>`);
        continue;
      }

      if (line.startsWith(">")) {
        flushParagraph();
        const quoted: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith(">")) {
          quoted.push(lines[i].trim().replace(/^>\s?/, ""));
          i++;
        }
        html.push(`<blockquote>${inline(quoted.join(" "))}</blockquote>`);
        continue;
      }

      const heading = line.match(/^(#{1,3})\s+(.*)$/);
      if (heading) {
        flushParagraph();
        html.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
        i++;
        continue;
      }

      paragraph.push(line);
      i++;
    }

    flushParagraph();
  }

  return html.join("\n");
}

export function stripMarkdownPreview(md: string, maxLen: number = 200): string {
  return md
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#+\s/gm, "")
    .replace(/\n\n/g, " ")
    .replace(/\n/g, " ")
    .slice(0, maxLen)
    + (md.length > maxLen ? "..." : "");
}
