// Text-based, like field-help.guard.ts, so it runs in the unit test job without a TypeScript program.

export type ProseHit = { line: number; text: string }

// An English text at least this long is explanatory prose, not a label or a status line.
export const LONG_PROSE = 180

// Lists of server warnings or notes, and the fields that carry a citation, a caveat or a blocked reason.
const PROSE_LIST = /\b[\w$.?]*(?:warnings|Warnings|notes|Notes)\s*\.map\(/g
const PROSE_FIELD =
  /(?:[\w$]+\??\.)+(?:retentionBasis|sourceText|resolutionNote|disclaimer|policyBlockedReason)\b/g
const I18N_KEY = /\bt\(\s*(?:"([\w.-]+)"|`([^`]+)`)/g
const HELP_TAG = /<(ProseHelp|FieldHelp|FieldLock)\b/g
const HELP_PROP = /\b(help|lockReason|description)=\{/g
const HELP_KEY = /\bhelp:[^\n]*/g
const LABELS = new Set(["FormLabel", "FieldLabel"])

type Range = readonly [number, number]

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length
}

// Comments are blanked, newlines kept, so a comment naming a field is not a hit and line numbers hold.
function withoutComments(source: string): string {
  const blank = (text: string) => text.replace(/[^\n]/g, " ")
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/gm, (match, lead: string) => lead + blank(match.slice(lead.length)))
}

function matchingBrace(source: string, open: number): number {
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++
    else if (source[i] === "}" && --depth === 0) return i
  }
  return source.length
}

function openingTagEnd(source: string, start: number): number {
  let depth = 0
  for (let i = start; i < source.length; i++) {
    const char = source[i]
    if (char === "{") depth++
    else if (char === "}") depth--
    else if (char === ">" && depth === 0) return i + 1
  }
  return source.length
}

const selfClosing = (source: string, start: number) => source[openingTagEnd(source, start) - 2] === "/"

// The children of a help popover, and the props (or one-line `help:` values) rendered behind one.
function helpRanges(source: string): Range[] {
  const ranges: Range[] = []
  for (const match of source.matchAll(HELP_TAG)) {
    if (selfClosing(source, match.index)) continue
    const start = openingTagEnd(source, match.index)
    const tag = new RegExp(`<${match[1]}\\b|</${match[1]}>`, "g")
    tag.lastIndex = start
    let depth = 1
    let end = source.length
    for (let next = tag.exec(source); next; next = tag.exec(source)) {
      if (next[0].startsWith("</")) depth--
      else if (!selfClosing(source, next.index)) depth++
      if (depth === 0) {
        end = next.index
        break
      }
    }
    ranges.push([start, end])
  }
  for (const match of source.matchAll(HELP_PROP)) {
    if (match[1] === "description") {
      const owner = source.slice(0, match.index).match(/<([A-Z][\w.]*)\b[^<]*$/)
      if (!owner || !LABELS.has(owner[1])) continue
    }
    const open = match.index + match[0].length - 1
    ranges.push([open, matchingBrace(source, open)])
  }
  for (const match of source.matchAll(HELP_KEY)) ranges.push([match.index, match.index + match[0].length])
  return ranges
}

// `!!x.field`, `x.field ? a : b` and `x.field && ...` test the field without printing it.
function isTest(source: string, start: number, end: number): boolean {
  return /!\s*$/.test(source.slice(0, start)) || /^\s*(\?(?![.?])|&&)/.test(source.slice(end))
}

function isLongKey(key: string, longKeys: ReadonlySet<string>): boolean {
  if (!key.includes("${")) return longKeys.has(key)
  const parts = key.split(/\$\{[^}]*\}/).map((part) => part.replace(/[.*+?^$()|[\]\\]/g, "\\$&"))
  const pattern = new RegExp(`^${parts.join("[^.]+")}$`)
  for (const candidate of longKeys) if (pattern.test(candidate)) return true
  return false
}

// Explanatory prose goes behind a `?`; rendering it anywhere else shows it permanently.
export function findPermanentProse(raw: string, longKeys: ReadonlySet<string> = new Set()): ProseHit[] {
  const source = withoutComments(raw)
  const ranges = helpRanges(source)
  const outside = (index: number) => !ranges.some(([start, end]) => index > start && index < end)
  const hits: ProseHit[] = []

  for (const match of source.matchAll(PROSE_LIST)) {
    if (outside(match.index)) hits.push({ line: lineOf(source, match.index), text: match[0] })
  }
  for (const match of source.matchAll(PROSE_FIELD)) {
    const end = match.index + match[0].length
    if (outside(match.index) && !isTest(source, match.index, end)) {
      hits.push({ line: lineOf(source, match.index), text: match[0] })
    }
  }
  for (const match of source.matchAll(I18N_KEY)) {
    const key = match[1] ?? match[2]
    if (outside(match.index) && isLongKey(key, longKeys))
      hits.push({ line: lineOf(source, match.index), text: key })
  }
  return hits.sort((a, b) => a.line - b.line)
}

// Every key of a locale file whose text is long enough to be prose.
export function longProseKeys(locale: unknown, prefix = ""): Set<string> {
  if (typeof locale === "string") return new Set(locale.length >= LONG_PROSE ? [prefix] : [])
  const keys = new Set<string>()
  if (locale && typeof locale === "object") {
    for (const [key, value] of Object.entries(locale)) {
      for (const nested of longProseKeys(value, prefix ? `${prefix}.${key}` : key)) keys.add(nested)
    }
  }
  return keys
}
