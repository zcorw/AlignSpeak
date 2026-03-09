import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PracticeLanguage, PracticeReadingToken, SegmentReadingOverrideInput } from '../../services/practiceService'

const normalizeTokenIndex = (token: PracticeReadingToken, fallbackIndex: number): number =>
  typeof token.tokenIndex === 'number' ? token.tokenIndex : fallbackIndex

interface UsePracticeFuriganaEditorOptions {
  language: PracticeLanguage
  tokens: PracticeReadingToken[]
  enabled: boolean
  onOverridesChange: (overrides: SegmentReadingOverrideInput[]) => void
}

export const usePracticeFuriganaEditor = ({
  language,
  tokens,
  enabled,
  onOverridesChange,
}: UsePracticeFuriganaEditorOptions) => {
  const [isEditMode, setIsEditMode] = useState(false)
  const [activeTokenIndex, setActiveTokenIndex] = useState<number | null>(null)
  const [overrides, setOverrides] = useState<Record<number, string>>({})

  useEffect(() => {
    if (!enabled || language !== 'ja') {
      setIsEditMode(false)
      setActiveTokenIndex(null)
      return
    }
    const nextOverrides: Record<number, string> = {}
    for (const [index, token] of tokens.entries()) {
      if (token.source !== 'override') continue
      const tokenIndex = normalizeTokenIndex(token, index)
      nextOverrides[tokenIndex] = typeof token.yomi === 'string' ? token.yomi : ''
    }
    setOverrides(nextOverrides)
    setActiveTokenIndex(null)
  }, [enabled, language, tokens])

  const mergedTokens = useMemo<PracticeReadingToken[]>(
    () =>
      tokens.map((token, index) => {
        const tokenIndex = normalizeTokenIndex(token, index)
        const hasOverride = Object.prototype.hasOwnProperty.call(overrides, tokenIndex)
        if (!hasOverride) {
          return {
            ...token,
            tokenIndex,
          }
        }
        const override = overrides[tokenIndex]
        const normalizedOverride = override.trim()
        return {
          ...token,
          tokenIndex,
          yomi: normalizedOverride || null,
          source: 'override',
        }
      }),
    [overrides, tokens]
  )

  const editableTokenIndices = useMemo(
    () =>
      mergedTokens
        .filter((token) => token.editable)
        .map((token, index) => normalizeTokenIndex(token, index)),
    [mergedTokens]
  )

  const activeToken = useMemo(
    () => mergedTokens.find((token, index) => normalizeTokenIndex(token, index) === activeTokenIndex) ?? null,
    [activeTokenIndex, mergedTokens]
  )

  const emitOverrides = useCallback(
    (next: Record<number, string>) => {
      const payload = Object.entries(next)
        .map(([tokenIndex, yomi]) => {
          const numericIndex = Number(tokenIndex)
          const token = mergedTokens.find((item, index) => normalizeTokenIndex(item, index) === numericIndex)
          if (!token || !token.surface) return null
          return {
            tokenIndex: numericIndex,
            surface: token.surface,
            yomi: yomi.trim() ? yomi.trim() : null,
          }
        })
        .filter((item): item is SegmentReadingOverrideInput => item !== null)
        .sort((a, b) => a.tokenIndex - b.tokenIndex)
      onOverridesChange(payload)
    },
    [mergedTokens, onOverridesChange]
  )

  const setOverride = useCallback(
    (tokenIndex: number, yomi: string) => {
      setOverrides((prev) => {
        const next = { ...prev, [tokenIndex]: yomi }
        emitOverrides(next)
        return next
      })
    },
    [emitOverrides]
  )

  const setActiveYomi = useCallback(
    (yomi: string) => {
      if (activeTokenIndex == null) return
      setOverride(activeTokenIndex, yomi)
    },
    [activeTokenIndex, setOverride]
  )

  const canEdit = enabled && language === 'ja' && editableTokenIndices.length > 0

  const setEditMode = useCallback(
    (value: boolean) => {
      if (!canEdit) {
        setIsEditMode(false)
        setActiveTokenIndex(null)
        return
      }
      setIsEditMode(value)
      if (!value) {
        setActiveTokenIndex(null)
      }
    },
    [canEdit]
  )

  const toggleEditMode = useCallback(() => {
    setEditMode(!isEditMode)
  }, [isEditMode, setEditMode])

  const selectToken = useCallback(
    (tokenIndex: number) => {
      if (!isEditMode) return
      if (!editableTokenIndices.includes(tokenIndex)) return
      setActiveTokenIndex(tokenIndex)
    },
    [editableTokenIndices, isEditMode]
  )

  const moveActiveToken = useCallback(
    (offset: number) => {
      if (!editableTokenIndices.length) return
      if (activeTokenIndex == null) {
        setActiveTokenIndex(offset > 0 ? editableTokenIndices[0] : editableTokenIndices[editableTokenIndices.length - 1])
        return
      }
      const currentIndex = editableTokenIndices.indexOf(activeTokenIndex)
      const nextIndex = Math.min(
        Math.max(currentIndex + offset, 0),
        editableTokenIndices.length - 1
      )
      setActiveTokenIndex(editableTokenIndices[nextIndex])
    },
    [activeTokenIndex, editableTokenIndices]
  )

  const focusPrevToken = useCallback(() => moveActiveToken(-1), [moveActiveToken])
  const focusNextToken = useCallback(() => moveActiveToken(1), [moveActiveToken])

  const resetActiveToken = useCallback(() => {
    if (activeTokenIndex == null) return
    setOverrides((prev) => {
      const next = { ...prev }
      delete next[activeTokenIndex]
      emitOverrides(next)
      return next
    })
  }, [activeTokenIndex, emitOverrides])

  const activeYomi = useMemo(() => {
    if (activeToken == null) return ''
    return typeof activeToken.yomi === 'string' ? activeToken.yomi : ''
  }, [activeToken])

  return {
    canEdit,
    isEditMode,
    activeTokenIndex,
    activeToken,
    activeYomi,
    mergedTokens,
    setEditMode,
    toggleEditMode,
    selectToken,
    setActiveYomi,
    resetActiveToken,
    focusPrevToken,
    focusNextToken,
  }
}
