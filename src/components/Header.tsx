import React from 'react';
import { Film, Upload, Download, RefreshCw, Home, Layers, BookOpen, FileArchive } from 'lucide-react';

interface HeaderProps {
  hasLoadedPack: boolean;
  packTitle?: string;
  onHomeClick: () => void;
  onStudioClick: () => void;
  onImportClick: () => void;
  onDownloadPackClick?: () => void;
  onOpenInspectClick?: () => void;
  onOpenHelpClick: () => void;
  activeTab: 'home' | 'workspace' | 'inspector' | 'guide';
}

export const Header: React.FC<HeaderProps> = ({
  hasLoadedPack,
  packTitle,
  onHomeClick,
  onStudioClick,
  onImportClick,
  onDownloadPackClick,
  onOpenInspectClick,
  onOpenHelpClick,
  activeTab,
}) => {
  return (
    <header className="flex flex-col border-b border-neutral-800/80 bg-neutral-950/95 backdrop-blur-md sticky top-0 z-40">
      {/* Top Bar Contract Row: Brand — Nav Links — Action */}
      <div className="flex items-center justify-between gap-8 px-4 sm:px-6 py-3.5">
        {/* Zone 1: Single text element wordmark / Home button */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onHomeClick}
            className="flex items-center gap-2.5 text-left group transition-transform"
            title="Go to Voiceoke Home"
            aria-label="Voiceoke Home"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:border-amber-400 transition-colors">
              <Film className="w-4 h-4" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white group-hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 font-[Outfit]">
              Voiceoke
            </span>
          </button>
        </div>

        {/* Zone 2: 4-5 single-line nav links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-neutral-400">
          <button
            onClick={onHomeClick}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 ${
              activeTab === 'home' ? 'border-amber-500 text-white font-semibold' : 'border-transparent'
            }`}
          >
            Home
          </button>

          {hasLoadedPack && (
            <button
              onClick={onStudioClick}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 ${
                activeTab === 'workspace' ? 'border-amber-500 text-white font-semibold' : 'border-transparent'
              }`}
            >
              Studio Booth
            </button>
          )}

          {hasLoadedPack && onOpenInspectClick && (
            <button
              onClick={onOpenInspectClick}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 ${
                activeTab === 'inspector' ? 'border-amber-500 text-white font-semibold' : 'border-transparent'
              }`}
            >
              Pack Inspector
            </button>
          )}

          <button
            onClick={onOpenHelpClick}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 ${
              activeTab === 'guide' ? 'border-amber-500 text-white font-semibold' : 'border-transparent'
            }`}
          >
            Pack Guide
          </button>
        </nav>

        {/* Zone 3: Primary action */}
        <div className="flex items-center gap-2.5 shrink-0">
          {hasLoadedPack && onDownloadPackClick && (
            <button
              onClick={onDownloadPackClick}
              title="Download current scene takes as ZIP archive"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 bg-neutral-900 border border-neutral-700/80 rounded-lg hover:bg-neutral-800 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-neutral-400" />
              <span>Export Takes</span>
            </button>
          )}
          <button
            onClick={onImportClick}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors shadow-sm whitespace-nowrap shrink-0"
          >
            {hasLoadedPack ? (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Switch Pack</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                <span>Import Scene Pack</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mobile-Friendly Sub-Navigation Strip (Visible on mobile screens) */}
      <div className="flex md:hidden items-center justify-around px-2 py-1.5 border-t border-neutral-800/60 bg-neutral-950 text-xs text-neutral-400">
        <button
          onClick={onHomeClick}
          className={`px-3 py-1 rounded-md transition-colors ${
            activeTab === 'home' ? 'bg-neutral-800 text-white font-semibold' : 'hover:text-white'
          }`}
        >
          Home
        </button>
        {hasLoadedPack && (
          <button
            onClick={onStudioClick}
            className={`px-3 py-1 rounded-md transition-colors ${
              activeTab === 'workspace' ? 'bg-neutral-800 text-white font-semibold' : 'hover:text-white'
            }`}
          >
            Studio Booth
          </button>
        )}
        {hasLoadedPack && onOpenInspectClick && (
          <button
            onClick={onOpenInspectClick}
            className={`px-3 py-1 rounded-md transition-colors ${
              activeTab === 'inspector' ? 'bg-neutral-800 text-white font-semibold' : 'hover:text-white'
            }`}
          >
            Inspector
          </button>
        )}
        <button
          onClick={onOpenHelpClick}
          className={`px-3 py-1 rounded-md transition-colors ${
            activeTab === 'guide' ? 'bg-neutral-800 text-white font-semibold' : 'hover:text-white'
          }`}
        >
          Guide
        </button>
      </div>
    </header>
  );
};
