import React, { useState } from 'react';
import {
  Mic,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Volume2,
  Trash2,
  FastForward,
  User,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';
import { DialogueLine, DubTake, ParsedScenePack, SceneCharacter } from '../types/pack';
import { formatTimecode } from '../utils/iniParser';

interface TimelineViewProps {
  pack: ParsedScenePack;
  lines: DialogueLine[];
  activeLineId: string | null;
  onSelectLine: (line: DialogueLine) => void;
  onSeekToLine: (line: DialogueLine) => void;
  lineTakes: Map<string, DubTake[]>;
  activeTakeMap: Map<string, DubTake>;
  onStartRecordLine: (line: DialogueLine) => void;
  onPlayTake: (take: DubTake) => void;
  onDeleteTake: (lineId: string, takeId: string) => void;
  onSelectActiveTake: (lineId: string, take: DubTake) => void;
  onPlayOriginalAudio: (audioUrl: string) => void;
  playingAudioUrl: string | null;
  isRecording: boolean;
  recordingLineId: string | null;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  pack,
  lines,
  activeLineId,
  onSelectLine,
  onSeekToLine,
  lineTakes,
  activeTakeMap,
  onStartRecordLine,
  onPlayTake,
  onDeleteTake,
  onSelectActiveTake,
  onPlayOriginalAudio,
  playingAudioUrl,
  isRecording,
  recordingLineId,
}) => {
  const [selectedCharacterFilter, setSelectedCharacterFilter] = useState<string>('all');

  const filteredLines = lines.filter((line) => {
    if (selectedCharacterFilter === 'all') return true;
    return line.character.toLowerCase() === selectedCharacterFilter.toLowerCase();
  });

  // Calculate dubbed progress
  const totalLines = lines.length;
  const dubbedCount = Array.from(activeTakeMap.keys()).length;
  const percentComplete = totalLines > 0 ? Math.round((dubbedCount / totalLines) * 100) : 0;

  const getCharacter = (name: string): SceneCharacter | undefined => {
    return pack.characters.find((c) => c.name.toLowerCase() === name.toLowerCase());
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950/80 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Top Bar: Progress and Character Filters */}
      <div className="p-4 border-b border-neutral-800/80 bg-neutral-900/60 space-y-3">
        {/* Progress Metric */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white uppercase tracking-wider font-mono">Dubbing Progress</span>
            <span className="text-neutral-500">·</span>
            <span className="text-amber-400 font-mono font-medium">
              {dubbedCount} of {totalLines} lines completed ({percentComplete}%)
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300"
            style={{ width: `${percentComplete}%` }}
          />
        </div>

        {/* Character Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1">
          <span className="text-[11px] text-neutral-400 font-medium mr-1 uppercase tracking-wider">Cast:</span>
          <button
            onClick={() => setSelectedCharacterFilter('all')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              selectedCharacterFilter === 'all'
                ? 'bg-white text-neutral-950 shadow-sm'
                : 'bg-neutral-900 text-neutral-400 hover:text-white'
            }`}
          >
            All Cast ({lines.length})
          </button>

          {pack.characters.map((char) => {
            const charLineCount = lines.filter((l) => l.character.toLowerCase() === char.name.toLowerCase()).length;
            const isSelected = selectedCharacterFilter.toLowerCase() === char.name.toLowerCase();

            return (
              <button
                key={char.id}
                onClick={() => setSelectedCharacterFilter(char.name)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-white text-neutral-950 shadow-sm'
                    : 'bg-neutral-900 text-neutral-400 hover:text-white'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: char.color }}
                />
                <span>{char.name}</span>
                <span className="text-[10px] opacity-70">({charLineCount})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dialogue Line Cards List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredLines.length === 0 ? (
          <div className="text-center py-12 text-neutral-500 text-xs">
            No dialogue lines match the current character filter.
          </div>
        ) : (
          filteredLines.map((line) => {
            const isActive = activeLineId === line.id;
            const char = getCharacter(line.character);
            const takes = lineTakes.get(line.id) || [];
            const activeTake = activeTakeMap.get(line.id);
            const isCurrentlyRecording = isRecording && recordingLineId === line.id;
            const duration = (line.endTime - line.startTime).toFixed(1);

            return (
              <div
                key={line.id}
                onClick={() => onSelectLine(line)}
                className={`p-4 rounded-xl border transition-all text-xs cursor-pointer ${
                  isActive
                    ? 'bg-neutral-900/90 border-amber-500/50 shadow-md ring-1 ring-amber-500/20'
                    : 'bg-neutral-900/40 border-neutral-800/80 hover:bg-neutral-900/70 hover:border-neutral-700'
                }`}
              >
                {/* Line Header */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {/* Character Avatar or Initial */}
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-neutral-950 shrink-0"
                      style={{ backgroundColor: char?.color || '#f59e0b' }}
                    >
                      {char?.name.slice(0, 2).toUpperCase() || 'AC'}
                    </div>

                    <span className="font-semibold text-white">{line.character}</span>

                    <span className="text-[10px] font-mono text-neutral-400 tabular-nums">
                      {formatTimecode(line.startTime)} – {formatTimecode(line.endTime)} ({duration}s)
                    </span>
                  </div>

                  {/* Status Indicator */}
                  <div>
                    {activeTake ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Dubbed (Take {activeTake.takeNumber})</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-neutral-500">Original Vocal</span>
                    )}
                  </div>
                </div>

                {/* Caption / Dialogue Text */}
                <div className="my-2.5 pl-2 border-l-2 border-neutral-700/60">
                  <p className="text-sm font-medium text-neutral-100 leading-snug">
                    "{line.text}"
                  </p>
                </div>

                {/* Actions & Take Management Strip */}
                <div className="mt-3 pt-2.5 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-2">
                  {/* Left Controls: Seek & Audition */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSeekToLine(line);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors text-[11px]"
                      title="Jump video to line start"
                    >
                      <FastForward className="w-3 h-3" />
                      <span>Jump</span>
                    </button>

                    {line.originalAudioUrl && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayOriginalAudio(line.originalAudioUrl!);
                        }}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] transition-colors ${
                          playingAudioUrl === line.originalAudioUrl
                            ? 'bg-amber-500 text-neutral-950 font-semibold'
                            : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white'
                        }`}
                        title="Audition original voice actor performance"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>Audition</span>
                      </button>
                    )}
                  </div>

                  {/* Right Controls: Record Take & Play Dub */}
                  <div className="flex items-center gap-2">
                    {/* Take Selector if multiple takes exist */}
                    {takes.length > 1 && (
                      <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={activeTake?.id || ''}
                          onChange={(e) => {
                            const found = takes.find((t) => t.id === e.target.value);
                            if (found) onSelectActiveTake(line.id, found);
                          }}
                          className="bg-neutral-800 border border-neutral-700 text-neutral-200 text-[11px] rounded px-2 py-1 appearance-none pr-5 font-mono cursor-pointer"
                        >
                          {takes.map((t) => (
                            <option key={t.id} value={t.id}>
                              Take {t.takeNumber}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3 h-3 text-neutral-400 absolute right-1.5 top-2 pointer-events-none" />
                      </div>
                    )}

                    {/* Play Active Take */}
                    {activeTake && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayTake(activeTake);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors text-[11px] font-medium"
                        title="Listen to your dubbed take"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Play Take</span>
                      </button>
                    )}

                    {/* Record / Retake Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartRecordLine(line);
                      }}
                      disabled={isRecording}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded text-[11px] font-semibold transition-all ${
                        isCurrentlyRecording
                          ? 'bg-red-600 text-white animate-pulse'
                          : activeTake
                          ? 'bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-amber-500/30'
                          : 'bg-amber-400 hover:bg-amber-300 text-neutral-950 shadow-sm'
                      }`}
                    >
                      <Mic className="w-3 h-3" />
                      <span>{activeTake ? 'Retake' : 'Record'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
