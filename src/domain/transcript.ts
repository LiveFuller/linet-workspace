// Transcript parsing: TXT, SRT, VTT. Preserves source text and timestamps.
// Missing speaker labels stay null. Handles Czech diacritics (transparently, UTF-8),
// malformed subtitle blocks (skips gracefully), and empty imports (rejected upstream).

export interface ParsedSegment {
  speaker: string | null;
  startMs: number | null;
  endMs: number | null;
  text: string;
}

function srtTimeToMs(s: string): number | null {
  const m = /^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})$/.exec(s.trim());
  if (!m) return null;
  return Number(m[1]) * 3600000 + Number(m[2]) * 60000 + Number(m[3]) * 1000 + Number(m[4]);
}

const SPEAKER_RE = /^([A-Za-zÁ-Žá-ž0-9 _-]{1,40}):\s+(.*)$/;

/** Plain text: one segment per nonempty line; optional "Speaker: text" prefix. */
export function parseTxt(content: string): ParsedSegment[] {
  const out: ParsedSegment[] = [];
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = SPEAKER_RE.exec(line);
    if (m) out.push({ speaker: m[1], startMs: null, endMs: null, text: m[2].trim() });
    else out.push({ speaker: null, startMs: null, endMs: null, text: line });
  }
  return out;
}

/** SRT: numbered blocks with timecodes; tolerate missing indices. */
export function parseSrt(content: string): ParsedSegment[] {
  const out: ParsedSegment[] = [];
  const blocks = content.replace(/\r\n/g, "\n").split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const timeIdx = lines.findIndex((l) => l.includes("-->"));
    if (timeIdx === -1) {
      // malformed block without timecode: keep text, no timestamps
      const text = lines.join(" ").trim();
      if (text) out.push({ speaker: null, startMs: null, endMs: null, text });
      continue;
    }
    const timeParts = lines[timeIdx].split("-->").map((x) => x.trim());
    const startMs = srtTimeToMs(timeParts[0]);
    const endMs = srtTimeToMs(timeParts[1] ?? "");
    const textLines = lines.slice(timeIdx + 1);
    const text = textLines.join(" ").trim();
    if (!text) continue;
    const m = SPEAKER_RE.exec(text);
    if (m) out.push({ speaker: m[1], startMs, endMs, text: m[2].trim() });
    else out.push({ speaker: null, startMs, endMs, text });
  }
  return out;
}

/** WebVTT: header optional, NOTE blocks ignored, speaker labels supported. */
export function parseVtt(content: string): ParsedSegment[] {
  const body = content.replace(/^WEBVTT[^\n]*\n/, "");
  const noteless = body
    .split(/\n\s*\n/)
    .filter((b) => !b.trim().startsWith("NOTE") && !b.trim().startsWith("STYLE") && !b.trim().startsWith("REGION"))
    .join("\n\n");
  const out = parseSrt(noteless);
  return out.map((s) => ({ ...s, startMs: s.startMs !== null ? s.startMs : null }));
}

export function detectFormat(filename: string, content: string): "srt" | "vtt" | "txt" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".srt")) return "srt";
  if (lower.endsWith(".vtt")) return "vtt";
  if (content.trimStart().startsWith("WEBVTT")) return "vtt";
  if (content.includes("-->")) return "srt";
  return "txt";
}

export function parseTranscript(filename: string, content: string): ParsedSegment[] {
  const fmt = detectFormat(filename, content);
  const parsed = fmt === "srt" ? parseSrt(content) : fmt === "vtt" ? parseVtt(content) : parseTxt(content);
  return parsed;
}

/**
 * Deterministic action-proposal helper (NOT AI).
 * Looks for lines that read like commitments: first-person future verbs (Czech/English),
 * imperatives, or explicit "task/akce" keywords. Returns candidates with evidence.
 * Ambiguous free text yields no candidates — manual review remains available.
 */
const ACTION_HINTS_CS = [
  "udělám", "udelam", "připravím", "pripravim", "založím", "zalozim", "zkontroluji", "zkontroluju",
  "pošlu", "poslu", "napíšu", "napisu", "sestavím", "sestavim", "domluvím", "domluvim",
  "ověřím", "overim", "zjistím", "zjistim", "vypracuji", "sjednám", "sjednam", "proběhne", "probezne",
  "zpracuji", "dodám", "dodam", "předám", "predam", "sjednat", "projdeme", "projedeme", "zpracovat", "připravit",
  "ještě", "jeste",
];
const ACTION_HINTS_EN = [
  "i will", "i'll", "let's", "we will", "we'll", "please", "can you", "could you",
  "need to", "needs to", "has to", "send", "prepare", "check", "review", "draft", "follow up",
];
const OWNER_HINTS = /\b(petru|petra|petře|petre|oliver|olivere|honzo|jano|krištofe|terezo|pro vás|pro vás)\b/i;

export interface ActionCandidate {
  evidenceText: string;
  proposedTitle: string;
  proposedOwnerHint: string | null;
  segmentIndex: number;
}

export function extractActionCandidates(segments: { text: string; speaker: string | null }[]): ActionCandidate[] {
  const out: ActionCandidate[] = [];
  for (const [i, seg] of segments.entries()) {
    const lower = seg.text.toLowerCase();
    const hints = [...ACTION_HINTS_CS, ...ACTION_HINTS_EN];
    const matched = hints.find((h) => lower.includes(h));
    if (!matched) continue;
    // Strip leading fillers for a proposed title (keep source intact in evidence).
    let title = seg.text
      .replace(/^(no |jo |dobře, |dobre, |tak |takže |takze |a ještě |a jeste |a | ještě |jeste )/i, "")
      .trim();
    if (title.length > 140) title = title.slice(0, 137) + "…";
    if (title.length < 3) continue;
    const ownerMatch = OWNER_HINTS.exec(seg.text);
    out.push({
      evidenceText: seg.text,
      proposedTitle: title.charAt(0).toUpperCase() + title.slice(1),
      proposedOwnerHint: ownerMatch ? ownerMatch[1] : null,
      segmentIndex: i,
    });
  }
  return out;
}

/** Czech SRT sample for demos/tests (fictionalized, sanitized). */
export const SAMPLE_SRT = `1
00:00:03,000 --> 00:00:11,000
Vedoucí: Dobrá, tak shrňme, kde jsme. Nejdřív potřebujeme zvládnout Teams a složky.

2
00:00:12,000 --> 00:00:24,000
Oliver: Základní školení udělám. Připravím i pravidla pro sdílení složek.

3
00:00:26,000 --> 00:00:40,000
Petra: Zkontroluju, kdo používá stávající Planner plány a co v nich je.

4
00:00:42,000 --> 00:00:55,000
Vedoucí: Oliver, pošli do pěti dnů příklady předchozích prací.

5
00:00:58,000 --> 00:01:10,000
Domluvili jsme se, že příští týden projdeme celý seznam úkolů.
`;
