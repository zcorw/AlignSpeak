import { type ChangeEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
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

export const useEditorImport = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const [overlayOpen, setOverlayOpen] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [importedText, setImportedText] = useState('')
  const [importVersion, setImportVersion] = useState(0)
  const [focusVersion, setFocusVersion] = useState(0)
  const [creatingArticle, setCreatingArticle] = useState(false)

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
        window.alert(message)
      })
      .finally(() => {
        setOcrLoading(false)
      })
  }

  const confirmArticle = (payload: { text: string; language: OverlayLanguageCode }) => {
    if (creatingArticle) return
    setCreatingArticle(true)

    const title = buildArticleTitle(payload.text)
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
        window.alert(message)
      })
      .finally(() => {
        setCreatingArticle(false)
      })
  }

  return {
    inputRef,
    overlayOpen,
    ocrLoading,
    importedText,
    importVersion,
    focusVersion,
    creatingArticle,
    closeOverlay,
    openOverlay,
    pickFile,
    importFile,
    confirmArticle,
  }
}
