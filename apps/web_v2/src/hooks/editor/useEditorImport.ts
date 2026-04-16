import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { EditorImageOrderItem } from '../../components/editor/EditorImageOrderOverlay'
import { useNotifier } from '../../components/common/feedbackHooks'
import type { OverlayLanguageCode } from '../../components/EditorTextOverlay'
import { markLegacyArticle } from '../../services/articleLegacyService'
import { articleService, type UploadBatchOrderSuggestion } from '../../services/articleService'
import { getApiErrorMessage } from '../../services/authService'

const buildArticleTitle = (text: string) => {
  const firstLine = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)
  if (!firstLine) return 'Untitled Article'
  return firstLine.length <= 50 ? firstLine : `${firstLine.slice(0, 50)}...`
}

export const useEditorImport = (editingArticleId: string | null = null) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { error: showError, success: showSuccess } = useNotifier()
  const inputRef = useRef<HTMLInputElement>(null)

  const [overlayOpenByUser, setOverlayOpenByUser] = useState(false)
  const [dismissedEditingOverlayForId, setDismissedEditingOverlayForId] = useState<string | null>(null)
  const [uploadOcrLoading, setUploadOcrLoading] = useState(false)
  const [loadedEditingArticleId, setLoadedEditingArticleId] = useState<string | null>(null)
  const [importedText, setImportedText] = useState('')
  const [initialLanguage, setInitialLanguage] = useState<OverlayLanguageCode>('en')
  const [importVersion, setImportVersion] = useState(0)
  const [focusVersion, setFocusVersion] = useState(0)
  const [creatingArticle, setCreatingArticle] = useState(false)
  const [orderOverlayOpen, setOrderOverlayOpen] = useState(false)
  const [orderItems, setOrderItems] = useState<EditorImageOrderItem[]>([])
  const [orderSuggestion, setOrderSuggestion] = useState<UploadBatchOrderSuggestion | null>(null)
  const isEditing = Boolean(editingArticleId)
  const editingOverlayAutoOpen = isEditing && dismissedEditingOverlayForId !== editingArticleId
  const overlayOpen = editingOverlayAutoOpen || overlayOpenByUser
  const editingOcrLoading = isEditing && loadedEditingArticleId !== editingArticleId
  const ocrLoading = editingOcrLoading || uploadOcrLoading

  const applyImportedText = (value: string) => {
    setImportedText(value)
    setImportVersion((prev) => prev + 1)
    setFocusVersion((prev) => prev + 1)
  }

  const closeOverlay = () => {
    setUploadOcrLoading(false)
    setOverlayOpenByUser(false)
    setOrderOverlayOpen(false)
    if (editingArticleId) setDismissedEditingOverlayForId(editingArticleId)
  }

  const openOverlay = (source: 'clipboard' | 'manual') => {
    setOverlayOpenByUser(true)
    if (editingArticleId) setDismissedEditingOverlayForId(null)
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
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return

    const locale = navigator.language.toLowerCase()
    const languageHint = locale.startsWith('zh') ? 'zh' : locale.startsWith('ja') ? 'ja' : 'en'

    if (files.length > 1) {
      const hasNonImageFile = files.some((file) => {
        const lowerName = file.name.toLowerCase()
        return !(/\.(png|jpg|jpeg|webp)$/i.test(lowerName) || file.type.startsWith('image/'))
      })
      if (hasNonImageFile) {
        showError(t('pages.editor.batch.onlyImageFiles'))
        return
      }

      setUploadOcrLoading(true)
      setOverlayOpenByUser(false)
      setOrderOverlayOpen(true)
      void articleService
        .parseUploadBatch(files, languageHint)
        .then((result) => {
          const sorted = [...(result.items || [])].sort(
            (left, right) => left.suggestedOrder - right.suggestedOrder
          )
          setOrderItems(
            sorted.map((item) => ({
              imageId: item.imageId,
              filename: item.filename,
              text: item.text,
              pageMarkerCandidates: item.pageMarkerCandidates || [],
              suggestedOrder: item.suggestedOrder,
            }))
          )
          setOrderSuggestion(result.orderSuggestion || null)
        })
        .catch((error: unknown) => {
          setOrderOverlayOpen(false)
          const message = getApiErrorMessage(error, t('common.error'))
          showError(message)
        })
        .finally(() => {
          setUploadOcrLoading(false)
        })
      return
    }

    const file = files[0]
    setOverlayOpenByUser(true)
    setUploadOcrLoading(true)
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
        setUploadOcrLoading(false)
      })
  }

  const closeOrderOverlay = () => {
    setOrderOverlayOpen(false)
    setOrderItems([])
    setOrderSuggestion(null)
  }

  const confirmOrderAndComposeText = (orderedImageIds: string[]) => {
    const byId = new Map(orderItems.map((item) => [item.imageId, item]))
    const merged = orderedImageIds
      .map((id) => byId.get(id)?.text?.trim() || '')
      .filter(Boolean)
      .join('\n\n')
      .trim()
    if (!merged) {
      showError(t('pages.editor.batch.emptyResult'))
      return
    }
    applyImportedText(merged)
    setOrderOverlayOpen(false)
    setOrderItems([])
    setOrderSuggestion(null)
    setOverlayOpenByUser(true)
    showSuccess(t('pages.editor.batch.orderApplied'))
  }

  const confirmArticle = (payload: { text: string; language: OverlayLanguageCode }) => {
    if (creatingArticle) return
    setCreatingArticle(true)

    const title = buildArticleTitle(payload.text)
    if (editingArticleId) {
      void articleService
        .createArticle({
          title,
          language: payload.language,
          text: payload.text,
        })
        .then((article) => {
          markLegacyArticle(editingArticleId, article.articleId)
          sessionStorage.setItem('article_id', article.articleId)
          sessionStorage.setItem('article_text', payload.text)
          sessionStorage.setItem('article_lang', payload.language)
          showSuccess(t('pages.editor.cloneSuccess'))
          navigate(`/practice?a=${encodeURIComponent(article.articleId)}&seg=1&lv=L0`)
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
    void articleService
      .getArticleDetail(editingArticleId, false)
      .then((detail) => {
        if (!active) return
        const language = detail.language === 'ja' || detail.language === 'zh' ? detail.language : 'en'
        setInitialLanguage(language)
        applyImportedText(detail.rawText || '')
      })
      .catch((error: unknown) => {
        if (!active) return
        showError(getApiErrorMessage(error, t('common.error')))
        navigate('/me', { replace: true })
      })
      .finally(() => {
        if (active) setLoadedEditingArticleId(editingArticleId)
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
    closeOrderOverlay,
    openOverlay,
    pickFile,
    importFile,
    orderOverlayOpen,
    orderItems,
    orderSuggestion,
    confirmOrderAndComposeText,
    confirmArticle,
  }
}
