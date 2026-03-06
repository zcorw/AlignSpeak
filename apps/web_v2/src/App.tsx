import { Routes, Route, Navigate } from 'react-router-dom'
import { Box } from '@mui/material'
import {
  StartPage,
  EditorPage,
  PracticePage,
  ResultPage,
  MePage,
  LoginPage,
  RegisterPage,
  VerifyEmailPage,
} from './pages'

function App() {
  // TODO: Add authentication check
  const isAuthenticated = false

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
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/register/verify" element={<VerifyEmailPage />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to="/start" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="/start" element={<StartPage />} />
        <Route path="/editor" element={<EditorPage />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="/me" element={<MePage />} />
      </Routes>
    </Box>
  )
}

export default App
