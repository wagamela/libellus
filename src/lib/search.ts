import type { Doc } from "./types";

export interface Match {
  doc: Doc;
  score: number;
  excerpt?: string;
}

/** Case-insensitive subsequence match — "gtcmd" finds "git commands". */
function subsequence(query: string, text: string): boolean {
  let index = 0;
  for (const char of text) {
    if (char === query[index]) index += 1;
    if (index === query.length) return true;
  }
  return index === query.length;
}

/**
 * Local ranking over titles and bodies. Deliberately simple: the dataset lives
 * in memory and stays small until SQLite FTS takes over.
 */
export function searchDocs(docs: Doc[], rawQuery: string): Match[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return docs.map((doc) => ({ doc, score: 0 }));
  }
  const matches: Match[] = [];
  for (const doc of docs) {
    const title = doc.title.toLowerCase();
    const body = doc.body.toLowerCase();
    let score = 0;
    let excerpt: string | undefined;

    if (title.startsWith(query)) score += 120;
    else if (title.includes(query)) score += 80;
    else if (subsequence(query, title)) score += 40;

    const bodyAt = body.indexOf(query);
    if (bodyAt !== -1) {
      score += 25;
      const start = Math.max(0, bodyAt - 24);
      excerpt = doc.body.slice(start, start + 96).replace(/\s+/g, " ").trim();
    }

    if (score > 0) matches.push({ doc, score, excerpt });
  }
  return matches.sort(
    (a, b) => b.score - a.score || b.doc.updatedAt - a.doc.updatedAt,
  );
}

export interface LineHit {
  doc: Doc;
  /** 1-based, as the gutter shows it. */
  line: number;
  /** Where the match starts within `text`. */
  column: number;
  /** Offsets of the match in the whole body, ready to become a selection. */
  from: number;
  to: number;
  text: string;
}

/**
 * Every line, in every document, that contains the query — the full-text half
 * of quick open. Most recently edited documents first, so the cap drops stale
 * hits rather than fresh ones.
 */
export function searchLines(docs: Doc[], rawQuery: string, limit = 60): LineHit[] {
  const query = rawQuery.trim().toLowerCase();
  // One character matches nearly every line; it is noise, not a search.
  if (query.length < 2) return [];
  const hits: LineHit[] = [];
  for (const doc of [...docs].sort((a, b) => b.updatedAt - a.updatedAt)) {
    let offset = 0;
    for (const [index, text] of doc.body.split("\n").entries()) {
      const at = text.toLowerCase().indexOf(query);
      if (at !== -1) {
        hits.push({ doc, line: index + 1, column: at, from: offset + at, to: offset + at + query.length, text });
        if (hits.length === limit) return hits;
      }
      offset += text.length + 1;
    }
  }
  return hits;
}
