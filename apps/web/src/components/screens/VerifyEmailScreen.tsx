import { useState } from "react";
import { Alert, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import type { VerifyEmailResult } from "../../domain/auth/entities";

interface VerifyEmailScreenProps {
  loading: boolean;
  error: string | null;
  initialEmail?: string;
  initialVerificationCode?: string;
  onVerifyEmail: (email: string, code: string) => Promise<VerifyEmailResult | null>;
  onGoRegister: () => void;
  onGoLogin: () => void;
}

export const VerifyEmailScreen = ({
  loading,
  error,
  initialEmail,
  initialVerificationCode,
  onVerifyEmail,
  onGoRegister,
  onGoLogin,
}: VerifyEmailScreenProps) => {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [code, setCode] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setSuccessMessage(null);
    const result = await onVerifyEmail(email, code);
    if (result) {
      setSuccessMessage(result.message);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" fontWeight={700}>
          Verify Email
        </Typography>
        <Typography variant="body2" color="text.secondary" mt={0.75}>
          Enter the verification code to activate your account.
        </Typography>
        <Stack component="form" spacing={1.25} mt={2} onSubmit={handleVerify}>
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
            label="Verification Code"
            value={code}
            onChange={(event) => setCode(event.target.value.trim())}
            required
            fullWidth
          />
          {initialVerificationCode ? (
            <Alert severity="info">Dev verification code: {initialVerificationCode}</Alert>
          ) : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
          {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? "Verifying..." : "Verify"}
          </Button>
          <Button type="button" variant="text" onClick={onGoRegister} disabled={loading}>
            Back to register
          </Button>
          <Button type="button" variant="text" onClick={onGoLogin} disabled={loading}>
            Back to sign in
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
};
