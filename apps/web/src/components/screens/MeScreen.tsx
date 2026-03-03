import { Button, Card, CardContent, Stack, Typography } from "@mui/material";
import type { MeSummary } from "../../domain/practice/entities";
import { HistoryDocList } from "../history/HistoryDocList";

interface MeScreenProps {
  summary: MeSummary | null;
  onResumeDoc: (docId: string) => void;
  onLogout: () => void;
}

export const MeScreen = ({ summary, onResumeDoc, onLogout }: MeScreenProps) => {
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
    <Card>
      <CardContent>
        <Typography variant="h6">我的</Typography>
        <Stack spacing={0.75} mt={1} color="text.secondary">
          <Typography variant="body2">账号：{summary.email}</Typography>
          <Typography variant="body2">连续练习：{summary.streakDays} 天</Typography>
        </Stack>
        <Button type="button" variant="outlined" size="small" sx={{ mt: 1.25 }} onClick={onLogout}>
          退出登录
        </Button>
        <Typography variant="h6" mt={2.25}>
          历史文档
        </Typography>
        <HistoryDocList docs={summary.historyDocs} onResume={onResumeDoc} />
      </CardContent>
    </Card>
  );
};
