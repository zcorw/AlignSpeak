import { Box, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { EditorTextOverlay } from '../components/EditorTextOverlay'
import { EditorImportMethods } from '../components/editor/EditorImportMethods'
import { EditorManualEntryTrigger } from '../components/editor/EditorManualEntryTrigger'
import { EditorTopBar } from '../components/editor/EditorTopBar'
import { useEditorImport } from '../hooks/editor/useEditorImport'

export const EditorPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editingArticleId = searchParams.get('article')?.trim() || null
  const {
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
  } = useEditorImport(editingArticleId)

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <EditorTopBar
        title={isEditing ? t('pages.editor.topbar.editTitle') : t('pages.editor.topbar.title')}
        backAriaLabel={t('pages.editor.topbar.backAriaLabel')}
        meAriaLabel={t('pages.editor.topbar.meAriaLabel')}
        onBack={() => navigate(isEditing ? '/me' : '/start')}
        onOpenMe={() => navigate('/me')}
      />

      <Box
        sx={{
          flex: 1,
          px: '24px',
          pt: '8px',
          pb: '32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          overflowY: 'auto',
          animation: 'fadeUp 0.35s ease forwards',
          '@keyframes fadeUp': {
            from: { opacity: 0, transform: 'translateY(10px)' },
            to: { opacity: 1, transform: 'translateY(0)' },
          },
          '&::-webkit-scrollbar': { width: 3 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255,255,255,0.13)',
            borderRadius: '4px',
          },
        }}
      >
        <Box>
          <Typography component="h1" sx={{ fontSize: '22px', fontWeight: 700, lineHeight: 1.3 }}>
            {t('pages.editor.headline')}
          </Typography>
          <Typography sx={{ mt: '6px', fontSize: '14px', color: 'text.secondary', lineHeight: 1.6 }}>
            {t('pages.editor.description')}
          </Typography>
        </Box>

        <EditorImportMethods
          clipboardTitle={t('pages.editor.methods.clipboard.name')}
          clipboardDesc={t('pages.editor.methods.clipboard.desc')}
          clipboardRecommended={t('pages.editor.methods.clipboard.recommended')}
          uploadTitle={t('pages.editor.methods.upload.name')}
          uploadDesc={t('pages.editor.methods.upload.desc')}
          inputRef={inputRef}
          onClipboard={() => openOverlay('clipboard')}
          onUploadClick={pickFile}
          onFileChange={importFile}
        />

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '12px',
            color: 'text.disabled',
            '&::before, &::after': {
              content: '""',
              flex: 1,
              height: 1,
              bgcolor: 'divider',
            },
          }}
        >
          {t('pages.editor.manualDivider')}
        </Box>

        <EditorManualEntryTrigger
          label={t('pages.editor.manualInput')}
          onClick={() => openOverlay('manual')}
        />
      </Box>

      <EditorTextOverlay
        key={importVersion}
        open={overlayOpen}
        ocrLoading={ocrLoading}
        importedText={importedText}
        initialLanguage={initialLanguage}
        focusVersion={focusVersion}
        submitting={creatingArticle}
        onClose={closeOverlay}
        onConfirm={confirmArticle}
      />
    </Box>
  )
}
