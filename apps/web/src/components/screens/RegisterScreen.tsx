import { useState } from "react";
import { Alert, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import type { RegisterResult } from "../../domain/auth/entities";

interface RegisterScreenProps {
  loading: boolean;
  error: string | null;
  onRegister: (email: string, password: string, displayName: string) => Promise<RegisterResult | null>;
  onRegistered: (email: string, result: RegisterResult) => void;
  onGoLogin: () => void;
}

export const RegisterScreen = ({
  loading,
  error,
  onRegister,
  onRegistered,
  onGoLogin,
}: RegisterScreenProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setSuccessMessage(null);
    const result = await onRegister(email, password, displayName);
    if (!result) {
      return;
    }
    setSuccessMessage(result.message);
    onRegistered(email, result);
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" fontWeight={700}>
          Create AlignSpeak Account
        </Typography>
        <Typography variant="body2" color="text.secondary" mt={0.75}>
          Password must be at least 8 characters and include letters and numbers.
        </Typography>
        <Stack component="form" spacing={1.25} mt={2} onSubmit={handleRegister}>
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
            autoComplete="new-password"
            fullWidth
          />
          <TextField
            label="Display Name (optional)"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="nickname"
            fullWidth
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
          {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? "Registering..." : "Register"}
          </Button>
          <Button type="button" variant="text" onClick={onGoLogin} disabled={loading}>
            Already have an account? Sign in
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
};
