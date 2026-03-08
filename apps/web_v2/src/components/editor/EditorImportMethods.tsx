import { ContentPasteRounded, UploadFileRounded } from '@mui/icons-material'
import { Box, Typography } from '@mui/material'
import type { ChangeEvent, RefObject } from 'react'

interface EditorImportMethodsProps {
  clipboardTitle: string
  clipboardDesc: string
  clipboardRecommended: string
  uploadTitle: string
  uploadDesc: string
  inputRef: RefObject<HTMLInputElement>
  onClipboard: () => void
  onUploadClick: () => void
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
}

export const EditorImportMethods = ({
  clipboardTitle,
  clipboardDesc,
  clipboardRecommended,
  uploadTitle,
  uploadDesc,
  inputRef,
  onClipboard,
  onUploadClick,
  onFileChange,
}: EditorImportMethodsProps) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
    <Box
      component="button"
      type="button"
      onClick={onClipboard}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        p: '16px 18px',
        textAlign: 'left',
        bgcolor: '#1a1a2c',
        color: 'text.primary',
        border: '1px solid rgba(255,255,255,0.13)',
        borderRadius: '14px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, background-color 0.15s',
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: '#22223a',
        },
      }}
    >
      <Box
        sx={{
          width: 42,
          height: 42,
          borderRadius: '10px',
          bgcolor: '#22223a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <ContentPasteRounded sx={{ fontSize: 20, color: 'text.secondary' }} />
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: '15px', fontWeight: 600, color: 'text.primary' }}>
          {clipboardTitle}
        </Typography>
        <Typography sx={{ mt: '2px', fontSize: '12px', color: 'text.secondary' }}>
          {clipboardDesc}
        </Typography>
      </Box>
      <Box
        sx={{
          px: '8px',
          py: '2px',
          borderRadius: '20px',
          bgcolor: 'rgba(110,96,238,0.25)',
          color: 'primary.light',
          fontSize: '11px',
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {clipboardRecommended}
      </Box>
    </Box>

    <Box
      component="button"
      type="button"
      onClick={onUploadClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        p: '16px 18px',
        textAlign: 'left',
        bgcolor: '#1a1a2c',
        color: 'text.primary',
        border: '1px solid rgba(255,255,255,0.13)',
        borderRadius: '14px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, background-color 0.15s',
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: '#22223a',
        },
      }}
    >
      <Box
        sx={{
          width: 42,
          height: 42,
          borderRadius: '10px',
          bgcolor: '#22223a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <UploadFileRounded sx={{ fontSize: 20, color: 'text.secondary' }} />
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: '15px', fontWeight: 600, color: 'text.primary' }}>
          {uploadTitle}
        </Typography>
        <Typography sx={{ mt: '2px', fontSize: '12px', color: 'text.secondary' }}>
          {uploadDesc}
        </Typography>
      </Box>
    </Box>

    <input
      ref={inputRef}
      type="file"
      accept=".txt,.md,image/*"
      style={{ display: 'none' }}
      onChange={onFileChange}
    />
  </Box>
)
