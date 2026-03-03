import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import RadioButtonCheckedRoundedIcon from "@mui/icons-material/RadioButtonCheckedRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import { Box, Button, Paper, Stack } from "@mui/material";
import type { PracticePreRecordData } from "../../domain/practice/entities";


interface PracticePreRecordViewProps {
  data: PracticePreRecordData;
  hasRecording: boolean;
  isSubmitting: boolean;
  onStartRecording: () => void;
  onSubmitRecognition: () => void;
}

export const PracticePreRecordView = ({
  data,
  hasRecording,
  isSubmitting,
  onStartRecording,
  onSubmitRecognition,
}: PracticePreRecordViewProps) => {
  return (
    <Stack spacing={1.5} mt={1.25}>
      <Paper variant="outlined" sx={{ p: 1.5, borderStyle: "dashed" }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          {data.tokens.map((token, idx) =>
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
              <Box key={`${token.text}-${idx}`} sx={{ fontSize: 22, lineHeight: 1.35, px: 0.25 }}>
                {token.text}
              </Box>
            ),
          )}
        </Box>
      </Paper>
      <Stack direction="row" spacing={1} flexWrap="wrap">
        <Button variant="contained" color="secondary" startIcon={<PlayCircleOutlineRoundedIcon />} type="button">
          播放标准音频
        </Button>
        <Button
          variant="contained"
          startIcon={<RadioButtonCheckedRoundedIcon />}
          type="button"
          onClick={onStartRecording}
        >
          {hasRecording ? "重新录音" : "开始录音"}
        </Button>
        {hasRecording ? (
          <Button
            variant="outlined"
            startIcon={<SendRoundedIcon />}
            type="button"
            disabled={isSubmitting}
            onClick={onSubmitRecognition}
          >
            {isSubmitting ? "识别中..." : "提交识别"}
          </Button>
        ) : null}
      </Stack>
    </Stack>
  );
};
