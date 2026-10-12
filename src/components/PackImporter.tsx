import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileArchive,
  AlertTriangle,
  CheckCircle2,
  Download,
  Play,
  ShieldCheck,
  Film,
  Sparkles,
  Info,
  Bug,
  HelpCircle,
} from 'lucide-react';
import {
  SAMPLE_PACK_DESCRIPTORS,
  generateChoicerVoicerZip,
  generateDiagnosticTestZip,
} from '../utils/samplePacks';
import { ValidationIssue, ParsedScenePack } from '../types/pack';

interface PackImporterProps {
  onFileSelected: (file: File) => Promise<void>;
  isLoading: boolean;
  loadingStepText: string;
  lastError: string | null;
  lastIssues?: ValidationIssue[];
  onDismissModal?: () => void;
  isModalMode?: boolean;
  activePack?: ParsedScenePack | null;
  activeDubbedTakesCount?: number;
  onResumeStudio?: () => void;
  onUnloadPack?: () => void;
}

export const PackImporter: React.FC<PackImporterProps> = ({
  onFileSelected,
  isLoading,
  loadingStepText,
  lastError,
  lastIssues,
  onDismissModal,
  isModalMode = false,
  activePack,
  activeDubbedTakesCount,
  onResumeStudio,
  onUnloadPack,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [generatingPackId, setGeneratingPackId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'samples' | 'diagnostics'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      await onFileSelected(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      await onFileSelected(file);
      e.target.value = '';
    }
  };

  const handleLoadSample = async (packId: 'cyberpunk' | 'noir') => {
    try {
      setGeneratingPackId(packId);
      const file = await generateChoicerVoicerZip(packId);
      await onFileSelected(file);
    } finally {
      setGeneratingPackId(null);
    }
  };

  const handleDownloadSampleZip = async (packId: 'cyberpunk' | 'noir') => {
    try {
      setGeneratingPackId(`download_${packId}`);
      const file = await generateChoicerVoicerZip(packId);
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setGeneratingPackId(null);
    }
  };

  const handleRunDiagnosticTest = async (
    type: 'empty' | 'missing_video' | 'missing_lines' | 'ogv_legacy' | 'nested_folder'
  ) => {
    try {
      setGeneratingPackId(`diag_${type}`);
      const file = await generateDiagnosticTestZip(type);
      await onFileSelected(file);
    } finally {
      setGeneratingPackId(null);
    }
  };

  return (
    <div className={`w-full max-w-4xl mx-auto ${isModalMode ? 'p-2' : 'py-8 px-4'}`}>
      {/* Active Pack Quick Resume Banner (if pack is currently loaded) */}
      {activePack && onResumeStudio && !isModalMode && (
        <div className="mb-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-400 text-neutral-950 flex items-center justify-center font-bold shrink-0">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-amber-300 font-medium">
                <span className="font-semibold uppercase tracking-wider text-[11px]">Active Session</span>
                <span aria-hidden="true">·</span>
                <span>{activeDubbedTakesCount || 0} of {activePack.lines.length} lines dubbed</span>
              </div>
              <h2 className="text-base font-bold text-white font-[Outfit] mt-0.5">{activePack.title}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {onUnloadPack && (
              <button
                onClick={onUnloadPack}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg border border-neutral-800 transition-colors"
              >
                Close Scene
              </button>
            )}
            <button
              onClick={onResumeStudio}
              className="px-4 py-1.5 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <span>Resume Studio Booth</span>
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>
          </div>
        </div>
      )}

      {/* Title & Technical Rationale */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2">
          <span>Browser Voice Acting & Dubbing Game</span>
          <span aria-hidden="true">·</span>
          <span>Zero Server Uploads</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-[Outfit] text-balance">
          Import a Scene Pack to Dub
        </h1>
        <p className="mt-3 text-sm text-neutral-400 max-w-xl mx-auto leading-relaxed">
          Load a Choicer Voicer or DubBooth scene ZIP from your computer. Video and audio files are parsed locally in browser memory for $0 server cost and complete data privacy.
        </p>
      </div>

      {/* Segmented Mode Selector */}
      <div className="flex items-center justify-center mb-6">
        <div className="inline-flex p-1 bg-neutral-900 border border-neutral-800 rounded-lg">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'upload' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Import Local ZIP
          </button>
          <button
            onClick={() => setActiveTab('samples')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'samples' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Sample Scene Packs
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'diagnostics' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Archive Inspector Tests
          </button>
        </div>
      </div>

      {/* Tab 1: Local ZIP Upload */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-amber-400 bg-amber-500/5'
                : 'border-neutral-800 hover:border-neutral-700 bg-neutral-900/50 hover:bg-neutral-900/80'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <UploadCloud className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  Drop your Choicer Voicer ZIP here, or browse
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Supports standard Choicer Voicer ZIPs (<code className="text-neutral-300">_pack_info.ini</code>, <code className="text-neutral-300">dub_video.mp4/webm</code>, line files)
                </p>
              </div>

              <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-neutral-800/80 border border-neutral-700/60 rounded-md text-[11px] text-neutral-300">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Files stay 100% on your device. Never uploaded to external servers.</span>
              </div>
            </div>
          </div>

          {/* Format compatibility notes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 bg-neutral-900/60 border border-neutral-800 rounded-lg">
              <span className="font-semibold text-neutral-200 block mb-1">Choicer Voicer INI Standard</span>
              <p className="text-neutral-400 leading-normal">
                Recognizes <code className="text-amber-400">_pack_info.ini</code>, character icons, and line files (<code className="text-neutral-300">01_name.ini</code>).
              </p>
            </div>
            <div className="p-3.5 bg-neutral-900/60 border border-neutral-800 rounded-lg">
              <span className="font-semibold text-neutral-200 block mb-1">Web Video Codecs</span>
              <p className="text-neutral-400 leading-normal">
                HTML5 browsers natively decode H.264 (<code className="text-neutral-300">.mp4</code>) and VP9 (<code className="text-neutral-300">.webm</code>). Legacy <code className="text-neutral-300">.ogv</code> is flagged.
              </p>
            </div>
            <div className="p-3.5 bg-neutral-900/60 border border-neutral-800 rounded-lg">
              <span className="font-semibold text-neutral-200 block mb-1">Local Memory Safety</span>
              <p className="text-neutral-400 leading-normal">
                ZIP is uncompressed in-memory with JSZip and streams to Web Audio and HTML5 video via Object URLs.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Sample Scene Packs */}
      {activeTab === 'samples' && (
        <div className="space-y-4">
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-200">
            <strong>Ready-to-Play Choicer Voicer Packs:</strong> Don't have a scene pack ZIP yet? These sample packs generate real Choicer Voicer formatted archives on-the-fly. You can test dubbing immediately or download the ZIP to inspect its internal <code className="text-white">_pack_info.ini</code> structure.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SAMPLE_PACK_DESCRIPTORS.map((pack) => (
              <div
                key={pack.id}
                className="p-5 bg-neutral-900/80 border border-neutral-800 rounded-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
                    <span className="text-amber-400 font-semibold">{pack.genre}</span>
                    <span className="font-mono tabular-nums">{pack.duration.toFixed(0)}s scene</span>
                  </div>
                  <h3 className="text-base font-bold text-white font-[Outfit]">{pack.name}</h3>
                  <p className="text-xs text-neutral-400 mt-2 line-clamp-3 leading-relaxed">
                    {pack.description}
                  </p>

                  <div className="mt-4 pt-3 border-t border-neutral-800 text-[11px] text-neutral-400 flex items-center justify-between">
                    <span>Characters: {pack.characters.join(' & ')}</span>
                    <span>{pack.lineCount} dialogue lines</span>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-2">
                  <button
                    onClick={() => handleLoadSample(pack.id as any)}
                    disabled={isLoading || !!generatingPackId}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{generatingPackId === pack.id ? 'Generating...' : 'Load & Dub Now'}</span>
                  </button>
                  <button
                    onClick={() => handleDownloadSampleZip(pack.id as any)}
                    disabled={isLoading || !!generatingPackId}
                    title="Download authentic Choicer Voicer ZIP"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download ZIP</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Archive Inspector & Format Diagnostics Tests */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-4">
          <div className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-300">
            <strong>First Milestone Verification:</strong> Test how Voiceoke handles corrupted archives, missing video files, packs with missing dialogue lines, or unsupported legacy codecs (.ogv).
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <button
              onClick={() => handleRunDiagnosticTest('missing_video')}
              disabled={isLoading}
              className="p-3.5 bg-neutral-900 hover:bg-neutral-800/80 border border-neutral-800 rounded-lg text-left transition-colors flex items-start gap-3"
            >
              <div className="p-2 rounded bg-red-500/10 text-red-400 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <span className="font-semibold text-white block">Test Missing Video File</span>
                <span className="text-neutral-400 text-[11px] block mt-0.5">
                  Simulates a ZIP with metadata but no <code className="text-neutral-300">dub_video.mp4</code>.
                </span>
              </div>
            </button>

            <button
              onClick={() => handleRunDiagnosticTest('missing_lines')}
              disabled={isLoading}
              className="p-3.5 bg-neutral-900 hover:bg-neutral-800/80 border border-neutral-800 rounded-lg text-left transition-colors flex items-start gap-3"
            >
              <div className="p-2 rounded bg-amber-500/10 text-amber-400 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <span className="font-semibold text-white block">Test Missing Dialogue Lines</span>
                <span className="text-neutral-400 text-[11px] block mt-0.5">
                  Simulates a scene video without timed line definitions.
                </span>
              </div>
            </button>

            <button
              onClick={() => handleRunDiagnosticTest('ogv_legacy')}
              disabled={isLoading}
              className="p-3.5 bg-neutral-900 hover:bg-neutral-800/80 border border-neutral-800 rounded-lg text-left transition-colors flex items-start gap-3"
            >
              <div className="p-2 rounded bg-sky-500/10 text-sky-400 shrink-0">
                <Film className="w-4 h-4" />
              </div>
              <div>
                <span className="font-semibold text-white block">Test Legacy Ogg Theora (.ogv) Codec</span>
                <span className="text-neutral-400 text-[11px] block mt-0.5">
                  Validates browser warning and conversion recommendation.
                </span>
              </div>
            </button>

            <button
              onClick={() => handleRunDiagnosticTest('nested_folder')}
              disabled={isLoading}
              className="p-3.5 bg-neutral-900 hover:bg-neutral-800/80 border border-neutral-800 rounded-lg text-left transition-colors flex items-start gap-3"
            >
              <div className="p-2 rounded bg-emerald-500/10 text-emerald-400 shrink-0">
                <FileArchive className="w-4 h-4" />
              </div>
              <div>
                <span className="font-semibold text-white block">Test Deeply Nested Folder Pack</span>
                <span className="text-neutral-400 text-[11px] block mt-0.5">
                  Simulates a ZIP with files inside subdirectories (<code className="text-neutral-300">assets/media/</code>, <code className="text-neutral-300">lines/</code>).
                </span>
              </div>
            </button>

            <button
              onClick={() => handleRunDiagnosticTest('empty')}
              disabled={isLoading}
              className="p-3.5 bg-neutral-900 hover:bg-neutral-800/80 border border-neutral-800 rounded-lg text-left transition-colors flex items-start gap-3"
            >
              <div className="p-2 rounded bg-rose-500/10 text-rose-400 shrink-0">
                <Bug className="w-4 h-4" />
              </div>
              <div>
                <span className="font-semibold text-white block">Test Corrupted / Empty Archive</span>
                <span className="text-neutral-400 text-[11px] block mt-0.5">
                  Verifies safe inspection error interception.
                </span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Loading state banner */}
      {isLoading && (
        <div className="mt-6 p-4 bg-neutral-900 border border-amber-500/30 rounded-xl flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
          <div className="text-xs text-neutral-200">
            <span className="font-semibold text-amber-400">Inspecting Pack: </span>
            <span>{loadingStepText || 'Extracting local assets in browser memory...'}</span>
          </div>
        </div>
      )}

      {/* Error Callout */}
      {lastError && !isLoading && (
        <div className="mt-6 p-4 bg-red-950/40 border border-red-500/40 rounded-xl text-xs text-red-200 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Archive Inspection Error</span>
          </div>
          <p className="leading-relaxed">{lastError}</p>

          {lastIssues && lastIssues.length > 0 && (
            <div className="mt-3 pt-3 border-t border-red-900/60 space-y-1.5">
              <span className="font-semibold text-red-300 block">Identified Issues:</span>
              {lastIssues.map((issue, idx) => (
                <div key={idx} className="text-[11px] text-red-300/90 pl-2 border-l-2 border-red-600">
                  <span className="font-medium text-red-200">[{issue.code}]</span> {issue.message}
                  {issue.fixSuggestion && (
                    <span className="block text-red-400/80 mt-0.5">Suggestion: {issue.fixSuggestion}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
