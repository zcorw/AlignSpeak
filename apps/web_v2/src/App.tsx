import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import {
  StartPage,
  EditorPage,
  PracticePage,
  ResultPage,
  MePage,
  LoginPage,
  RegisterPage,
} from './pages'
import { authService } from './services/authService'
import { entryService } from './services/entryService'
import { useAuthStore } from './stores/authStore'

function App() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [hasPreviousUnfinishedArticle, setHasPreviousUnfinishedArticle] = useState(false)

  useEffect(() => {
    let active = true

    const bootstrapAuth = async () => {
      if (!accessToken) {
        setHasPreviousUnfinishedArticle(false)
        if (active) setCheckingAuth(false)
        return
      }
      if (active) setCheckingAuth(true)

      try {
        const me = await authService.me()
        if (!active) return
        setUser({
          id: me.userId,
          email: me.email,
          role: me.role,
          displayName: me.displayName,
          status: me.status,
        })
        const hasUnfinished = await entryService.hasPreviousUnfinishedArticle()
        if (!active) return
        setHasPreviousUnfinishedArticle(hasUnfinished)
      } catch {
        if (!active) return
        clearAuth()
        setHasPreviousUnfinishedArticle(false)
      } finally {
        if (active) setCheckingAuth(false)
      }
    }

    void bootstrapAuth()
    return () => {
      active = false
    }
  }, [accessToken, clearAuth, setUser])

  const isAuthenticated = Boolean(accessToken && user)
  const defaultAuthedRoute = hasPreviousUnfinishedArticle ? '/start' : '/editor'

  if (checkingAuth) {
    return (
      <Box
        sx={{
          width: '100%',
          maxWidth: '430px',
          minHeight: '100vh',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress size={28} />
      </Box>
    )
  }

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '430px',
        minHeight: '100vh',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Routes>
        {/* Auth routes */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to={defaultAuthedRoute} replace /> : <LoginPage />}
        />
        <Route
          path="/register"
          element={isAuthenticated ? <Navigate to={defaultAuthedRoute} replace /> : <RegisterPage />}
        />
        <Route path="/register/verify" element={<Navigate to="/register" replace />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to={defaultAuthedRoute} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/start"
          element={
            isAuthenticated ? (
              hasPreviousUnfinishedArticle ? (
                <StartPage />
              ) : (
                <Navigate to="/editor" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/editor"
          element={isAuthenticated ? <EditorPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/practice"
          element={isAuthenticated ? <PracticePage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/result"
          element={isAuthenticated ? <ResultPage /> : <Navigate to="/login" replace />}
        />
        <Route path="/me" element={isAuthenticated ? <MePage /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to={isAuthenticated ? defaultAuthedRoute : '/login'} replace />} />
      </Routes>
    </Box>
  )
}

export default App
