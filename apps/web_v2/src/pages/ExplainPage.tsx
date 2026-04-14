import { Box, Button, CircularProgress, TextField, Typography } from '@mui/material'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AiInsightPanel } from '../components/explain/AiInsightPanel'
import { ExplainTopBar } from '../components/explain/ExplainTopBar'
import { SentenceSelectableParagraph } from '../components/explain/SentenceSelectableParagraph'
import { StickyAnalyzeActionBar } from '../components/explain/StickyAnalyzeActionBar'
import { useNotifier } from '../components/common/feedbackHooks'
import {
  explainService,
  type ExplainGrammarPoint,
  type ExplainKeyword,
  type ExplainResponseLanguage,
} from '../services/explainService'
import { getApiErrorMessage } from '../services/authService'
import { splitTextToSentences } from '../components/practice/timelineText'

const toLanguageLabel = (language: string, englishLabel: string, chineseLabel: string): string => {
  if (language === 'zh') return chineseLabel
  if (language === 'ja') return 'Japanese'
  return englishLabel
}

const resolveExplainResponseLanguage = (resolvedLanguage?: string): ExplainResponseLanguage => {
  const normalized = resolvedLanguage?.toLowerCase() || ''
  if (normalized.startsWith('zh')) return 'zh'
  if (normalized.startsWith('ja')) return 'ja'
  return 'en'
}

