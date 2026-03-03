import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import type { PracticeBundle, PracticeResultData } from "../../domain/practice/entities";
import { MaskLevelControl } from "../practice/MaskLevelControl";
import { PracticePreRecordView } from "../practice/PracticePreRecordView";
import { PracticeResultView } from "../practice/PracticeResultView";
import { RecordingDocumentFullscreen } from "../practice/RecordingDocumentFullscreen";

const levelRatioMap: Record<number, number> = {
  0: 0,
  1: 0.2,
  2: 0.4,
  3: 0.7,
  4: 0.9,
};

interface PracticeScreenProps {
  bundle: PracticeBundle | null;
  selectedSegmentId?: string;
  onSelectSegment: (segmentId: string) => void;
  onSubmitRecognition: () => Promise<PracticeResultData>;
}

export const PracticeScreen = ({
  bundle,
  selectedSegmentId,
  onSelectSegment,
  onSubmitRecognition,
}: PracticeScreenProps) => {
  const [hasRecording, setHasRecording] = useState(false);
  const [isRecordingFullscreenOpen, setIsRecordingFullscreenOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultData, setResultData] = useState<PracticeResultData | null>(null);
  const [maskLevel, setMaskLevel] = useState(2);

  useEffect(() => {
    setHasRecording(false);
    setIsRecordingFullscreenOpen(false);
    setIsSubmitting(false);
    setResultData(null);
    if (bundle) {
      setMaskLevel(bundle.preRecord.level);
    }
  }, [bundle]);

  const handleSubmitRecognition = async () => {
    setIsSubmitting(true);
    try {
      const result = await onSubmitRecognition();
      setResultData(result);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartRecording = () => {
    setHasRecording(false);
    setIsRecordingFullscreenOpen(true);
  };

  const handleCancelRecording = () => {
    setIsRecordingFullscreenOpen(false);
  };

  const handleCompleteRecording = () => {
    setIsRecordingFullscreenOpen(false);
    setHasRecording(true);
  };

  const adjustedPreRecord = useMemo(() => {
    if (!bundle) {
      return {
        level: maskLevel,
        maskRatio: 0,
        tokens: [],
      };
    }

    const ratio = levelRatioMap[maskLevel] ?? 0.4;
    const baseTokens = bundle.preRecord.tokens;
    const isMaskable = (text: string) => /[\p{L}\p{N}]/u.test(text);

    const maskableIndices = baseTokens
      .map((token, index) => (isMaskable(token.text) ? index : -1))
      .filter((index) => index >= 0);

    const targetHiddenCount = Math.round(maskableIndices.length * ratio);

    const preferredIndices = baseTokens
      .map((token, index) => (token.hidden && isMaskable(token.text) ? index : -1))
      .filter((index) => index >= 0);

    const hiddenSet = new Set<number>();
    preferredIndices.forEach((index) => {
      if (hiddenSet.size < targetHiddenCount) hiddenSet.add(index);
    });

    const remainingMaskable = maskableIndices.filter((index) => !hiddenSet.has(index));
    remainingMaskable
      .sort((a, b) => baseTokens[b].text.length - baseTokens[a].text.length)
      .forEach((index) => {
        if (hiddenSet.size < targetHiddenCount) hiddenSet.add(index);
      });

    return {
      level: maskLevel,
      maskRatio: ratio,
      tokens: baseTokens.map((token, index) => ({
        ...token,
        hidden: hiddenSet.has(index),
      })),
    };
  }, [bundle, maskLevel]);

  if (!bundle) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6">段落练习</Typography>
          <Typography color="text.secondary">加载中...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="h6">{bundle.title}</Typography>
            <FormControl size="small">
              <InputLabel id="segment-select-label">练习段落</InputLabel>
              <Select
                labelId="segment-select-label"
                label="练习段落"
                value={selectedSegmentId ?? bundle.segmentId}
                onChange={(event) => onSelectSegment(event.target.value)}
              >
                {bundle.segments.map((segment) => (
                  <MenuItem key={segment.id} value={segment.id}>
                    {segment.label}（{segment.progressRate}%）
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <MaskLevelControl level={maskLevel} maskRatio={adjustedPreRecord.maskRatio} onLevelChange={setMaskLevel} />
          </Stack>

          {resultData ? (
            <PracticeResultView data={resultData} />
          ) : (
            <PracticePreRecordView
              data={adjustedPreRecord}
              hasRecording={hasRecording}
              isSubmitting={isSubmitting}
              onStartRecording={handleStartRecording}
              onSubmitRecognition={handleSubmitRecognition}
            />
          )}
        </CardContent>
      </Card>

      <RecordingDocumentFullscreen
        open={isRecordingFullscreenOpen}
        tokens={adjustedPreRecord.tokens}
        onCancel={handleCancelRecording}
        onComplete={handleCompleteRecording}
      />
    </>
  );
};
