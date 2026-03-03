import NavigateNextRoundedIcon from "@mui/icons-material/NavigateNextRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import { Button, Stack } from "@mui/material";

export const PracticeActionBar = () => {
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap">
      <Button variant="contained" color="secondary" startIcon={<PlayCircleOutlineRoundedIcon />} type="button">
        播放标准音频
      </Button>
      <Button variant="contained" startIcon={<ReplayRoundedIcon />} type="button">
        重新录音
      </Button>
      <Button variant="outlined" endIcon={<NavigateNextRoundedIcon />} type="button">
        下一段
      </Button>
    </Stack>
  );
};
