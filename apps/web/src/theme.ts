import { createTheme } from "@mui/material/styles";

export const appTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#d85d3c",
    },
    secondary: {
      main: "#1f7a74",
    },
    background: {
      default: "#f7f3ea",
      paper: "#fffdf9",
    },
    text: {
      primary: "#1d2a2f",
      secondary: "#5f6d72",
    },
  },
  shape: {
    borderRadius: 14,
  },
  typography: {
    fontFamily: '"Noto Sans SC", "Space Grotesk", sans-serif',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          boxShadow: "0 10px 30px rgba(29, 42, 47, 0.1)",
          border: "1px solid #dcd4c6",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          textTransform: "none",
          fontWeight: 700,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 18,
        },
      },
    },
  },
});

