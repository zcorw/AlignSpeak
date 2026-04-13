import { Box, Typography } from '@mui/material'
import { type ReactNode, useMemo } from 'react'
import { buildSentenceTextRanges, splitTextToSentences } from '../practice/timelineText'

interface SentenceSelectableParagraphProps {
  text: string
  selectedSentenceIndex: number | null
  onSelectSentence: (sentenceIndex: number) => void
}

const sentenceSx = (selected: boolean) => ({
  display: 'inline',
  cursor: 'pointer',
  border: 'none',
  p: 0,
  m: 0,
  bgcolor: selected ? 'rgba(110,96,238,0.28)' : 'transparent',
  color: selected ? 'text.primary' : 'text.primary',
  borderRadius: '4px',
  transition: 'background-color 0.12s ease',
  '&:hover': {
    bgcolor: selected ? 'rgba(110,96,238,0.36)' : 'rgba(255,255,255,0.08)',
  },
})

export const SentenceSelectableParagraph = ({
  text,
  selectedSentenceIndex,
  onSelectSentence,
}: SentenceSelectableParagraphProps) => {
  const sentences = useMemo(() => splitTextToSentences(text), [text])
  const ranges = useMemo(
    () => buildSentenceTextRanges(text, sentences),
    [sentences, text]
  )

  const content = useMemo(() => {
    if (!text) return null
    if (!ranges.length) {
      return (
        <Typography
          sx={{
            fontSize: '16px',
            lineHeight: 1.85,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          }}
        >
          {text}
        </Typography>
      )
    }

    const nodes: ReactNode[] = []
    let cursor = 0
    for (const range of ranges) {
      if (cursor < range.start) {
        nodes.push(
          <Box key={`plain-${cursor}`} component="span">
            {text.slice(cursor, range.start)}
          </Box>
        )
      }
      nodes.push(
        <Box
          key={`sentence-${range.sentenceIndex}-${range.start}`}
          component="button"
          type="button"
          onClick={() => onSelectSentence(range.sentenceIndex)}
          sx={sentenceSx(selectedSentenceIndex === range.sentenceIndex)}
        >
          {text.slice(range.start, range.end)}
        </Box>
      )
      cursor = range.end
    }
    if (cursor < text.length) {
      nodes.push(
        <Box key={`plain-tail-${cursor}`} component="span">
          {text.slice(cursor)}
        </Box>
      )
    }
    return nodes
  }, [onSelectSentence, ranges, selectedSentenceIndex, text])

  return (
    <Box
      sx={{
        fontSize: '16px',
        lineHeight: 1.85,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
      }}
    >
      {content}
    </Box>
  )
}
