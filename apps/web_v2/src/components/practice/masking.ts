import type { PracticeLanguage, PracticeLevel, PracticeReadingToken } from '../../services/practiceService'

const LEVEL_MASK_RATIO: Record<PracticeLevel, number> = {
  L1: 0.2,
  L2: 0.4,
  L3: 0.7,
  L4: 0.9,
}

const PUNCT_ONLY_RE = /^[\p{P}\p{S}]+$/u
const WORD_OR_SIGN_RE = /\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu

const fnv1a32 = (value: string): number => {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = (hash * 0x01000193) >>> 0
  }
  return hash >>> 0
}

const toNormalizedTokenIndex = (token: PracticeReadingToken, fallbackIndex: number): number =>
  typeof token.tokenIndex === 'number' ? token.tokenIndex : fallbackIndex

export const isMaskableSurface = (surface: string): boolean => {
  const compact = surface.replace(/\s+/g, '')
  if (!compact) return false
  return !PUNCT_ONLY_RE.test(compact)
}

export const buildMaskPlaceholder = (surface: string): string => {
  const compactLength = Array.from(surface.replace(/\s+/g, '')).length
  const size = Math.max(1, Math.min(compactLength, 6))
  return '█'.repeat(size)
}

interface MaskTarget {
  tokenIndex: number
  surface: string
  order: number
}

const computeMaskSet = (segmentId: string, level: PracticeLevel, targets: MaskTarget[]): Set<number> => {
  const ratio = LEVEL_MASK_RATIO[level] ?? 0
  if (ratio <= 0 || targets.length <= 2) return new Set<number>()

  const minVisible = Math.max(2, Math.ceil(targets.length * 0.2))
  const maxMaskCount = Math.max(targets.length - minVisible, 0)
  const targetMaskCount = Math.floor(targets.length * ratio)
  const maskCount = Math.min(targetMaskCount, maxMaskCount)
  if (maskCount <= 0) return new Set<number>()

  const ranked = targets
    .map((item) => ({
      ...item,
      score: fnv1a32(`${segmentId}|${level}|${item.tokenIndex}|${item.surface}`),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      return left.order - right.order
    })

  return new Set(ranked.slice(0, maskCount).map((item) => item.tokenIndex))
}

export const computeMaskedReadingTokenIndices = (
  segmentId: string,
  level: PracticeLevel,
  tokens: PracticeReadingToken[]
): Set<number> => {
  const targets: MaskTarget[] = tokens
    .map((token, order) => ({
      tokenIndex: toNormalizedTokenIndex(token, order),
      surface: token.surface,
      order,
      maskable: isMaskableSurface(token.surface),
    }))
    .filter((item) => item.maskable)
    .map(({ tokenIndex, surface, order }) => ({ tokenIndex, surface, order }))
  return computeMaskSet(segmentId, level, targets)
}

export interface PlainTextToken {
  tokenIndex: number
  surface: string
  maskable: boolean
}

export const tokenizePlainTextForMasking = (text: string, language: PracticeLanguage): PlainTextToken[] => {
  if (!text) return []
  if (language === 'zh') {
    return Array.from(text).map((char, index) => ({
      tokenIndex: index,
      surface: char,
      maskable: isMaskableSurface(char),
    }))
  }
  const parts = text.match(WORD_OR_SIGN_RE) ?? []
  return parts.map((surface, index) => ({
    tokenIndex: index,
    surface,
    maskable: isMaskableSurface(surface),
  }))
}

export const computeMaskedPlainTokenIndices = (
  segmentId: string,
  level: PracticeLevel,
  tokens: PlainTextToken[]
): Set<number> => {
  const targets: MaskTarget[] = tokens
    .filter((token) => token.maskable)
    .map((token, order) => ({
      tokenIndex: token.tokenIndex,
      surface: token.surface,
      order,
    }))
  return computeMaskSet(segmentId, level, targets)
}
