import { Stack } from "@mui/material";
import type { HistoryDoc } from "../../domain/practice/entities";
import { HistoryDocItem } from "./HistoryDocItem";

interface HistoryDocListProps {
  docs: HistoryDoc[];
  onResume: (docId: string) => void;
}

export const HistoryDocList = ({ docs, onResume }: HistoryDocListProps) => {
  return (
    <Stack spacing={1.25} mt={1.25}>
      {docs.map((doc) => (
        <HistoryDocItem key={doc.id} doc={doc} onResume={onResume} />
      ))}
    </Stack>
  );
};