export const ExplainPage = () => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { error: showError } = useNotifier()

  const articleId = searchParams.get('a')?.trim() || ''
  const segmentOrder = Number.parseInt(searchParams.get('seg') || '1', 10) || 1
  const level = searchParams.get('lv')?.trim() || 'L0'

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [articleTitle, setArticleTitle] = useState('')
  const [language, setLanguage] = useState<'ja' | 'en' | 'zh' | string>('en')
  const [segmentText, setSegmentText] = useState('')
  const [summary, setSummary] = useState('')
  const [keywords, setKeywords] = useState<ExplainKeyword[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [selectedSentenceIndex, setSelectedSentenceIndex] = useState<number | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [grammarPoints, setGrammarPoints] = useState<ExplainGrammarPoint[]>([])
  const [grammarReady, setGrammarReady] = useState(false)
  const [questionInput, setQuestionInput] = useState('')
  const [askingQuestion, setAskingQuestion] = useState(false)
  const [questionAnswer, setQuestionAnswer] = useState('')

  const sentenceOptions = useMemo(() => splitTextToSentences(segmentText), [segmentText])
  const selectedSentence = useMemo(() => {
    if (selectedSentenceIndex == null) return ''
    const matched = sentenceOptions.find((item) => item.sentenceIndex === selectedSentenceIndex)
    return matched?.text ?? ''
  }, [selectedSentenceIndex, sentenceOptions])
  const responseLanguage = useMemo(
    () => resolveExplainResponseLanguage(i18n.resolvedLanguage),
    [i18n.resolvedLanguage]
  )

  const languageLabel = toLanguageLabel(
    language,
    t('common.languageEnglish'),
    t('common.languageChinese')
  )

  const backToPractice = useCallback(() => {
    if (!articleId) {
      navigate('/start')
      return
    }
    const params = new URLSearchParams({
      a: articleId,
      seg: String(segmentOrder),
      lv: level,
    })
    navigate(`/practice?${params.toString()}`)
  }, [articleId, level, navigate, segmentOrder])

  const loadSegmentExplain = useCallback(async () => {
    if (!articleId) {
      setLoadError(t('pages.explain.loadErrorMissingArticle'))
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadError(null)
    try {
      const result = await explainService.explainSegment({
        articleId,
        segmentOrder,
        responseLanguage,
      })
      setArticleTitle(result.articleTitle)
      setLanguage(result.language)
      setSegmentText(result.segmentText)
      setSummary(result.summary)
      setKeywords(Array.isArray(result.keywords) ? result.keywords : [])
      setWarnings(Array.isArray(result.warnings) ? result.warnings : [])
      setGrammarPoints([])
      setGrammarReady(false)
      setSelectedSentenceIndex(null)
      setQuestionInput('')
      setQuestionAnswer('')
    } catch (error: unknown) {
      setLoadError(getApiErrorMessage(error, t('common.error')))
    } finally {
      setLoading(false)
    }
  }, [articleId, responseLanguage, segmentOrder, t])

  useEffect(() => {
    void loadSegmentExplain()
  }, [loadSegmentExplain])

  const onAnalyzeSentence = () => {
    if (!articleId || !selectedSentence) return
    setAnalyzing(true)
    void explainService
      .explainGrammar({
        articleId,
        segmentOrder,
        sentenceText: selectedSentence,
        responseLanguage,
      })
      .then((result) => {
        setGrammarPoints(result.grammarPoints || [])
        setGrammarReady(true)
        setQuestionInput('')
        setQuestionAnswer('')
        setWarnings((prev) => {
          const merged = [...prev, ...(result.warnings || [])]
          return Array.from(new Set(merged))
        })
      })
      .catch((error: unknown) => {
        showError(getApiErrorMessage(error, t('common.error')))
      })
      .finally(() => {
        setAnalyzing(false)
      })
  }

  const onSelectSentence = (nextIndex: number) => {
    setSelectedSentenceIndex((prev) => {
      if (prev !== nextIndex) {
        setGrammarReady(false)
        setQuestionInput('')
        setQuestionAnswer('')
      }
      return nextIndex
    })
  }

  const onAskQuestion = () => {
    const question = questionInput.trim()
    if (!articleId || !selectedSentence || !grammarReady || !question) return
    setAskingQuestion(true)
    void explainService
      .explainQuestion({
        articleId,
        segmentOrder,
        sentenceText: selectedSentence,
        question,
        responseLanguage,
      })
      .then((result) => {
        setQuestionAnswer(result.answer || '')
        setWarnings((prev) => {
          const merged = [...prev, ...(result.warnings || [])]
          return Array.from(new Set(merged))
        })
      })
      .catch((error: unknown) => {
        showError(getApiErrorMessage(error, t('common.error')))
      })
      .finally(() => {
        setAskingQuestion(false)
      })
  }

  const analyzeHint =
    selectedSentenceIndex == null
      ? t('pages.explain.selectHint')
      : t('pages.explain.selectedHint', { index: selectedSentenceIndex + 1 })

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <ExplainTopBar
        articleTitle={articleTitle || t('pages.explain.titleFallback')}
        languageLabel={languageLabel}
        backLabel={t('pages.explain.backToPractice')}
        onBackToPractice={backToPractice}
        onOpenMe={() => navigate('/me')}
      />

      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: '20px',
          pt: '4px',
          pb: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          animation: 'fadeUp 0.35s ease forwards',
          '@keyframes fadeUp': {
            from: { opacity: 0, transform: 'translateY(10px)' },
            to: { opacity: 1, transform: 'translateY(0)' },
          },
        }}
      >
        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', p: '12px 14px', bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '12px' }}>
            <CircularProgress size={16} thickness={5} />
            <Typography sx={{ fontSize: '13px', color: 'text.secondary' }}>{t('common.loading')}</Typography>
          </Box>
        )}

        {loadError && (
          <Box sx={{ p: '10px 12px', bgcolor: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.25)', borderRadius: '12px' }}>
            <Typography sx={{ fontSize: '12px', color: 'error.main' }}>{loadError}</Typography>
          </Box>
        )}

        {!loading && !loadError && (
          <>
            <Box sx={{ bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '14px', p: '16px' }}>
              <Typography sx={{ mb: '8px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'text.disabled' }}>
                {t('pages.explain.segmentLabel', { segment: segmentOrder })}
              </Typography>
              <SentenceSelectableParagraph
                text={segmentText}
                selectedSentenceIndex={selectedSentenceIndex}
                onSelectSentence={onSelectSentence}
              />
            </Box>

            <AiInsightPanel
              summaryTitle={t('pages.explain.summaryTitle')}
              keywordTitle={t('pages.explain.keywordTitle')}
              grammarTitle={t('pages.explain.grammarTitle')}
              summary={summary}
              keywords={keywords}
              grammarPoints={grammarPoints}
              emptyGrammarText={t('pages.explain.emptyGrammar')}
              warnings={warnings}
            />

            {grammarReady && (
              <Box sx={{ p: '14px', bgcolor: '#1a1a2c', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Typography sx={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'text.disabled' }}>
                  {t('pages.explain.questionTitle')}
                </Typography>
                <TextField
                  multiline
                  minRows={3}
                  maxRows={6}
                  value={questionInput}
                  onChange={(event) => setQuestionInput(event.target.value)}
                  placeholder={t('pages.explain.questionPlaceholder')}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      bgcolor: '#22223a',
                      color: 'text.primary',
                    },
                  }}
                />
                <Button
                  variant="contained"
                  disabled={!questionInput.trim() || askingQuestion}
                  onClick={onAskQuestion}
                >
                  {askingQuestion ? t('pages.explain.askingAction') : t('pages.explain.askAction')}
                </Button>
                {questionAnswer && (
                  <Box sx={{ p: '10px', borderRadius: '10px', bgcolor: '#22223a', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <Typography sx={{ fontSize: '12px', fontWeight: 700, color: 'text.primary' }}>
                      {t('pages.explain.answerTitle')}
                    </Typography>
                    <Typography sx={{ mt: '6px', fontSize: '12px', color: 'text.secondary', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {questionAnswer}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </>
        )}
      </Box>

      <StickyAnalyzeActionBar
        disabled={!selectedSentence || loading || Boolean(loadError)}
        loading={analyzing}
        hint={analyzeHint}
        actionLabel={t('pages.explain.analyzeAction')}
        loadingLabel={t('pages.explain.analyzingAction')}
        onAnalyze={onAnalyzeSentence}
      />
    </Box>
  )
}
