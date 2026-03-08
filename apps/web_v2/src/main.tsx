import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { theme } from './theme'
import './locales'
import App from './App.tsx'

const isIOSDevice = () =>
  /iP(ad|hone|od)/.test(window.navigator.userAgent) ||
  (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)

if (isIOSDevice()) {
  const preventGestureZoom = (event: Event) => {
    event.preventDefault()
  }
  document.addEventListener('gesturestart', preventGestureZoom as EventListener, { passive: false })
  document.addEventListener('gesturechange', preventGestureZoom as EventListener, { passive: false })
  document.addEventListener('gestureend', preventGestureZoom as EventListener, { passive: false })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
)
