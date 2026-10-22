// A small, safe Markdown → HTML renderer for reports. Everything is escaped first; only http(s) links are kept.
// Supports headings, paragraphs, lists (one level of nesting), bold/italic/code, links, tables, quotes, rules,
// [n] citations (linked to the numbered source list) and ⚠️ lines (shown as "uncertain").

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(text: string): string {
  let s = esc(text);
  const codes: string[] = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(`<code>${c}</code>`) - 1}\u0000`);
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, t, u) => `<a href="${u}" target="_blank" rel="noreferrer">${t}</a>`);
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:!?])/g, (_, pre, u) => `${pre}<a href="${u}" target="_blank" rel="noreferrer">${u}</a>`);
  s = s.replace(/\[(\d{1,3})\](?!\()/g, (_, n) => `<a class="cite" href="#source-${n}" aria-label="source ${n}">[${n}]</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
  return s;
}

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let inSources = false;
  const flush = () => {
    if (!para.length) return;
    const text = para.join(" ");
    out.push(text.trim().startsWith("⚠️") ? `<p class="uncertain">${inline(text)}</p>` : `<p>${inline(text)}</p>`);
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flush();
      const level = Math.min(4, h[1].length + 1); // the page has its own h1
      inSources = /^sources\b/i.test(h[2].trim());
      const id = h[2].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      out.push(`<h${level} id="${id}">${inline(h[2])}</h${level}>`);
      continue;
    }
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      flush();
      out.push("<hr>");
      continue;
    }
    if (/^\s*>/.test(line)) {
      flush();
      const q: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ""));
      i--;
      out.push(`<blockquote>${inline(q.join(" "))}</blockquote>`);
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      flush();
      const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      i--;
      out.push(
        `<div class="table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`,
      );
      continue;
    }
    const li = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (li) {
      flush();
      const ordered = /\d/.test(li[2]);
      const items: { text: string; num: number | null; sub: string[] }[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        if (m && m[1].length < 2) items.push({ text: m[3], num: /\d/.test(m[2]) ? parseInt(m[2], 10) : null, sub: [] });
        else if (m && items.length) items[items.length - 1].sub.push(m[3]);
        else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) items[items.length - 1].text += ` ${lines[i].trim()}`;
        else break;
        i++;
      }
      i--;
      const tag = ordered ? "ol" : "ul";
      const start = ordered && items[0]?.num && items[0].num !== 1 ? ` start="${items[0].num}"` : "";
      out.push(
        `<${tag}${start}${inSources ? ' class="sources"' : ""}>${items
          .map((it, k) => {
            const n = it.num ?? k + 1;
            const sub = it.sub.length ? `<ul>${it.sub.map((x) => `<li>${inline(x)}</li>`).join("")}</ul>` : "";
            const cls = it.text.trim().startsWith("⚠️") ? ' class="uncertain"' : "";
            return `<li${inSources && ordered ? ` id="source-${n}"` : ""}${cls}>${inline(it.text)}${sub}</li>`;
          })
          .join("")}</${tag}>`,
      );
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return out.join("\n");
}
