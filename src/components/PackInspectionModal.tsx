import React from 'react';
import { X, CheckCircle, AlertTriangle, Info, FileText, Film, Music, Image as ImageIcon, Archive } from 'lucide-react';
import { ParsedScenePack } from '../types/pack';

interface PackInspectionModalProps {
  pack: ParsedScenePack;
  onClose: () => void;
}

export const PackInspectionModal: React.FC<PackInspectionModalProps> = ({ pack, onClose }) => {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'video':
        return <Film className="w-3.5 h-3.5 text-blue-400" />;
      case 'audio':
        return <Music className="w-3.5 h-3.5 text-emerald-400" />;
      case 'image':
        return <ImageIcon className="w-3.5 h-3.5 text-pink-400" />;
      case 'ini':
      case 'json':
      case 'text':
        return <FileText className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Archive className="w-3.5 h-3.5 text-neutral-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 font-mono">
                Archive Inspector
              </span>
              <span className="text-neutral-500">·</span>
              <span className="text-xs text-neutral-400">{pack.formatDetected}</span>
            </div>
            <h2 className="text-lg font-bold text-white font-[Outfit] mt-0.5">{pack.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Format Identification & Codec Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 bg-neutral-950/60 border border-neutral-800/80 rounded-xl">
              <span className="text-neutral-500 block text-[11px] uppercase tracking-wider font-medium">Format Standard</span>
              <span className="font-semibold text-neutral-200 mt-1 block">{pack.validationReport.formatName}</span>
              <span className="text-neutral-400 text-[11px] mt-0.5 block">File: {pack.rawZipName}</span>
            </div>

            <div className="p-3.5 bg-neutral-950/60 border border-neutral-800/80 rounded-xl">
              <span className="text-neutral-500 block text-[11px] uppercase tracking-wider font-medium">Video Container</span>
              <span className="font-semibold text-neutral-200 mt-1 block">{pack.videoFileName || 'None'}</span>
              <span className="text-neutral-400 text-[11px] mt-0.5 block">MIME: {pack.videoMimeType}</span>
            </div>

            <div className="p-3.5 bg-neutral-950/60 border border-neutral-800/80 rounded-xl">
              <span className="text-neutral-500 block text-[11px] uppercase tracking-wider font-medium">Scene Structure</span>
              <span className="font-semibold text-neutral-200 mt-1 block">
                {pack.lines.length} Lines · {pack.characters.length} Cast
              </span>
              <span className="text-neutral-400 text-[11px] mt-0.5 block">
                Backing: {pack.backingTrackFileName || 'None (Using Video Audio)'}
              </span>
            </div>
          </div>

          {/* Video Codec Notice if applicable */}
          {pack.validationReport.videoCodecNote && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold text-amber-300 block">Codec Notice:</span>
                <p className="leading-relaxed">{pack.validationReport.videoCodecNote}</p>
              </div>
            </div>
          )}

          {/* Validation Issues / Diagnostics */}
          {pack.validationReport.issues.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Diagnostic Findings ({pack.validationReport.issues.length})
              </h3>
              <div className="space-y-2">
                {pack.validationReport.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                      issue.severity === 'error'
                        ? 'bg-red-950/30 border-red-500/40 text-red-200'
                        : issue.severity === 'warning'
                        ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                        : 'bg-neutral-800/40 border-neutral-700/40 text-neutral-300'
                    }`}
                  >
                    {issue.severity === 'error' ? (
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    ) : issue.severity === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold uppercase text-[10px] px-1.5 py-0.2 bg-black/40 rounded">
                          {issue.code}
                        </span>
                        {issue.filePath && <span className="text-neutral-400 font-mono text-[11px]">{issue.filePath}</span>}
                      </div>
                      <p className="leading-relaxed">{issue.message}</p>
                      {issue.fixSuggestion && (
                        <p className="text-[11px] text-neutral-400 mt-1">
                          Fix suggestion: {issue.fixSuggestion}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Internal Archive Tree */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <h3 className="font-semibold uppercase tracking-wider text-neutral-400">
                Extracted Files in Memory ({pack.archiveEntries.length})
              </h3>
              <span className="text-neutral-500">Decoded safely client-side via JSZip</span>
            </div>

            <div className="border border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-800/60 bg-neutral-950/50">
              <div className="grid grid-cols-12 px-3 py-2 bg-neutral-900/80 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                <div className="col-span-7">File Path</div>
                <div className="col-span-3">Category</div>
                <div className="col-span-2 text-right">Size</div>
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-neutral-800/40 text-xs font-mono">
                {pack.archiveEntries.map((file, idx) => (
                  <div key={idx} className="grid grid-cols-12 px-3 py-1.5 items-center hover:bg-neutral-900/40 text-neutral-300">
                    <div className="col-span-7 flex items-center gap-2 truncate">
                      {getCategoryIcon(file.category)}
                      <span className="truncate">{file.path}</span>
                    </div>
                    <div className="col-span-3 text-neutral-400 capitalize text-[11px]">
                      {file.category}
                    </div>
                    <div className="col-span-2 text-right text-neutral-500 text-[11px] tabular-nums">
                      {formatBytes(file.size)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between text-xs">
          <span className="text-neutral-500">Choicer Voicer & DubBooth Local Inspector</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-medium transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
