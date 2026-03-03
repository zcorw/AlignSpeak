import { Chip, Slider, Stack, Typography } from "@mui/material";

interface MaskLevelControlProps {
  level: number;
  maskRatio: number;
  onLevelChange: (level: number) => void;
}

export const MaskLevelControl = ({ level, maskRatio, onLevelChange }: MaskLevelControlProps) => {
  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Chip label={`Level ${level}`} size="small" />
        <Typography variant="body2" color="text.secondary">
          遮挡 {Math.round(maskRatio * 100)}%
        </Typography>
      </Stack>
      <Slider
        value={level}
        min={0}
        max={4}
        step={1}
        marks
        onChange={(_event, value) => onLevelChange(value as number)}
        valueLabelDisplay="auto"
        sx={{ mb: 1 }}
      />
    </>
  );
};
