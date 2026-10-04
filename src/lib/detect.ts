import type { Language } from "./types";

/**
 * What language a snippet is written in, worked out from the code itself.
 *
 * A fenced block only highlights when its fence names a language, and most
 * blocks are pasted rather than typed, so most arrive with the fence empty or
 * carrying a title. This reads the code instead: a small weighted set of
 * signals per language, summed, with the winner taken only when it is clearly
 * ahead. Nothing here parses — a guess has to be cheap enough to run on a
 * keystroke, and being wrong about prose is worse than leaving it plain, so the
 * threshold is deliberately high and the answer is allowed to be "no idea".
 */

/** The languages a snippet can be recognised as: the ones with a grammar,
 *  minus the two that would only ever match everything. */
export type DetectedLanguage = Exclude<Language, "markdown" | "text">;

interface Signal {
  re: RegExp;
  /** Points added when the pattern appears anywhere in the code. Presence,
   *  never a count: a count turns the guess into a measure of length. */
  weight: number;
}

/** Signals shared by both members of the JavaScript family. TypeScript scores
 *  these too — it is a superset, so anything JavaScript-shaped is also
 *  TypeScript-shaped — and the exclusive list below is what separates them. */
const JS: Signal[] = [
  { re: /\b(?:const|let)\s+[A-Za-z_$][\w$]*\s*=/, weight: 3 },
  { re: /\bfunction\s*\*?\s*[A-Za-z_$]*\s*\(/, weight: 3 },
  { re: /=>\s*[{(\[`'"A-Za-z0-9_$]/, weight: 3 },
  { re: /\bconsole\.(?:log|warn|error|info|debug)\s*\(/, weight: 4 },
  { re: /\b(?:import|export)\b[^\n]*\bfrom\s+['"]/, weight: 3 },
  { re: /\bmodule\.exports\b|\brequire\s*\(\s*['"]/, weight: 4 },
  { re: /\bexport\s+(?:default|const|function|class)\b/, weight: 3 },
  { re: /\bnew\s+[A-Z][\w$]*\s*\(/, weight: 2 },
  { re: /\b(?:async|await)\b/, weight: 2 },
  { re: /`[^`\n]*\$\{/, weight: 3 },
  { re: /\b(?:undefined|null|true|false)\b/, weight: 1 },
  { re: /[=!]==/, weight: 2 },
  { re: /\.(?:then|map|filter|forEach|reduce|includes|push)\s*\(/, weight: 2 },
  { re: /\bclass\s+[A-Z][\w$]*\s*(?:extends\s+[\w$.]+\s*)?\{/, weight: 2 },
  { re: /\bdocument\.|\bwindow\.|\bJSON\.(?:parse|stringify)\b/, weight: 2 },
  { re: /;\s*$/m, weight: 1 },
];

/** Signals no plain JavaScript file can carry. */
const TS: Signal[] = [
  { re: /\binterface\s+[A-Za-z_$][\w$]*\s*(?:extends[^{]*)?\{/, weight: 5 },
  { re: /\btype\s+[A-Za-z_$][\w$]*(?:<[^>]*>)?\s*=/, weight: 5 },
  { re: /:\s*(?:string|number|boolean|void|any|unknown|never|bigint|symbol|object)\b/, weight: 4 },
  { re: /\b(?:public|private|protected|readonly)\s+[A-Za-z_$]/, weight: 4 },
  { re: /\benum\s+[A-Z]/, weight: 4 },
  { re: /\b(?:import|export)\s+type\b/, weight: 4 },
  { re: /\bimplements\s+[A-Z]/, weight: 3 },
  { re: /\bas\s+(?:const\b|[A-Z][\w$]*)/, weight: 3 },
  { re: /\bdeclare\s+(?:module|global|const|function|namespace)\b/, weight: 3 },
  { re: /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*:\s*[A-Za-z_$]/, weight: 4 },
  { re: /\)\s*:\s*(?:Promise\s*<|[A-Z][\w$]*)/, weight: 2 },
  { re: /[\w$]\??\s*:\s*[A-Z][\w$]*(?:<[^>]*>)?\s*[;,)]/, weight: 2 },
];

const PYTHON: Signal[] = [
  { re: /^[ \t]*def\s+[A-Za-z_]\w*\s*\([^\n]*\)\s*(?:->[^:\n]+)?:/m, weight: 6 },
  { re: /^[ \t]*class\s+[A-Za-z_]\w*(?:\([^)\n]*\))?\s*:/m, weight: 5 },
  { re: /^[ \t]*(?:from\s+[\w.]+\s+)?import\s+[\w.*]/m, weight: 4 },
  { re: /\b__(?:init|name|main|str|repr|dict)__\b/, weight: 4 },
  { re: /\bself\b/, weight: 3 },
  { re: /^[ \t]*(?:if|elif|else|for|while|try|except|finally|with)\b[^\n]*:[ \t]*$/m, weight: 3 },
  { re: /\b(?:None|True|False)\b/, weight: 3 },
  { re: /\belif\b|\bnot\s+in\b|\bis\s+not\b|\braise\s+[A-Z]/, weight: 3 },
  { re: /\bf["'][^"'\n]*\{/, weight: 3 },
  { re: /\b(?:print|len|range|enumerate|isinstance)\s*\(/, weight: 3 },
  { re: /^[ \t]*@[A-Za-z_][\w.]*[ \t]*$/m, weight: 2 },
  { re: /^[ \t]*#(?!include)/m, weight: 1 },
];

const RUST: Signal[] = [
  { re: /\bfn\s+[A-Za-z_]\w*\s*(?:<[^>\n]*>)?\s*\(/, weight: 6 },
  { re: /\bimpl\b[^\n]*\{/, weight: 5 },
  { re: /^[ \t]*#\[[a-z_]+/m, weight: 5 },
  { re: /\.(?:unwrap|to_string|to_owned|iter|into_iter|collect)\s*\(|\b(?:println|format|vec|write)!/, weight: 5 },
  { re: /\blet\s+(?:mut\s+)?[A-Za-z_]\w*/, weight: 4 },
  { re: /^[ \t]*use\s+[\w:]+(?:::\{[^}\n]*\})?\s*;/m, weight: 4 },
  { re: /\b(?:Some|None|Ok|Err)\s*\(/, weight: 4 },
  { re: /&(?:mut\s+)?(?:self|str)\b/, weight: 4 },
  { re: /\b(?:pub|crate)\b/, weight: 3 },
  { re: /\b(?:String|Vec|Option|Result|HashMap|Box|Arc|Rc)\s*<|::new\s*\(/, weight: 3 },
  { re: /->\s*[A-Za-z_&][\w:<>&' ]*\s*\{/, weight: 3 },
  { re: /\b(?:struct|enum|trait|mod)\s+[A-Za-z_]\w*/, weight: 3 },
  { re: /\bmatch\b[^\n]*\{/, weight: 2 },
];

const SQL: Signal[] = [
  { re: /\bselect\b[\s\S]*\bfrom\b/i, weight: 6 },
  { re: /\binsert\s+into\b/i, weight: 6 },
  { re: /\bdelete\s+from\b/i, weight: 6 },
  { re: /\bcreate\s+(?:table|index|view|database|schema)\b/i, weight: 6 },
  { re: /\balter\s+table\b/i, weight: 5 },
  { re: /\bupdate\b[\s\S]*\bset\b/i, weight: 5 },
  { re: /\b(?:inner|left|right|outer|cross)\s+join\b|\bjoin\b[^\n]*\bon\b/i, weight: 4 },
  { re: /\b(?:group|order)\s+by\b/i, weight: 4 },
  { re: /\b(?:primary|foreign)\s+key\b|\bnot\s+null\b|\bvarchar\s*\(|\bserial\b/i, weight: 3 },
  { re: /\bvalues\s*\(/i, weight: 3 },
  { re: /\bwhere\b/i, weight: 2 },
];

/** JSON is checked by shape first (see below); these only catch the fragment
 *  that is still being pasted and does not parse yet. */
const JSON_SIGNALS: Signal[] = [
  { re: /^[\s]*[{[]/, weight: 2 },
  { re: /"[^"\n]+"\s*:\s*(?:["{[\d]|true|false|null)/, weight: 5 },
  { re: /^[\s]*[{[][\s\S]*[}\]][\s]*$/, weight: 2 },
];

/** Things that rule a language out however well it otherwise scored: a brace
 *  at the end of a line is not Python, and JSON holds no code. */
const AGAINST: Partial<Record<DetectedLanguage, Signal[]>> = {
  python: [
    // A block opened with a brace, a line terminated with a semicolon, or a
    // line that is nothing but a closing brace. Not a brace at the end of a
    // line generally: `out = {}` is a dictionary, and Python is full of them.
    { re: /\{\s*$/m, weight: 4 },
    { re: /;\s*$/m, weight: 4 },
    { re: /^\s*\}/m, weight: 4 },
    { re: /\b(?:const|let|var|function|fn)\s/, weight: 4 },
    { re: /=>|\|\||&&/, weight: 3 },
  ],
  json: [
    { re: /\b(?:function|const|let|var|def|fn|class|return|import)\b/, weight: 12 },
    { re: /=>|\/\/|\/\*|;\s*$/m, weight: 12 },
  ],
  sql: [
    // Braces, not semicolons: a statement ending in one is what SQL looks like.
    { re: /[{]\s*$/m, weight: 4 },
    { re: /=>|\bfunction\b|\bdef\b|\bfn\b/, weight: 6 },
  ],
  rust: [{ re: /^[ \t]*def\s|\bself\.\w/m, weight: 4 }],
};

function score(code: string, signals: Signal[]): number {
  let total = 0;
  for (const signal of signals) if (signal.re.test(code)) total += signal.weight;
  return total;
}

/** A guess is only taken when it is both solid on its own and clearly ahead of
 *  the runner-up, so ambiguous or non-code text stays plain. */
const FLOOR = 7;
const LEAD = 3;

/** Long enough to carry a signal at all. Below this almost anything matches
 *  almost anything. */
const MIN_LENGTH = 12;

function detect(code: string): DetectedLanguage | null {
  const body = code.trim();
  if (body.length < MIN_LENGTH) return null;

  // Valid JSON is not a matter of opinion.
  if (/^[{[]/.test(body) && body.length < 200_000) {
    try {
      const value = JSON.parse(body);
      if (value !== null && typeof value === "object") return "json";
    } catch {
      // Not finished, or not JSON: fall through to the scores.
    }
  }

  const js = score(body, JS);
  const ts = score(body, TS);
  const scores: Record<DetectedLanguage, number> = {
    // The family scores together and splits afterwards, so the two halves of
    // it never beat each other instead of beating the other languages.
    typescript: ts > 0 ? js + ts : 0,
    javascript: ts > 0 ? 0 : js,
    python: score(body, PYTHON),
    rust: score(body, RUST),
    sql: score(body, SQL),
    json: score(body, JSON_SIGNALS),
  };
  for (const [language, signals] of Object.entries(AGAINST)) {
    const key = language as DetectedLanguage;
    scores[key] = Math.max(0, scores[key] - score(body, signals));
  }

  let best: DetectedLanguage | null = null;
  let bestScore = 0;
  let runnerUp = 0;
  for (const [language, value] of Object.entries(scores)) {
    if (value > bestScore) {
      runnerUp = bestScore;
      best = language as DetectedLanguage;
      bestScore = value;
    } else if (value > runnerUp) {
      runnerUp = value;
    }
  }
  if (!best || bestScore < FLOOR || bestScore - runnerUp < LEAD) return null;
  return best;
}

/**
 * The detector is called from a decoration build and from the block header, so
 * it runs on every keystroke in a document with blocks in it. The answer is
 * memoised on the code itself; the table is small and thrown away whole rather
 * than kept in order, since a block's text changes letter by letter and the old
 * keys are never asked for again.
 */
const cache = new Map<string, DetectedLanguage | null>();
const CACHE_LIMIT = 48;

export function detectCodeLanguage(code: string): DetectedLanguage | null {
  const hit = cache.get(code);
  if (hit !== undefined || cache.has(code)) return hit ?? null;
  const result = detect(code);
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(code, result);
  return result;
}
