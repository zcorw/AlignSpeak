import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import { Button, Stack, Typography } from "@mui/material";
import type { HistoryDoc } from "../../domain/practice/entities";

interface HistoryDocItemProps {
  doc: HistoryDoc;
  onResume: (docId: string) => void;
}

export const HistoryDocItem = ({ doc, onResume }: HistoryDocItemProps) => {
  return (
    <Stack
      spacing={1}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        p: 1.5,
        backgroundColor: "common.white",
      }}
    >
      <div>
        <Typography fontWeight={700}>{doc.title}</Typography>
        <Typography variant="body2" color="text.secondary">
          上次练习：{doc.lastPracticedAt} · Level {doc.level} · 进度 {doc.progressRate}%
        </Typography>
      </div>
      <Button
        variant="contained"
        color="secondary"
        startIcon={<PlayArrowRoundedIcon />}
        sx={{ alignSelf: "flex-start" }}
        type="button"
        onClick={() => onResume(doc.id)}
      >
        继续练习
      </Button>
    </Stack>
  );
};
