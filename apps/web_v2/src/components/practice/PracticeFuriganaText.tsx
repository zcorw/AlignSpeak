import { Box } from '@mui/material'
import { Fragment } from 'react'
import type { PracticeReadingToken } from '../../services/practiceService'
import { buildMaskPlaceholder } from './masking'

interface PracticeFuriganaTextProps {
  tokens: PracticeReadingToken[]
  fallbackText: string
  editable: boolean
  activeTokenIndex: number | null
  maskedTokenIndices?: ReadonlySet<number>
  onSelectToken?: (tokenIndex: number) => void
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
}: PracticeFuriganaTextProps) => {
  if (!tokens.length) return <>{fallbackText || '...'}</>

  return (
    <>
      {tokens.map((token, index) => {
        const tokenIndex = typeof token.tokenIndex === 'number' ? token.tokenIndex : index
        const masked = Boolean(maskedTokenIndices?.has(tokenIndex))
        const content = masked
          ? (
            <Box
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
          : hasReading(token)
            ? (
              <ruby>
                {token.surface}
                <rt>{token.yomi}</rt>
              </ruby>
              )
            : token.surface
        if (!editable || !token.editable) {
          return <Fragment key={`${token.surface}-${tokenIndex}-${index}`}>{content}</Fragment>
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
              bgcolor: active ? 'rgba(110,96,238,0.2)' : 'transparent',
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
