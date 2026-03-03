import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";
import StopCircleRoundedIcon from "@mui/icons-material/StopCircleRounded";
import {
  AppBar,
  Box,
  Button,
  Chip,
  Dialog,
  IconButton,
  Paper,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import type { MaskedToken } from "../../domain/practice/entities";

interface RecordingDocumentFullscreenProps {
  open: boolean;
  tokens: MaskedToken[];
  onCancel: () => void;
  onComplete: () => void;
}

export const RecordingDocumentFullscreen = ({
  open,
  tokens,
  onCancel,
  onComplete,
}: RecordingDocumentFullscreenProps) => {
  return (
    <Dialog open={open} fullScreen>
      <AppBar position="sticky" color="inherit" elevation={0}>
        <Toolbar>
          <IconButton edge="start" onClick={onCancel} aria-label="close">
            <CloseRoundedIcon />
          </IconButton>
          <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
            录音中
          </Typography>
          <Chip
            color="error"
            size="small"
            icon={<FiberManualRecordRoundedIcon />}
            label="REC"
            sx={{ "& .MuiChip-icon": { fontSize: 14 } }}
          />
        </Toolbar>
      </AppBar>

      <Stack spacing={2} sx={{ p: 2, pb: "calc(96px + env(safe-area-inset-bottom))" }}>
        <Paper variant="outlined" sx={{ p: 2, borderStyle: "dashed", minHeight: "40vh" }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {tokens.map((token, idx) =>
              token.hidden ? (
                <Box
                  key={`${token.text}-${idx}`}
                  sx={{
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 1,
                    backgroundColor: "action.disabledBackground",
                    color: "transparent",
                    minWidth: 52,
                    userSelect: "none",
                  }}
                >
                  {token.text}
                </Box>
              ) : (
                <Box key={`${token.text}-${idx}`} sx={{ fontSize: 24, lineHeight: 1.5, px: 0.25 }}>
                  {token.text}
                </Box>
              ),
            )}
          </Box>
        </Paper>
      </Stack>

      <Box
        sx={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          p: 2,
          pb: "calc(16px + env(safe-area-inset-bottom))",
          backgroundColor: "background.paper",
          borderTop: "1px solid",
          borderColor: "divider",
        }}
      >
        <Button
          fullWidth
          size="large"
          variant="contained"
          color="error"
          startIcon={<StopCircleRoundedIcon />}
          onClick={onComplete}
        >
          结束录音
        </Button>
      </Box>
    </Dialog>
  );
};
