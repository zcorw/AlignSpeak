import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline, GlobalStyles, ThemeProvider } from "@mui/material";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { appTheme } from "./theme";

const shouldEnableMocking = () => {
  console.log("Checking if mocking should be enabled...", import.meta.env);
  if (!import.meta.env.DEV) return false;
  const flag = import.meta.env.VITE_USE_MOCK;
  return flag?.toLowerCase() !== "false";
};

const renderApp = () => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <GlobalStyles
          styles={{
            body: {
              background:
                "radial-gradient(circle at 20% -10%, rgba(216, 93, 60, 0.2), transparent 45%), radial-gradient(circle at 100% -20%, rgba(31, 122, 116, 0.2), transparent 50%), #f7f3ea",
            },
          }}
        />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </StrictMode>,
  );
};

const enableMocking = async () => {
  if (!shouldEnableMocking()) return;
  const { worker } = await import("./mocks/browser");
  await worker.start({
    onUnhandledRequest: "bypass",
  });
};

void enableMocking().then(renderApp);
