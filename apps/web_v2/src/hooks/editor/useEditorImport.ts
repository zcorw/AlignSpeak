import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useNotifier } from '../../components/common/feedbackHooks'
import type { OverlayLanguageCode } from '../../components/EditorTextOverlay'
import { articleService } from '../../services/articleService'
import { getApiErrorMessage } from '../../services/authService'

const buildArticleTitle = (text: string) => {
  const firstLine = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)
  if (!firstLine) return 'Untitled Article'
  return firstLine.length <= 50 ? firstLine : `${firstLine.slice(0, 50)}...`
}

const normalizeEditorText = (value: string) =>
  value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()

export const useEditorImport = (editingArticleId: string | null = null) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { error: showError, success: showSuccess } = useNotifier()
  const inputRef = useRef<HTMLInputElement>(null)
  const initialArticleRef = useRef<{ rawText: string; language: OverlayLanguageCode } | null>(null)

  const [overlayOpen, setOverlayOpen] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [importedText, setImportedText] = useState('')
  const [initialLanguage, setInitialLanguage] = useState<OverlayLanguageCode>('en')
  const [importVersion, setImportVersion] = useState(0)
  const [focusVersion, setFocusVersion] = useState(0)
  const [creatingArticle, setCreatingArticle] = useState(false)
  const isEditing = Boolean(editingArticleId)

  const applyImportedText = (value: string) => {
    setImportedText(value)
    setImportVersion((prev) => prev + 1)
    setFocusVersion((prev) => prev + 1)
  }

  const closeOverlay = () => {
    setOcrLoading(false)
    setOverlayOpen(false)
  }

  const openOverlay = (source: 'clipboard' | 'manual') => {
    setOverlayOpen(true)
    if (source === 'manual') {
      setFocusVersion((prev) => prev + 1)
      return
    }

    navigator.clipboard
      .readText()
      .then((value) => {
        applyImportedText(value || '')
      })
      .catch(() => {
        applyImportedText('')
      })
  }

  const pickFile = () => {
    inputRef.current?.click()
  }

  const importFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setOverlayOpen(true)
    setOcrLoading(true)

    const locale = navigator.language.toLowerCase()
    const languageHint = locale.startsWith('zh') ? 'zh' : locale.startsWith('ja') ? 'ja' : 'en'

    void articleService
      .parseUploadFile(file, languageHint)
      .then((result) => {
        applyImportedText(result.text || '')
      })
      .catch((error: unknown) => {
        const message = getApiErrorMessage(error, t('common.error'))
        showError(message)
      })
      .finally(() => {
        setOcrLoading(false)
      })
  }

  const confirmArticle = (payload: { text: string; language: OverlayLanguageCode }) => {
    if (creatingArticle) return
    setCreatingArticle(true)

    const title = buildArticleTitle(payload.text)
    if (editingArticleId) {
      const initial = initialArticleRef.current
      const textChanged = normalizeEditorText(payload.text) !== normalizeEditorText(initial?.rawText ?? '')
      const languageChanged = payload.language !== initial?.language
      const updatePayload: {
        title?: string
        language?: OverlayLanguageCode
        text?: string
      } = { title }
      if (textChanged) updatePayload.text = payload.text
      if (languageChanged) updatePayload.language = payload.language

      void articleService
        .updateArticle(editingArticleId, updatePayload)
        .then(() => {
          sessionStorage.setItem('article_id', editingArticleId)
          sessionStorage.setItem('article_lang', payload.language)
          showSuccess(t('pages.editor.updateSuccess'))
          navigate(`/practice?a=${encodeURIComponent(editingArticleId)}&seg=1&lv=L0`)
        })
        .catch((error: unknown) => {
          const message = getApiErrorMessage(error, t('common.error'))
          showError(message)
        })
        .finally(() => {
          setCreatingArticle(false)
        })
      return
    }

    void articleService
      .createArticle({
        title,
        language: payload.language,
        text: payload.text,
      })
      .then((article) => {
        sessionStorage.setItem('article_id', article.articleId)
        sessionStorage.setItem('article_text', payload.text)
        sessionStorage.setItem('article_lang', payload.language)
        navigate('/practice?new=1')
      })
      .catch((error: unknown) => {
        const message = getApiErrorMessage(error, t('common.error'))
        showError(message)
      })
      .finally(() => {
        setCreatingArticle(false)
      })
  }

  useEffect(() => {
    if (!editingArticleId) return
    let active = true
    setOverlayOpen(true)
    setOcrLoading(true)
    void articleService
      .getArticleDetail(editingArticleId, false)
      .then((detail) => {
        if (!active) return
        const language = detail.language === 'ja' || detail.language === 'zh' ? detail.language : 'en'
        initialArticleRef.current = { rawText: detail.rawText, language }
        setInitialLanguage(language)
        applyImportedText(detail.rawText || '')
      })
      .catch((error: unknown) => {
        if (!active) return
        showError(getApiErrorMessage(error, t('common.error')))
        navigate('/me', { replace: true })
      })
      .finally(() => {
        if (active) setOcrLoading(false)
      })
    return () => {
      active = false
    }
  }, [editingArticleId, navigate, showError, t])

  return {
    inputRef,
    overlayOpen,
    ocrLoading,
    importedText,
    importVersion,
    focusVersion,
    initialLanguage,
    creatingArticle,
    isEditing,
    closeOverlay,
    openOverlay,
    pickFile,
    importFile,
    confirmArticle,
  }
}
