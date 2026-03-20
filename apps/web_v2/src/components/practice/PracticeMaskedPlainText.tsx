import { Box } from '@mui/material'
import { Fragment } from 'react'
import type { PracticeLanguage, PracticeLevel } from '../../services/practiceService'
import {
  buildMaskPlaceholder,
  computeMaskedPlainTokenIndices,
  tokenizePlainTextForMasking,
} from './masking'
import {
  buildSurfaceTextRanges,
  findSentenceIndexForTextRange,
  type SentenceTextRange,
} from './timelineText'

interface PracticeMaskedPlainTextProps {
  text: string
  language: PracticeLanguage
  level: PracticeLevel
  segmentId: string
  maskingDisabled?: boolean
  sentenceRanges?: ReadonlyArray<SentenceTextRange>
  activeSentenceIndex?: number | null
  onSelectSentence?: (sentenceIndex: number) => void
}

export const PracticeMaskedPlainText = ({
  text,
  language,
  level,
  segmentId,
  maskingDisabled = false,
  sentenceRanges = [],
  activeSentenceIndex = null,
  onSelectSentence,
}: PracticeMaskedPlainTextProps) => {
  const tokens = tokenizePlainTextForMasking(text, language)
  if (!tokens.length) return <>{text || '...'}</>
  const masked = maskingDisabled ? new Set<number>() : computeMaskedPlainTokenIndices(segmentId, level, tokens)
  const tokenTextRanges = buildSurfaceTextRanges(text, tokens.map((token) => token.surface))

  return (
    <>
      {tokens.map((token, order) => {
        const sentenceIndex = findSentenceIndexForTextRange(sentenceRanges, tokenTextRanges[order] ?? { start: 0, end: 0 })
        const sentenceActive = sentenceIndex !== null && sentenceIndex === activeSentenceIndex
        const sentenceClickable = sentenceIndex !== null && typeof onSelectSentence === 'function'
        const content = !masked.has(token.tokenIndex)
          ? <Fragment key={`pt-content-${token.tokenIndex}`}>{token.surface}</Fragment>
          : (
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

        if (!sentenceActive && !sentenceClickable) {
          return <Fragment key={`pt-${token.tokenIndex}`}>{content}</Fragment>
        }
        return (
          <Box
            key={`pt-${token.tokenIndex}`}
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
      })}
    </>
  )
}
