import { Box } from '@mui/material'
import { Fragment } from 'react'
import type { PracticeLanguage, PracticeLevel } from '../../services/practiceService'
import {
  buildMaskPlaceholder,
  computeMaskedPlainTokenIndices,
  tokenizePlainTextForMasking,
} from './masking'

interface PracticeMaskedPlainTextProps {
  text: string
  language: PracticeLanguage
  level: PracticeLevel
  segmentId: string
  maskingDisabled?: boolean
}

export const PracticeMaskedPlainText = ({
  text,
  language,
  level,
  segmentId,
  maskingDisabled = false,
}: PracticeMaskedPlainTextProps) => {
  const tokens = tokenizePlainTextForMasking(text, language)
  if (!tokens.length) return <>{text || '...'}</>
  const masked = maskingDisabled ? new Set<number>() : computeMaskedPlainTokenIndices(segmentId, level, tokens)

  return (
    <>
      {tokens.map((token) => {
        if (!masked.has(token.tokenIndex)) {
          return <Fragment key={`pt-${token.tokenIndex}`}>{token.surface}</Fragment>
        }
        return (
          <Box
            key={`pt-${token.tokenIndex}`}
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              px: '4px',
              borderRadius: '4px',
              bgcolor: 'rgba(110,96,238,0.18)',
              color: 'rgba(255,255,255,0.88)',
              lineHeight: 1.4,
            }}
          >
            {buildMaskPlaceholder(token.surface)}
          </Box>
        )
      })}
    </>
  )
}
