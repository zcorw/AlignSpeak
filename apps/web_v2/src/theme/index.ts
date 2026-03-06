import { createTheme } from '@mui/material/styles'

// Based on previews/styles.css design system
export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6e60ee',
      light: '#8b7fff',
      dark: '#5a4dd4',
    },
    secondary: {
      main: '#1a1a2c',
      light: '#22223a',
      dark: '#13131f',
    },
    success: {
      main: '#1dc98a',
    },
    warning: {
      main: '#f0a623',
    },
    error: {
      main: '#f05252',
    },
    background: {
      default: '#0a0a13',
      paper: '#13131f',
    },
    text: {
      primary: '#eeeef6',
      secondary: '#8888aa',
      disabled: '#55556a',
    },
    divider: 'rgba(255,255,255,0.07)',
  },
  shape: {
    borderRadius: 14,
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          padding: '13px 24px',
          fontSize: '15px',
          fontWeight: 600,
        },
        sizeLarge: {
          padding: '16px 32px',
          fontSize: '16px',
        },
        sizeSmall: {
          padding: '8px 16px',
          fontSize: '13px',
          fontWeight: 500,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#1a1a2c',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14,
        },
      },
    },
  },
})
