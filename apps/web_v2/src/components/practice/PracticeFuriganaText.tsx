import { Box } from '@mui/material'
import { Fragment } from 'react'
import type { PracticeReadingToken } from '../../services/practiceService'
import { buildMaskPlaceholder } from './masking'
import {
  buildSurfaceTextRanges,
  findSentenceIndexForTextRange,
  type SentenceTextRange,
} from './timelineText'

interface PracticeFuriganaTextProps {
  tokens: PracticeReadingToken[]
  fallbackText: string
  editable: boolean
  activeTokenIndex: number | null
  maskedTokenIndices?: ReadonlySet<number>
  onSelectToken?: (tokenIndex: number) => void
  sentenceRanges?: ReadonlyArray<SentenceTextRange>
  activeSentenceIndex?: number | null
  onSelectSentence?: (sentenceIndex: number) => void
}

const hasReading = (token: PracticeReadingToken): token is PracticeReadingToken & { yomi: string } =>
  typeof token.yomi === 'string' && token.yomi.trim().length > 0 && token.yomi !== token.surface

export const PracticeFuriganaText = ({
  tokens,
  fallbackText,
  editable,
  activeTokenIndex,
  maskedTokenIndices,
  onSelectToken,
  sentenceRanges = [],
  activeSentenceIndex = null,
  onSelectSentence,
}: PracticeFuriganaTextProps) => {
  if (!tokens.length) return <>{fallbackText || '...'}</>
  const tokenTextRanges = buildSurfaceTextRanges(fallbackText, tokens.map((token) => token.surface))

  return (
    <>
      {tokens.map((token, index) => {
        const tokenIndex = typeof token.tokenIndex === 'number' ? token.tokenIndex : index
        const masked = Boolean(maskedTokenIndices?.has(tokenIndex))
        const sentenceIndex = findSentenceIndexForTextRange(sentenceRanges, tokenTextRanges[index] ?? { start: 0, end: 0 })
        const sentenceActive = sentenceIndex !== null && sentenceIndex === activeSentenceIndex
        const sentenceClickable = !editable && sentenceIndex !== null && typeof onSelectSentence === 'function'
        const content = masked
          ? (
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                px: '4px',
                borderRadius: '4px',
                bgcolor: sentenceActive ? 'rgba(255,214,102,0.42)' : 'rgba(110,96,238,0.18)',
                color: 'rgba(255,255,255,0.88)',
                lineHeight: 1.4,
              }}
            >
              {buildMaskPlaceholder(token.surface)}
            </Box>
            )
          : hasReading(token)
            ? (
              <ruby>
                {token.surface}
                <rt>{token.yomi}</rt>
              </ruby>
              )
            : token.surface
        if (!editable || !token.editable) {
          if (!sentenceActive && !sentenceClickable) {
            return <Fragment key={`${token.surface}-${tokenIndex}-${index}`}>{content}</Fragment>
          }
          return (
            <Box
              key={`${token.surface}-${tokenIndex}-${index}`}
              component="span"
              onClick={sentenceClickable ? () => onSelectSentence?.(sentenceIndex) : undefined}
              sx={{
                borderRadius: '6px',
                bgcolor: sentenceActive ? 'rgba(255,214,102,0.2)' : 'transparent',
                cursor: sentenceClickable ? 'pointer' : 'text',
                transition: 'background-color 0.12s',
              }}
            >
              {content}
            </Box>
          )
        }
        const active = tokenIndex === activeTokenIndex
        return (
          <Box
            key={`${token.surface}-${tokenIndex}-${index}`}
            component="span"
            onClick={() => onSelectToken?.(tokenIndex)}
            sx={{
              display: 'inline-block',
              px: '3px',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: active ? 'rgba(110,96,238,0.75)' : 'transparent',
              bgcolor: active ? 'rgba(110,96,238,0.2)' : sentenceActive ? 'rgba(255,214,102,0.2)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.12s',
              '&:hover': {
                borderColor: 'rgba(110,96,238,0.45)',
                bgcolor: 'rgba(110,96,238,0.12)',
              },
            }}
          >
            {content}
          </Box>
        )
      })}
    </>
  )
}
