import { useState } from "react";
import { Alert, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";

interface LoginScreenProps {
  loading: boolean;
  error: string | null;
  onLogin: (email: string, password: string) => Promise<void>;
  onGoRegister: () => void;
}

export const LoginScreen = ({ loading, error, onLogin, onGoRegister }: LoginScreenProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onLogin(email, password);
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" fontWeight={700}>
          Sign In to AlignSpeak
        </Typography>
        <Typography variant="body2" color="text.secondary" mt={0.75}>
          Use your email and password to continue.
        </Typography>
        <Stack component="form" spacing={1.25} mt={2} onSubmit={handleSubmit}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            fullWidth
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
            fullWidth
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
          <Button type="button" variant="text" onClick={onGoRegister} disabled={loading}>
            No account yet? Create one
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
};
