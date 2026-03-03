import { Box, Paper, Stack, Typography } from "@mui/material";
import type { CompareBlock, DiffKind } from "../../domain/practice/entities";

interface CompareBlockListProps {
  blocks: CompareBlock[];
}

const tokenStyleByKind: Partial<Record<DiffKind, object>> = {
  missing: {
    backgroundColor: "rgba(192, 54, 44, 0.14)",
    color: "#c0362c",
  },
  insert: {
    backgroundColor: "rgba(220, 138, 26, 0.2)",
    color: "#9a5f07",
  },
  substitute: {
    backgroundColor: "rgba(67, 115, 226, 0.16)",
    color: "#2952b3",
  },
};

export const CompareBlockList = ({ blocks }: CompareBlockListProps) => {
  return (
    <Stack spacing={1.25}>
      {blocks.map((block) => (
        <Paper key={block.id} variant="outlined" sx={{ p: 1.5, borderStyle: "dashed" }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "44px 1fr",
              gap: 1.25,
              alignItems: "flex-start",
              mb: 0.75,
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ pt: 0.5 }}>
              原文
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, fontSize: 20, lineHeight: 1.45 }}>
              {block.reference.map((token, idx) => (
                <Box
                  component="span"
                  key={`ref-${block.id}-${idx}`}
                  sx={{
                    px: 0.5,
                    borderRadius: 1,
                    ...(token.diff ? tokenStyleByKind[token.diff] : {}),
                  }}
                >
                  {token.text}
                </Box>
              ))}
            </Box>
          </Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "44px 1fr",
              gap: 1.25,
              alignItems: "flex-start",
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ pt: 0.5 }}>
              识别
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, fontSize: 20, lineHeight: 1.45 }}>
              {block.recognized.map((token, idx) => (
                <Box
                  component="span"
                  key={`rec-${block.id}-${idx}`}
                  sx={{
                    px: 0.5,
                    borderRadius: 1,
                    ...(token.diff ? tokenStyleByKind[token.diff] : {}),
                  }}
                >
                  {token.text}
                </Box>
              ))}
            </Box>
          </Box>
        </Paper>
      ))}
    </Stack>
  );
};
