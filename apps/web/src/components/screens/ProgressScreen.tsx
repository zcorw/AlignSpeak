import { Card, CardContent, Stack, Typography } from "@mui/material";
import type { ProgressSummary } from "../../domain/practice/entities";

interface ProgressScreenProps {
  summary: ProgressSummary | null;
}

export const ProgressScreen = ({ summary }: ProgressScreenProps) => {
  if (!summary) {
    return (
      <Card>
        <CardContent>
          <Typography color="text.secondary">加载中...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Stack spacing={1.5}>
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              平均准确率
            </Typography>
            <Typography variant="h4">{summary.accuracyRate}%</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              当前遮挡级别
            </Typography>
            <Typography variant="h4">Level {summary.currentLevel}</Typography>
          </CardContent>
        </Card>
      </Stack>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            常错词
          </Typography>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
          {summary.hotWords.map((word) => (
            <li key={`${word.word}-${word.kind}`}>
              {word.word}（{word.kind} x{word.count}）
            </li>
          ))}
          </ol>
        </CardContent>
      </Card>
    </Stack>
  );
};
