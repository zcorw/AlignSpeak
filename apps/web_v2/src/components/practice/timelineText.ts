export interface SentenceTextRange {
  sentenceIndex: number
  start: number
  end: number
}

interface TimelineSentenceLike {
  sentenceIndex: number
  text: string
}

const SENTENCE_BREAK_CHARS = new Set(['。', '！', '？', '.', '!', '?', '\n'])

const trimRange = (sourceText: string, start: number, end: number): { start: number; end: number } => {
  let nextStart = Math.max(0, Math.min(start, sourceText.length))
  let nextEnd = Math.max(nextStart, Math.min(end, sourceText.length))
  while (nextStart < nextEnd && /\s/u.test(sourceText[nextStart] ?? '')) nextStart += 1
  while (nextEnd > nextStart && /\s/u.test(sourceText[nextEnd - 1] ?? '')) nextEnd -= 1
  return { start: nextStart, end: nextEnd }
}

export const splitTextToSentences = (sourceText: string): Array<{ sentenceIndex: number; text: string }> => {
  if (!sourceText) return []
  const results: Array<{ sentenceIndex: number; text: string }> = []
  let start = 0
  let sentenceIndex = 0
  for (let index = 0; index < sourceText.length; index += 1) {
    const char = sourceText[index]
    if (!SENTENCE_BREAK_CHARS.has(char)) continue
    const range = trimRange(sourceText, start, index + 1)
    if (range.end > range.start) {
      results.push({
        sentenceIndex,
        text: sourceText.slice(range.start, range.end),
      })
      sentenceIndex += 1
    }
    start = index + 1
  }
  if (start < sourceText.length) {
    const range = trimRange(sourceText, start, sourceText.length)
    if (range.end > range.start) {
      results.push({
        sentenceIndex,
        text: sourceText.slice(range.start, range.end),
      })
    }
  }
  return results
}

export const buildSentenceTextRanges = (
  sourceText: string,
  sentences: ReadonlyArray<TimelineSentenceLike>
): SentenceTextRange[] => {
  if (!sourceText || !sentences.length) return []
  const ordered = [...sentences]
    .filter((item) => typeof item.text === 'string' && item.text.length > 0)
    .sort((left, right) => left.sentenceIndex - right.sentenceIndex)

  const ranges: SentenceTextRange[] = []
  let cursor = 0
  for (const sentence of ordered) {
    const text = sentence.text
    let start = sourceText.indexOf(text, cursor)
    if (start < 0) start = sourceText.indexOf(text)
    if (start < 0) {
      const fallbackStart = Math.max(0, Math.min(cursor, sourceText.length))
      const fallbackEnd = Math.max(fallbackStart, Math.min(sourceText.length, fallbackStart + text.length))
      if (fallbackEnd > fallbackStart) {
        ranges.push({
          sentenceIndex: sentence.sentenceIndex,
          start: fallbackStart,
          end: fallbackEnd,
        })
        cursor = fallbackEnd
      }
      continue
    }
    const end = Math.min(sourceText.length, start + text.length)
    if (end <= start) continue
    ranges.push({
      sentenceIndex: sentence.sentenceIndex,
      start,
      end,
    })
    cursor = end
  }
  return ranges
}

export interface SurfaceTextRange {
  start: number
  end: number
}

export const buildSurfaceTextRanges = (sourceText: string, surfaces: ReadonlyArray<string>): SurfaceTextRange[] => {
  const ranges: SurfaceTextRange[] = []
  let cursor = 0
  for (const surface of surfaces) {
    if (!surface) {
      ranges.push({ start: cursor, end: cursor })
      continue
    }
    let start = sourceText.indexOf(surface, cursor)
    if (start < 0) start = sourceText.indexOf(surface)
    if (start < 0) start = cursor
    const end = Math.min(sourceText.length, start + surface.length)
    ranges.push({ start, end })
    cursor = end
  }
  return ranges
}

export const findSentenceIndexForTextRange = (
  sentenceRanges: ReadonlyArray<SentenceTextRange>,
  range: SurfaceTextRange
): number | null => {
  if (!sentenceRanges.length) return null
  const { start, end } = range
  if (end <= start) return null
  const matched = sentenceRanges.find((item) => !(end <= item.start || start >= item.end))
  return matched?.sentenceIndex ?? null
}
