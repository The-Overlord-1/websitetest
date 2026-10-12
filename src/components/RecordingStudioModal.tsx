import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Play, Pause, RotateCcw, Check, X, AlertCircle } from 'lucide-react';
import { DialogueLine, DubTake } from '../types/pack';
import { formatTimecode } from '../utils/iniParser';

interface RecordingStudioModalProps {
  line: DialogueLine;
  characterColor: string;
  isCountingDown: boolean;
  countdownValue: number;
  isRecording: boolean;
  audioLevel: number;
  recordedTake: DubTake | null;
  onCancel: () => void;
  onFinishRecording: () => void;
  onAcceptTake: (take: DubTake) => void;
  onRetake: () => void;
  recordingElapsed: number;
  lineDuration: number;
  errorMessage: string | null;
}

export const RecordingStudioModal: React.FC<RecordingStudioModalProps> = ({
  line,
  characterColor,
  isCountingDown,
  countdownValue,
  isRecording,
  audioLevel,
  recordedTake,
  onCancel,
  onFinishRecording,
  onAcceptTake,
  onRetake,
  recordingElapsed,
  lineDuration,
  errorMessage,
}) => {
  const [isPlayingReview, setIsPlayingReview] = useState(false);
  const reviewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (recordedTake) {
      const audio = new Audio(recordedTake.audioUrl);
      reviewAudioRef.current = audio;
      audio.onended = () => setIsPlayingReview(false);
      return () => {
        audio.pause();
        reviewAudioRef.current = null;
      };
    }
  }, [recordedTake]);

  const toggleReviewPlay = () => {
    if (!reviewAudioRef.current) return;
    if (isPlayingReview) {
      reviewAudioRef.current.pause();
      setIsPlayingReview(false);
    } else {
      reviewAudioRef.current.currentTime = 0;
      reviewAudioRef.current.play().then(() => setIsPlayingReview(true)).catch(() => {});
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl flex flex-col space-y-5">
        {/* Top Status */}
        <div className="flex items-center justify-between text-xs pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: characterColor }}
            />
            <span className="font-bold text-white font-mono uppercase tracking-wider">
              {line.character}
            </span>
            <span className="text-neutral-500">·</span>
            <span className="text-neutral-400 font-mono tabular-nums">
              Line {line.lineNumber} ({lineDuration.toFixed(1)}s)
            </span>
          </div>

          <button
            onClick={onCancel}
            className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Banner if mic denied */}
        {errorMessage && (
          <div className="p-3.5 bg-red-950/40 border border-red-500/40 rounded-xl text-xs text-red-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-red-300 block">Microphone Access Notice</span>
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Teleprompter Dialogue Card */}
        <div className="p-5 bg-neutral-950 rounded-xl border border-neutral-800 text-center flex flex-col items-center justify-center min-h-[120px]">
          <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono mb-2">
            Dialogue Script
          </span>
          <p className="text-lg sm:text-xl font-bold text-white leading-relaxed font-[Outfit] text-balance">
            "{line.text}"
          </p>
        </div>

        {/* Studio State Machine Display */}

        {/* State A: Countdown */}
        {isCountingDown && (
          <div className="text-center py-6 space-y-2">
            <span className="text-xs uppercase tracking-widest text-amber-400 font-mono font-bold block">
              Stand By For Cue
            </span>
            <div className="text-6xl font-extrabold text-white font-mono animate-bounce tabular-nums">
              {countdownValue}
            </div>
            <p className="text-xs text-neutral-400">Syncing video to line cue in 3 seconds...</p>
          </div>
        )}

        {/* State B: Live Recording */}
        {isRecording && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-red-400 font-bold font-mono">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <span>ON AIR · RECORDING</span>
              </div>
              <div className="font-mono text-neutral-300 tabular-nums">
                {recordingElapsed.toFixed(1)}s / {lineDuration.toFixed(1)}s
              </div>
            </div>

            {/* Time progress bar */}
            <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 transition-all"
                style={{
                  width: `${Math.min(100, (recordingElapsed / Math.max(1, lineDuration)) * 100)}%`,
                }}
              />
            </div>

            {/* Live Audio Level VU Meter */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                <span>Mic Input Level</span>
                <span className="tabular-nums">{audioLevel}%</span>
              </div>
              <div className="w-full h-3 bg-neutral-950 rounded-lg p-0.5 border border-neutral-800 flex items-center">
                <div
                  className="h-full rounded transition-all duration-75 bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500"
                  style={{ width: `${Math.max(4, audioLevel)}%` }}
                />
              </div>
            </div>

            {/* Finish Take Button */}
            <div className="pt-3 text-center">
              <button
                onClick={onFinishRecording}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-lg shadow-red-950"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Stop Recording</span>
              </button>
            </div>
          </div>
        )}

        {/* State C: Review Recorded Take */}
        {recordedTake && !isRecording && !isCountingDown && (
          <div className="space-y-4 py-2">
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Take {recordedTake.takeNumber} captured ({recordedTake.duration.toFixed(1)}s)</span>
              </div>
              <button
                onClick={toggleReviewPlay}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 rounded-lg font-medium transition-colors"
              >
                {isPlayingReview ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isPlayingReview ? 'Pause' : 'Play Back'}</span>
              </button>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={onRetake}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retake</span>
              </button>

              <button
                onClick={() => onAcceptTake(recordedTake)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Take</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
