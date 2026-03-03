import { Box, Stack, Typography } from "@mui/material";

const items = [
  { label: "正确", color: "#1c9c4e" },
  { label: "漏读", color: "#c0362c" },
  { label: "多读", color: "#dc8a1a" },
  { label: "替换", color: "#3f63c8" },
] as const;

export const ErrorLegend = () => {
  return (
    <Stack direction="row" flexWrap="wrap" spacing={1.5}>
      {items.map((item) => (
        <Stack key={item.label} direction="row" spacing={0.75} alignItems="center">
          <Box sx={{ width: 9, height: 9, borderRadius: "50%", backgroundColor: item.color }} />
          <Typography variant="caption" color="text.secondary">
            {item.label}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
};
