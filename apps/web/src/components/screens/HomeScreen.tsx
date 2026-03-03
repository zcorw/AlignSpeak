import { Box, Button, Card, CardContent, Chip, LinearProgress, MenuItem, Stack, TextField, Typography } from "@mui/material";
import type { HomeSummary } from "../../domain/practice/entities";

interface HomeScreenProps {
  summary: HomeSummary | null;
}

export const HomeScreen = ({ summary }: HomeScreenProps) => {
  if (!summary) {
    return (
      <Card>
        <CardContent>
          <Typography color="text.secondary">加载中...</Typography>
        </CardContent>
      </Card>
    );
  }

  const progress = Math.round((summary.completedSegments / summary.targetSegments) * 100);

  return (
    <Stack spacing={1.5}>
      <Card>
        <CardContent>
          <Chip label="MVP Flow" size="small" />
          <Typography variant="h6" mt={1}>
            今天目标：完成 {summary.targetSegments} 段练习
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ mt: 1.5, height: 10, borderRadius: 999 }}
          />
          <Typography variant="body2" color="text.secondary" mt={1}>
            已完成 {summary.completedSegments}/{summary.targetSegments} 段
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6">文章输入</Typography>
          <Stack spacing={1.5} mt={1}>
            <TextField select label="语言" size="small" defaultValue={summary.language}>
              <MenuItem value="ja">ja</MenuItem>
              <MenuItem value="en">en</MenuItem>
              <MenuItem value="zh">zh</MenuItem>
            </TextField>
            <TextField label="文本" defaultValue={summary.draftText} multiline minRows={4} />
            <Box display="flex" gap={1} flexWrap="wrap">
              <Button variant="contained" type="button">
                自动分段
              </Button>
              <Button variant="contained" color="secondary" type="button">
                生成TTS
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
};
