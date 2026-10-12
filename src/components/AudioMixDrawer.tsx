import React from 'react';
import { Sliders, Volume2, Mic, Music, AlertCircle, Download, Check } from 'lucide-react';

interface AudioMixControlsProps {
  takesVolume: number;
  setTakesVolume: (vol: number) => void;
  backingVolume: number;
  setBackingVolume: (vol: number) => void;
  muteOriginalDuringTakes: boolean;
  setMuteOriginalDuringTakes: (mute: boolean) => void;
  hasBackingTrack: boolean;
  onExportTakesZip: () => void;
  isExporting: boolean;
}

export const AudioMixControls: React.FC<AudioMixControlsProps> = ({
  takesVolume,
  setTakesVolume,
  backingVolume,
  setBackingVolume,
  muteOriginalDuringTakes,
  setMuteOriginalDuringTakes,
  hasBackingTrack,
  onExportTakesZip,
  isExporting,
}) => {
  return (
    <div className="p-4 bg-neutral-900/80 border border-neutral-800 rounded-2xl space-y-4">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-white font-[Outfit] text-sm">Dub Audio Mix</span>
        </div>
        <span className="text-neutral-500 text-[11px]">Real-Time Sync Engine</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        {/* User Voice Takes Volume */}
        <div className="p-3 bg-neutral-950/60 border border-neutral-800/80 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-neutral-300">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Mic className="w-3.5 h-3.5 text-amber-400" />
              <span>Your Dub Takes</span>
            </span>
            <span className="font-mono tabular-nums text-amber-400 font-semibold">
              {Math.round(takesVolume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.05"
            value={takesVolume}
            onChange={(e) => setTakesVolume(parseFloat(e.target.value))}
            className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Backing Track Volume */}
        <div className="p-3 bg-neutral-950/60 border border-neutral-800/80 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-neutral-300">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Music className="w-3.5 h-3.5 text-blue-400" />
              <span>Backing Music</span>
            </span>
            <span className="font-mono tabular-nums text-blue-400 font-semibold">
              {hasBackingTrack ? `${Math.round(backingVolume * 100)}%` : 'No Track'}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            disabled={!hasBackingTrack}
            value={hasBackingTrack ? backingVolume : 0}
            onChange={(e) => setBackingVolume(parseFloat(e.target.value))}
            className="w-full accent-blue-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer disabled:opacity-40"
          />
        </div>
      </div>

      {/* Mute Original Vocals Toggle */}
      <div className="flex items-center justify-between p-3 bg-neutral-950/60 border border-neutral-800/80 rounded-xl text-xs">
        <div>
          <span className="font-medium text-white block">Mute Original Video Vocals During Takes</span>
          <span className="text-[11px] text-neutral-400 block mt-0.5">
            Automatically silences the original actor line so your take plays solo without vocal doubling.
          </span>
        </div>
        <button
          onClick={() => setMuteOriginalDuringTakes(!muteOriginalDuringTakes)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
            muteOriginalDuringTakes ? 'bg-amber-400' : 'bg-neutral-800'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-neutral-950 shadow ring-0 transition duration-200 ease-in-out ${
              muteOriginalDuringTakes ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Export Takes Button & Honest Technical Explanations */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="text-[11px] text-neutral-400 leading-normal">
          <span className="text-neutral-300 font-medium">Browser Export Note: </span>
          Video & voice preview runs live via Web Audio synchronization. Composite video export requires heavy local remuxing and is currently omitted for $0 budget client stability.
        </div>
        <button
          onClick={onExportTakesZip}
          disabled={isExporting}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isExporting ? 'Packing Takes...' : 'Export Takes Archive'}</span>
        </button>
      </div>
    </div>
  );
};
