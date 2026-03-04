import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type {
  ArticleCreateInput,
  ArticleCreateResult,
  ArticleLanguage,
  ArticleListItem,
  ArticleSourceType,
} from "../../domain/article/entities";

interface HomeScreenProps {
  articles: ArticleListItem[];
  creating: boolean;
  onCreateArticle: (input: ArticleCreateInput) => Promise<ArticleCreateResult>;
}

const languageOptions: ArticleLanguage[] = ["ja", "en", "zh"];
const sourceTypeOptions: ArticleSourceType[] = ["manual", "upload", "ocr"];

export const HomeScreen = ({ articles, creating, onCreateArticle }: HomeScreenProps) => {
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState<ArticleLanguage>("ja");
  const [sourceType, setSourceType] = useState<ArticleSourceType>("manual");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<ArticleCreateResult | null>(null);

  const fileAccept = useMemo(() => {
    if (sourceType === "upload") return ".txt,.md,text/plain,text/markdown";
    if (sourceType === "ocr") return ".png,.jpg,.jpeg,.webp,image/*";
    return undefined;
  }, [sourceType]);

  const onSubmit = async () => {
    setLocalError(null);
    setCreatedResult(null);

    if (!title.trim()) {
      setLocalError("Title is required.");
      return;
    }
    if (sourceType === "manual" && !text.trim()) {
      setLocalError("Text is required for manual source.");
      return;
    }
    if (sourceType !== "manual" && !file) {
      setLocalError("Please choose a file.");
      return;
    }

    try {
      const created = await onCreateArticle({
        title: title.trim(),
        language,
        sourceType,
        text: sourceType === "manual" ? text : undefined,
        file: sourceType === "manual" ? undefined : (file ?? undefined),
      });
      setCreatedResult(created);
      setText("");
      setFile(null);
    } catch {
      // Page-level errors are handled by the controller and shown in App.
    }
  };

  return (
    <Stack spacing={1.5}>
      <Card>
        <CardContent>
          <Typography variant="h6">Create Article</Typography>
          <Stack spacing={1.5} mt={1}>
            <TextField
              label="Title"
              size="small"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <TextField
              select
              label="Language"
              size="small"
              value={language}
              onChange={(event) => setLanguage(event.target.value as ArticleLanguage)}
            >
              {languageOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Source Type"
              size="small"
              value={sourceType}
              onChange={(event) => {
                setSourceType(event.target.value as ArticleSourceType);
                setFile(null);
              }}
            >
              {sourceTypeOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>

            {sourceType === "manual" ? (
              <TextField
                label="Text"
                multiline
                minRows={6}
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
            ) : (
              <Stack spacing={1}>
                <Button variant="outlined" component="label">
                  Choose File
                  <input
                    hidden
                    type="file"
                    accept={fileAccept}
                    onChange={(event) => {
                      const current = event.target.files?.[0] ?? null;
                      setFile(current);
                    }}
                  />
                </Button>
                <Typography variant="body2" color="text.secondary">
                  {file ? file.name : "No file selected."}
                </Typography>
              </Stack>
            )}

            {localError ? <Alert severity="warning">{localError}</Alert> : null}
            <Box display="flex" justifyContent="flex-start">
              <Button variant="contained" disabled={creating} onClick={onSubmit}>
                {creating ? "Creating..." : "Create and Segment"}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {createdResult ? (
        <Card>
          <CardContent>
            <Typography variant="subtitle1">Created</Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              {createdResult.title} ({createdResult.language}) - {createdResult.articleId}
            </Typography>
            <Stack spacing={1} mt={1.5}>
              {createdResult.segments.map((segment) => (
                <Box key={segment.id} display="flex" justifyContent="space-between" gap={1}>
                  <Typography variant="body2">
                    #{segment.order} {segment.preview}
                  </Typography>
                  <Chip label={segment.id} size="small" />
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent>
          <Typography variant="subtitle1">Recent Articles</Typography>
          <Stack spacing={1} mt={1}>
            {articles.length === 0 ? (
              <Typography color="text.secondary" variant="body2">
                No articles yet.
              </Typography>
            ) : (
              articles.map((article) => (
                <Box key={article.articleId} display="flex" justifyContent="space-between" gap={1}>
                  <Box>
                    <Typography variant="body2">{article.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {article.language} | {article.segmentCount} segments
                    </Typography>
                  </Box>
                  <Chip size="small" label={article.articleId} />
                </Box>
              ))
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
};
