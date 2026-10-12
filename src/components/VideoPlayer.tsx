import React, { useRef, useEffect, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Repeat,
  AlertCircle,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { DialogueLine, DubTake, ParsedScenePack } from '../types/pack';
import { formatTimecode } from '../utils/iniParser';

interface VideoPlayerProps {
  pack: ParsedScenePack;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  activeLine: DialogueLine | null;
  activeTake: DubTake | null;
  loopActiveLine: boolean;
  setLoopActiveLine: (loop: boolean) => void;
  lines: DialogueLine[];
  onSelectLine: (line: DialogueLine) => void;
  isRecording: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  pack,
  videoRef,
  currentTime,
  duration,
  isPlaying,
  onPlayPause,
  onSeek,
  activeLine,
  activeTake,
  loopActiveLine,
  setLoopActiveLine,
  lines,
  onSelectLine,
  isRecording,
}) => {
  const [videoError, setVideoError] = useState<string | null>(null);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Reset error when pack or video URL changes
  useEffect(() => {
    setVideoError(null);
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [pack.videoBlobUrl, pack.videoFileName, videoRef]);

  // Keyboard shortcut: Space to play/pause when not in text input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        e.preventDefault();
        if (!isRecording) {
          onPlayPause();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPlayPause, isRecording]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      setIsMuted(newVol === 0);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      videoRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(fraction * duration);
  };

  const getCharacterColor = (characterName: string) => {
    const char = pack.characters.find((c) => c.name.toLowerCase() === characterName.toLowerCase());
    return char?.color || '#f59e0b';
  };

  return (
    <div className="relative flex flex-col bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Video Viewport Area (16:9) */}
      <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden select-none group">
        {pack.videoBlobUrl ? (
          <video
            ref={videoRef}
            src={pack.videoBlobUrl}
            playsInline
            preload="auto"
            className="w-full h-full object-contain pointer-events-none"
            onLoadedMetadata={() => setVideoError(null)}
            onCanPlay={() => setVideoError(null)}
            onError={(e) => {
              const isOgv = pack.videoFileName?.toLowerCase().endsWith('.ogv');
              if (isOgv) {
                setVideoError(
                  `Video "${pack.videoFileName}" is encoded in legacy Ogg Theora (.ogv). Modern desktop browsers (Chrome, Edge, Safari) do not have built-in Ogg Theora decoders. All dialogue lines, timestamps, and audio playback remain fully functional. Convert to MP4 (H.264) or WebM to see video in-browser.`
                );
              } else {
                setVideoError(
                  `Unable to decode video "${pack.videoFileName || 'scene video'}". The browser video engine could not play this format.`
                );
              }
            }}
          />
        ) : (
          <div className="text-center p-6 text-neutral-400">
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-white">No Video File in Pack</p>
            <p className="text-xs text-neutral-400 mt-1">This pack contains dialogue lines and audio, but no video file.</p>
          </div>
        )}

        {/* Video Decoding Error Fallback Screen */}
        {videoError && (
          <div className="absolute inset-0 bg-neutral-950/95 flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white font-[Outfit]">Video Codec Notice</h4>
            <p className="text-xs text-neutral-300 max-w-md mt-2 leading-relaxed">{videoError}</p>
            <div className="mt-4 px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-md text-[11px] text-neutral-400">
              Dialogue timeline lines and microphone recording booth remain fully operational.
            </div>
          </div>
        )}

        {/* Recording Visual Scrim & Indicator */}
        {isRecording && (
          <div className="absolute inset-0 border-4 border-red-500/80 pointer-events-none z-10 animate-pulse bg-red-950/10 flex items-start justify-between p-4">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-red-600 text-white rounded font-mono text-xs font-bold uppercase tracking-wider">
              <span>● REC ON AIR</span>
            </div>
          </div>
        )}

        {/* Cinematic Subtitle Overlay Bar */}
        {activeLine && (
          <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-col items-center text-center pointer-events-none transition-all">
            <div className="bg-black/85 backdrop-blur-md border border-white/10 px-5 py-2.5 rounded-xl max-w-xl shadow-2xl">
              <div className="flex items-center justify-center gap-2 mb-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getCharacterColor(activeLine.character) }}
                />
                <span className="text-[11px] font-bold tracking-wide uppercase text-neutral-300 font-mono">
                  {activeLine.character}
                </span>
                {activeTake && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                    Dubbed (Take {activeTake.takeNumber})
                  </span>
                )}
              </div>
              <p className="text-sm sm:text-base font-semibold text-white drop-shadow leading-snug">
                "{activeLine.text}"
              </p>
            </div>
          </div>
        )}

        {/* Click-to-Play Overlay */}
        <div
          onClick={onPlayPause}
          className="absolute inset-0 cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20"
        >
          <div className="w-14 h-14 rounded-full bg-neutral-900/80 backdrop-blur-sm border border-neutral-700/80 flex items-center justify-center text-white shadow-xl hover:scale-105 transition-transform">
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1 fill-current" />}
          </div>
        </div>
      </div>

      {/* Transport & Timeline Scrubber Bar */}
      <div className="p-4 bg-neutral-950/90 border-t border-neutral-800 space-y-3">
        {/* Progress Bar with dialogue line flags */}
        <div
          ref={progressBarRef}
          onClick={handleProgressClick}
          className="relative w-full h-3 bg-neutral-900 hover:h-4 transition-all rounded-full cursor-pointer group"
        >
          {/* Active progress */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-amber-400 rounded-full"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />

          {/* Dialogue line tick markers */}
          {duration > 0 &&
            lines.map((line) => {
              const leftPercent = (line.startTime / duration) * 100;
              const widthPercent = ((line.endTime - line.startTime) / duration) * 100;
              const isCurrent = activeLine?.id === line.id;

              return (
                <div
                  key={line.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeek(line.startTime);
                    onSelectLine(line);
                  }}
                  title={`${line.character}: ${line.text}`}
                  className={`absolute top-0 bottom-0 rounded-sm cursor-pointer transition-colors ${
                    isCurrent ? 'bg-amber-500/60 ring-1 ring-amber-300' : 'bg-neutral-600/40 hover:bg-neutral-400/60'
                  }`}
                  style={{
                    left: `${leftPercent}%`,
                    width: `${Math.max(1, widthPercent)}%`,
                  }}
                />
              );
            })}
        </div>

        {/* Control Buttons & Sliders */}
        <div className="flex items-center justify-between gap-4 text-xs">
          {/* Left: Playback controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={onPlayPause}
              disabled={isRecording}
              className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white transition-colors disabled:opacity-50"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            </button>

            <button
              onClick={() => onSeek(Math.max(0, currentTime - 2))}
              disabled={isRecording}
              className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
              title="Seek back 2s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Loop Active Line Button */}
            <button
              onClick={() => setLoopActiveLine(!loopActiveLine)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors ${
                loopActiveLine
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
              }`}
              title="Loop active line for practice"
            >
              <Repeat className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium hidden sm:inline">Loop Line</span>
            </button>

            {/* Timecode display */}
            <div className="font-mono text-neutral-300 tabular-nums ml-2">
              <span className="text-white font-semibold">{formatTimecode(currentTime)}</span>
              <span className="text-neutral-500"> / </span>
              <span className="text-neutral-400">{formatTimecode(duration)}</span>
            </div>
          </div>

          {/* Right: Audio Volume Slider */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="p-1.5 text-neutral-400 hover:text-white transition-colors"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 sm:w-24 accent-amber-400 h-1 bg-neutral-800 rounded-lg cursor-pointer"
              title="Master Video Volume"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
