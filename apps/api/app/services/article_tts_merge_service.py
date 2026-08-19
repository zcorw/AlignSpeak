import json
import os
import subprocess
import tempfile
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path

from app.application.usecases.article_tts_preparation import PreparedArticleTtsSegment

DEFAULT_SEGMENT_PAUSE_MS = 750
DEFAULT_LOOP_PAUSE_MS = 1500
TARGET_SAMPLE_RATE = 24_000
TARGET_CHANNELS = 1
TARGET_BITRATE = "48k"


@dataclass(frozen=True)
class AudioProbe:
    duration_ms: int
    file_size: int
    codec_name: str
    sample_rate: int
    channels: int
    bit_rate: int


@dataclass(frozen=True)
class ArticleTtsSegmentSpan:
    segment_id: str
    segment_tts_asset_id: str
    segment_order: int
    segment_text_hash: str
    global_start_ms: int
    global_end_ms: int


@dataclass(frozen=True)
class ArticleTtsMergeResult:
    output_path: Path
    probe: AudioProbe
    timeline: tuple[dict[str, int | float | str], ...]
    segment_spans: tuple[ArticleTtsSegmentSpan, ...]


class ArticleTtsMergeError(Exception):
    pass


def probe_audio_file(
    path: Path,
    *,
    ffprobe_binary: str = "ffprobe",
    run: Callable[..., subprocess.CompletedProcess] = subprocess.run,
    timeout_seconds: float = 30.0,
) -> AudioProbe:
    command = [
        ffprobe_binary,
        "-v",
        "error",
        "-select_streams",
        "a:0",
        "-show_entries",
        "stream=codec_name,sample_rate,channels,duration,bit_rate:format=duration,size,bit_rate",
        "-of",
        "json",
        str(path),
    ]
    try:
        completed = run(
            command,
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ArticleTtsMergeError("ffprobe could not inspect the audio file.") from exc
    if completed.returncode != 0:
        raise ArticleTtsMergeError("ffprobe rejected the audio file.")
    try:
        payload = json.loads(completed.stdout)
        streams = payload.get("streams") or []
        stream = streams[0]
        format_payload = payload.get("format") or {}
        duration_seconds = float(format_payload.get("duration") or stream.get("duration"))
        file_size = int(format_payload.get("size") or path.stat().st_size)
        sample_rate = int(stream.get("sample_rate"))
        channels = int(stream.get("channels"))
        codec_name = str(stream.get("codec_name") or "")
        bit_rate = int(stream.get("bit_rate") or format_payload.get("bit_rate"))
    except (IndexError, KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise ArticleTtsMergeError("ffprobe returned invalid audio metadata.") from exc
    duration_ms = round(duration_seconds * 1000)
    if duration_ms <= 0 or file_size <= 0 or sample_rate <= 0 or channels <= 0 or bit_rate <= 0:
        raise ArticleTtsMergeError("ffprobe returned non-positive audio metadata.")
    return AudioProbe(
        duration_ms=duration_ms,
        file_size=file_size,
        codec_name=codec_name,
        sample_rate=sample_rate,
        channels=channels,
        bit_rate=bit_rate,
    )


def _build_filter_complex(*, segment_count: int, segment_pause_ms: int, loop_pause_ms: int) -> str:
    filters: list[str] = []
    concat_inputs: list[str] = []
    for index in range(segment_count):
        segment_label = f"segment_{index}"
        filters.append(
            f"[{index}:a]aresample={TARGET_SAMPLE_RATE},"
            f"aformat=sample_fmts=fltp:sample_rates={TARGET_SAMPLE_RATE}:channel_layouts=mono,"
            f"asetpts=PTS-STARTPTS[{segment_label}]"
        )
        concat_inputs.append(f"[{segment_label}]")
        if index < segment_count - 1:
            pause_label = f"pause_{index}"
            pause_seconds = segment_pause_ms / 1000.0
            filters.append(
                f"anullsrc=r={TARGET_SAMPLE_RATE}:cl=mono:d={pause_seconds:.3f},"
                f"atrim=duration={pause_seconds:.3f},asetpts=PTS-STARTPTS[{pause_label}]"
            )
            concat_inputs.append(f"[{pause_label}]")

    loop_seconds = loop_pause_ms / 1000.0
    filters.append(
        f"anullsrc=r={TARGET_SAMPLE_RATE}:cl=mono:d={loop_seconds:.3f},"
        f"atrim=duration={loop_seconds:.3f},asetpts=PTS-STARTPTS[loop_pause]"
    )
    concat_inputs.append("[loop_pause]")
    filters.append(f"{''.join(concat_inputs)}concat=n={len(concat_inputs)}:v=0:a=1[outa]")
    return ";".join(filters)


def _build_global_metadata(
    *,
    prepared_segments: Sequence[PreparedArticleTtsSegment],
    input_probes: Sequence[AudioProbe],
    segment_pause_ms: int,
    output_duration_ms: int,
) -> tuple[tuple[ArticleTtsSegmentSpan, ...], tuple[dict[str, int | float | str], ...]]:
    spans: list[ArticleTtsSegmentSpan] = []
    timeline: list[dict[str, int | float | str]] = []
    cursor_ms = 0

    for index, (prepared, probe) in enumerate(zip(prepared_segments, input_probes, strict=True)):
        content_start_ms = cursor_ms
        content_end_ms = content_start_ms + probe.duration_ms
        spans.append(
            ArticleTtsSegmentSpan(
                segment_id=prepared.segment.segment_id,
                segment_tts_asset_id=prepared.asset.id,
                segment_order=prepared.segment.segment_order,
                segment_text_hash=prepared.segment.text_hash,
                global_start_ms=content_start_ms,
                global_end_ms=content_end_ms,
            )
        )
        for sentence in prepared.timeline:
            local_start_ms = min(max(float(sentence["start_ms"]), 0.0), float(probe.duration_ms))
            local_end_ms = min(
                max(float(sentence["end_ms"]), local_start_ms),
                float(probe.duration_ms),
            )
            timeline.append(
                {
                    "segment_id": prepared.segment.segment_id,
                    "segment_order": prepared.segment.segment_order,
                    "sentence_index": int(sentence["sentence_index"]),
                    "text": str(sentence["text"]),
                    "start_ms": round(content_start_ms + local_start_ms, 3),
                    "end_ms": round(content_start_ms + local_end_ms, 3),
                }
            )
        cursor_ms = content_end_ms
        if index < len(prepared_segments) - 1:
            cursor_ms += segment_pause_ms

    previous_end_ms = 0.0
    for sentence in timeline:
        start_ms = float(sentence["start_ms"])
        end_ms = float(sentence["end_ms"])
        if start_ms < previous_end_ms or end_ms < start_ms or end_ms > output_duration_ms:
            raise ArticleTtsMergeError("The global sentence timeline is not monotonic or exceeds the output.")
        previous_end_ms = end_ms
    if spans and spans[-1].global_end_ms > output_duration_ms:
        raise ArticleTtsMergeError("The merged output is shorter than its source content.")
    return tuple(spans), tuple(timeline)


def merge_article_tts_audio(
    *,
    prepared_segments: Sequence[PreparedArticleTtsSegment],
    output_path: Path,
    segment_pause_ms: int = DEFAULT_SEGMENT_PAUSE_MS,
    loop_pause_ms: int = DEFAULT_LOOP_PAUSE_MS,
    ffmpeg_binary: str = "ffmpeg",
    ffprobe_binary: str = "ffprobe",
    run: Callable[..., subprocess.CompletedProcess] = subprocess.run,
    timeout_seconds: float = 300.0,
) -> ArticleTtsMergeResult:
    if not prepared_segments:
        raise ArticleTtsMergeError("At least one prepared segment is required.")
    if segment_pause_ms < 0 or loop_pause_ms < 0:
        raise ArticleTtsMergeError("Audio pauses must be non-negative.")

    input_probes = [
        probe_audio_file(
            prepared.media_path,
            ffprobe_binary=ffprobe_binary,
            run=run,
            timeout_seconds=min(timeout_seconds, 30.0),
        )
        for prepared in prepared_segments
    ]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    filter_complex = _build_filter_complex(
        segment_count=len(prepared_segments),
        segment_pause_ms=segment_pause_ms,
        loop_pause_ms=loop_pause_ms,
    )
    with tempfile.TemporaryDirectory(prefix=".article-tts-merge-", dir=output_path.parent) as temp_dir:
        temp_output = Path(temp_dir) / "merged.mp3"
        command = [ffmpeg_binary, "-hide_banner", "-loglevel", "error", "-y"]
        for prepared in prepared_segments:
            command.extend(["-i", str(prepared.media_path)])
        command.extend(
            [
                "-filter_complex",
                filter_complex,
                "-map",
                "[outa]",
                "-codec:a",
                "libmp3lame",
                "-ar",
                str(TARGET_SAMPLE_RATE),
                "-ac",
                str(TARGET_CHANNELS),
                "-b:a",
                TARGET_BITRATE,
                str(temp_output),
            ]
        )
        try:
            completed = run(
                command,
                check=False,
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise ArticleTtsMergeError("ffmpeg could not merge the article audio.") from exc
        if completed.returncode != 0:
            raise ArticleTtsMergeError("ffmpeg failed to merge the article audio.")

        output_probe = probe_audio_file(
            temp_output,
            ffprobe_binary=ffprobe_binary,
            run=run,
            timeout_seconds=min(timeout_seconds, 30.0),
        )
        if (
            output_probe.sample_rate != TARGET_SAMPLE_RATE
            or output_probe.channels != TARGET_CHANNELS
            or output_probe.codec_name != "mp3"
            or abs(output_probe.bit_rate - 48_000) > 5_000
        ):
            raise ArticleTtsMergeError("The merged article audio does not match the encoder profile.")
        expected_duration_ms = (
            sum(probe.duration_ms for probe in input_probes)
            + segment_pause_ms * max(len(prepared_segments) - 1, 0)
            + loop_pause_ms
        )
        if abs(output_probe.duration_ms - expected_duration_ms) > 250:
            raise ArticleTtsMergeError("The merged article audio duration is outside the allowed tolerance.")

        spans, timeline = _build_global_metadata(
            prepared_segments=prepared_segments,
            input_probes=input_probes,
            segment_pause_ms=segment_pause_ms,
            output_duration_ms=output_probe.duration_ms,
        )
        os.replace(temp_output, output_path)

    return ArticleTtsMergeResult(
        output_path=output_path,
        probe=output_probe,
        timeline=timeline,
        segment_spans=spans,
    )
