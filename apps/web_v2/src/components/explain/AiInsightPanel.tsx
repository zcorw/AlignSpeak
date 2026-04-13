import { Box, Typography } from '@mui/material'
import type { ExplainGrammarPoint, ExplainKeyword } from '../../services/explainService'

interface AiInsightPanelProps {
  summaryTitle: string
  keywordTitle: string
  grammarTitle: string
  summary: string
  keywords: ExplainKeyword[]
  grammarPoints: ExplainGrammarPoint[]
  emptyGrammarText: string
  warnings: string[]
}

export const AiInsightPanel = ({
  summaryTitle,
  keywordTitle,
  grammarTitle,
  summary,
  keywords,
  grammarPoints,
  emptyGrammarText,
  warnings,
}: AiInsightPanelProps) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
    <Box sx={{ p: '14px', bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '12px' }}>
      <Typography sx={{ mb: '8px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'text.disabled' }}>
        {summaryTitle}
      </Typography>
      <Typography sx={{ fontSize: '14px', color: 'text.primary', lineHeight: 1.65 }}>{summary || '-'}</Typography>
    </Box>

    <Box sx={{ p: '14px', bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '12px' }}>
      <Typography sx={{ mb: '8px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'text.disabled' }}>
        {keywordTitle}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {keywords.map((keyword, index) => (
          <Box key={`${keyword.term}-${index}`} sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <Typography sx={{ fontSize: '13px', color: 'primary.light', fontWeight: 600 }}>{keyword.term}</Typography>
            <Typography sx={{ fontSize: '12px', color: 'text.secondary', lineHeight: 1.5 }}>{keyword.explanation}</Typography>
          </Box>
        ))}
      </Box>
    </Box>

    <Box sx={{ p: '14px', bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '12px' }}>
      <Typography sx={{ mb: '8px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'text.disabled' }}>
        {grammarTitle}
      </Typography>
      {!grammarPoints.length ? (
        <Typography sx={{ fontSize: '13px', color: 'text.secondary' }}>{emptyGrammarText}</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {grammarPoints.map((item, index) => (
            <Box key={`${item.name}-${index}`} sx={{ p: '10px', borderRadius: '10px', bgcolor: '#22223a', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Typography sx={{ fontSize: '13px', fontWeight: 700, color: 'text.primary' }}>{item.name}</Typography>
              <Typography sx={{ mt: '4px', fontSize: '12px', color: 'text.secondary', lineHeight: 1.55 }}>{item.explanation}</Typography>
              <Typography sx={{ mt: '5px', fontSize: '12px', color: 'primary.light' }}>{`“${item.snippet}”`}</Typography>
              {item.example && (
                <Typography sx={{ mt: '4px', fontSize: '11px', color: 'text.disabled', lineHeight: 1.5 }}>{item.example}</Typography>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>

    {warnings.length > 0 && (
      <Box sx={{ p: '10px 12px', bgcolor: 'rgba(255,193,7,0.10)', border: '1px solid rgba(255,193,7,0.3)', borderRadius: '12px' }}>
        <Typography sx={{ fontSize: '12px', color: 'warning.light', lineHeight: 1.5 }}>
          {warnings.join(' ')}
        </Typography>
      </Box>
    )}
  </Box>
)

