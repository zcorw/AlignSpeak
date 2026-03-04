import { useCallback, useMemo } from "react";
import { Alert, Box, CircularProgress } from "@mui/material";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { createAppUseCases } from "./application/usecases/createAppUseCases";
import { BottomTabBar } from "./components/layout/BottomTabBar";
import { HomeScreen } from "./components/screens/HomeScreen";
import { LoginScreen } from "./components/screens/LoginScreen";
import { MeScreen } from "./components/screens/MeScreen";
import { PracticeScreen } from "./components/screens/PracticeScreen";
import { ProgressScreen } from "./components/screens/ProgressScreen";
import { RegisterScreen } from "./components/screens/RegisterScreen";
import { VerifyEmailScreen } from "./components/screens/VerifyEmailScreen";
import type {
  LoginPayload,
  RegisterPayload,
  RegisterResult,
  VerifyEmailPayload,
} from "./domain/auth/entities";
import { useAuthController } from "./hooks/useAuthController";
import { useAppController } from "./hooks/useAppController";
import { AuthApiRepository } from "./infrastructure/repositories/AuthApiRepository";
import { PracticeApiRepository } from "./infrastructure/repositories/PracticeApiRepository";
import type { AppRoutePath } from "./types/ui";

interface VerifyRouteState {
  email?: string;
  verificationCode?: string;
}

const routeToTabPath = (pathname: string): AppRoutePath => {
  if (pathname === "/practice") return "/practice";
  if (pathname === "/progress") return "/progress";
  if (pathname === "/me") return "/me";
  return "/home";
};

function App() {
  const authRepository = useMemo(() => new AuthApiRepository(), []);
  const auth = useAuthController(authRepository);

  const useCases = useMemo(() => {
    const repository = new PracticeApiRepository();
    return createAppUseCases(repository);
  }, []);

  const location = useLocation();
  const navigate = useNavigate();
  const verifyState = (location.state as VerifyRouteState | null) ?? undefined;
  const logout = auth.logout;

  const isAuthenticated = auth.status === "authenticated";
  const isCheckingAuth = auth.status === "checking";
  const isAuthRoute =
    location.pathname === "/login" ||
    location.pathname === "/register" ||
    location.pathname === "/register/verify";

  const handleUnauthorized = useCallback(() => {
    logout();
    navigate("/login", { replace: true });
  }, [logout, navigate]);

  const { ui, data, actions, articleCreating, loading, error } = useAppController(useCases, {
    enabled: isAuthenticated,
    onUnauthorized: handleUnauthorized,
    maxAutoRequestAttempts: 2,
  });
  const activePath = routeToTabPath(location.pathname);

  const handleLogin = async (email: string, password: string) => {
    const success = await auth.login({
      email,
      password,
    } satisfies LoginPayload);
    if (success) {
      navigate("/home", { replace: true });
    }
  };

  const handleRegister = async (email: string, password: string, displayName: string) => {
    return auth.register({
      email,
      password,
      displayName: displayName || undefined,
    } satisfies RegisterPayload);
  };

  const handleRegistered = (email: string, result: RegisterResult) => {
    if (result.verificationRequired) {
      navigate("/register/verify", {
        state: {
          email,
          verificationCode: result.verificationCode,
        } satisfies VerifyRouteState,
      });
      return;
    }
    navigate("/login");
  };

  const handleVerifyEmail = async (email: string, code: string) => {
    const result = await auth.verifyEmail({
      email,
      code,
    } satisfies VerifyEmailPayload);
    if (result) {
      navigate("/login", { replace: true });
    }
    return result;
  };

  const handleResumeDoc = (docId: string) => {
    ui.resumeFromHistory(docId);
    navigate("/practice");
  };

  if (isCheckingAuth) {
    return (
      <Box minHeight="100vh" display="flex" alignItems="center" justifyContent="center">
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box
      component="main"
      sx={{
        width: "min(440px, 100vw)",
        mx: "auto",
        minHeight: "100vh",
        px: 1.75,
        pt: 2,
        pb: "calc(88px + env(safe-area-inset-bottom))",
        display: "grid",
        alignContent: "start",
        gap: 1.5,
      }}
    >
      {isAuthenticated && error ? <Alert severity="error">{error}</Alert> : null}
      {isAuthenticated && loading ? (
        <Box display="flex" justifyContent="center" py={1}>
          <CircularProgress size={22} />
        </Box>
      ) : null}

      <Routes>
        <Route path="/" element={<Navigate to={isAuthenticated ? "/home" : "/login"} replace />} />
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/home" replace />
            ) : (
              <LoginScreen
                loading={auth.loading}
                error={auth.error}
                onLogin={handleLogin}
                onGoRegister={() => {
                  auth.clearError();
                  navigate("/register");
                }}
              />
            )
          }
        />
        <Route
          path="/register"
          element={
            isAuthenticated ? (
              <Navigate to="/home" replace />
            ) : (
              <RegisterScreen
                loading={auth.loading}
                error={auth.error}
                onRegister={handleRegister}
                onRegistered={handleRegistered}
                onGoLogin={() => {
                  auth.clearError();
                  navigate("/login");
                }}
              />
            )
          }
        />
        <Route
          path="/register/verify"
          element={
            isAuthenticated ? (
              <Navigate to="/home" replace />
            ) : (
              <VerifyEmailScreen
                loading={auth.loading}
                error={auth.error}
                initialEmail={verifyState?.email}
                initialVerificationCode={verifyState?.verificationCode}
                onVerifyEmail={handleVerifyEmail}
                onGoRegister={() => {
                  auth.clearError();
                  navigate("/register");
                }}
                onGoLogin={() => {
                  auth.clearError();
                  navigate("/login");
                }}
              />
            )
          }
        />
        <Route
          path="/home"
          element={
            isAuthenticated ? (
              <HomeScreen
                articles={data.articles}
                creating={articleCreating}
                onCreateArticle={actions.createArticle}
                onDetectLanguage={actions.detectArticleLanguage}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/practice"
          element={
            isAuthenticated ? (
              <PracticeScreen
                bundle={data.practiceBundle}
                selectedSegmentId={ui.selectedSegmentId}
                onSelectSegment={ui.setSelectedSegmentId}
                onSubmitRecognition={actions.submitRecognition}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/progress"
          element={
            isAuthenticated ? <ProgressScreen summary={data.progressSummary} /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/me"
          element={
            isAuthenticated ? (
              <MeScreen summary={data.meSummary} onResumeDoc={handleResumeDoc} onLogout={handleUnauthorized} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to={isAuthenticated ? "/home" : "/login"} replace />} />
      </Routes>

      {isAuthenticated && !isAuthRoute ? (
        <BottomTabBar activePath={activePath} onChange={(path) => navigate(path)} />
      ) : null}
    </Box>
  );
}

export default App;
