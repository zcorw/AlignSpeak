import { useState } from "react";

export const useAppUIState = () => {
  const [selectedDocId, setSelectedDocId] = useState<string | undefined>(undefined);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | undefined>(undefined);

  const resumeFromHistory = (docId: string) => {
    setSelectedDocId(docId);
    setSelectedSegmentId(undefined);
  };

  return {
    selectedDocId,
    selectedSegmentId,
    setSelectedSegmentId,
    resumeFromHistory,
  };
};
