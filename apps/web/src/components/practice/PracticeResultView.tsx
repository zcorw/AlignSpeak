import { Stack } from "@mui/material";
import type { PracticeResultData } from "../../domain/practice/entities";
import { CompareBlockList } from "./CompareBlockList";
import { ErrorLegend } from "./ErrorLegend";
import { PracticeActionBar } from "./PracticeActionBar";

interface PracticeResultViewProps {
  data: PracticeResultData;
}

export const PracticeResultView = ({ data }: PracticeResultViewProps) => {
  return (
    <Stack spacing={1.5} mt={1.25}>
      <CompareBlockList blocks={data.blocks} />
      <ErrorLegend />
      <PracticeActionBar />
    </Stack>
  );
};
