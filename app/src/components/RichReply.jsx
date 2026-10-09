import React from "react";
import { COLORS } from "../theme/tokens";

/**
 * Renders an AI reply's markdown as real formatting inside a chat bubble.
 *
 * The models answer in markdown: headings, bold, bullet and numbered lists and,
 * for schedules like "which test, how often, why", pipe tables. Shown as plain
 * text that came through as rows of pipes and dashes. Tables in particular cannot
 * work on a phone at four columns, so each row becomes a small card: the first
 * column is its title, and every other column is a labelled line under it.
 *
 * Deliberately small: only the subset of markdown the chat models produce, no
 * HTML passthrough, so nothing in a reply can inject markup.
 */

/* ---------------- inline ---------------- */

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

function Inline({ text }) {
  const parts = String(text || "").split(INLINE);
  return parts.map((p, i) => {
    if (!p) return null;
    if (/^(\*\*|__)/.test(p)) return <strong key={i} style={{ fontWeight: 650, color: COLORS.textPrimary }}>{p.slice(2, -2)}</strong>;
    if (/^`/.test(p)) return <code key={i} style={{ fontSize: "0.92em", background: COLORS.bgCardAlt, borderRadius: 4, padding: "0 4px" }}>{p.slice(1, -1)}</code>;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(p);
    if (link) {
      const safe = /^https?:\/\//i.test(link[2]);
      return safe
        ? <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.tealLight }}>{link[1]}</a>
        : <React.Fragment key={i}>{link[1]}</React.Fragment>;
    }
    if (/^(\*|_)/.test(p) && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}

/* ---------------- blocks ---------------- */

const isTableLine = (l) => /^\s*\|.*\|?\s*$/.test(l) && l.includes("|", l.indexOf("|") + 1);
const isTableRule = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const cells = (l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

function parse(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (isTableLine(line)) {
      const rows = [];
      while (i < lines.length && (isTableLine(lines[i]) || isTableRule(lines[i]))) {
        if (!isTableRule(lines[i])) rows.push(cells(lines[i]));
        i++;
      }
      if (rows.length) blocks.push({ type: "table", header: rows[0], rows: rows.slice(1) });
      continue;
    }
    if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) { blocks.push({ type: "rule" }); i++; continue; }

    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line) || /^\s*\*\*([^*]+)\*\*:?\s*$/.exec(line);
    if (heading) { blocks.push({ type: "heading", text: heading[1].replace(/:$/, "") }); i++; continue; }

    if (/^\s*(?:[-*•]|\d+[.)])\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*(?:[-*•]|\d+[.)])\s+/.test(lines[i])) {
        const m = /^(\s*)([-*•]|\d+[.)])\s+(.*)$/.exec(lines[i]);
        items.push({ depth: m[1].length >= 2 ? 1 : 0, ordered: /\d/.test(m[2]), marker: m[2], text: m[3] });
        i++;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && !isTableLine(lines[i])
      && !/^\s*(?:#{1,6}\s|[-*•]\s|\d+[.)]\s|---+\s*$)/.test(lines[i])) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: "para", text: para.join(" ") });
  }
  return blocks;
}

/* ---------------- render ---------------- */

function TableCards({ header, rows }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {rows.map((r, ri) => (
        <div key={ri} style={{
          background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "8px 10px",
        }}>
          <div style={{ fontWeight: 650, color: COLORS.textPrimary, fontSize: 12.5, lineHeight: 1.4 }}>
            <Inline text={r[0]} />
          </div>
          {header.slice(1).map((h, ci) => (r[ci + 1] ? (
            <div key={ci} style={{ marginTop: 3, fontSize: 12, lineHeight: 1.45 }}>
              <span style={{
                fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
                color: COLORS.textMuted, marginRight: 6,
              }}>{h}</span>
              <Inline text={r[ci + 1]} />
            </div>
          ) : null))}
        </div>
      ))}
    </div>
  );
}

export function RichReply({ text }) {
  const blocks = parse(text);
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {blocks.map((b, i) => {
        if (b.type === "heading") {
          return (
            <div key={i} style={{ fontWeight: 700, fontSize: 13.5, color: COLORS.textPrimary, marginTop: i ? 4 : 0, lineHeight: 1.35 }}>
              <Inline text={b.text} />
            </div>
          );
        }
        if (b.type === "rule") return <div key={i} style={{ height: 1, background: COLORS.border }} />;
        if (b.type === "table") return <TableCards key={i} header={b.header} rows={b.rows} />;
        if (b.type === "list") {
          return (
            <div key={i} style={{ display: "grid", gap: 4 }}>
              {b.items.map((it, j) => (
                <div key={j} style={{ display: "flex", gap: 7, paddingLeft: it.depth ? 16 : 0, lineHeight: 1.5 }}>
                  <span style={{
                    flexShrink: 0, minWidth: it.ordered ? 16 : 8, color: COLORS.teal, fontWeight: 700,
                    textAlign: it.ordered ? "right" : "center",
                  }}>{it.ordered ? it.marker.replace(")", ".") : "•"}</span>
                  <span style={{ minWidth: 0 }}><Inline text={it.text} /></span>
                </div>
              ))}
            </div>
          );
        }
        return <div key={i} style={{ lineHeight: 1.6 }}><Inline text={b.text} /></div>;
      })}
    </div>
  );
}
