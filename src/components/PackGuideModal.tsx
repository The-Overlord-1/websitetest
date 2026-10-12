import React from 'react';
import { X, BookOpen, FileText, CheckCircle2, AlertTriangle, ShieldCheck, DollarSign } from 'lucide-react';

interface PackGuideModalProps {
  onClose: () => void;
}

export const PackGuideModal: React.FC<PackGuideModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-[Outfit]">Voiceoke Pack Guide & Architecture</h2>
              <span className="text-xs text-neutral-400">Technical decisions and Choicer Voicer workflow</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-neutral-300 leading-relaxed">
          {/* Section 1: The $0 Budget Browser Architecture */}
          <div className="p-4 bg-neutral-950/60 border border-neutral-800 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-semibold font-[Outfit] text-sm">
              <DollarSign className="w-4 h-4" />
              <span>Zero-Budget Technical Decisions</span>
            </div>
            <p>
              Traditional video dubbing apps upload massive media files to cloud servers (Amazon S3, Google Cloud Storage, or rendering farms), incurring high monthly storage and bandwidth costs.
            </p>
            <p>
              Voiceoke runs <strong>100% locally in your browser</strong> using client-side JavaScript, Web Audio API, and JSZip. Your video and microphone takes are processed exclusively inside your browser's private memory:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
              <div className="p-2.5 rounded bg-neutral-900 border border-neutral-800 flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>Zero Server Costs: No recurring AWS/GCP bills, no subscriptions.</span>
              </div>
              <div className="p-2.5 rounded bg-neutral-900 border border-neutral-800 flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>Total Privacy: Video files never leave your computer.</span>
              </div>
            </div>
          </div>

          {/* Section 2: Choicer Voicer Standard Specification */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white font-[Outfit]">
              Choicer Voicer & DubBooth Pack File Structure
            </h3>
            <p>
              A standard Choicer Voicer scene pack is a <code className="text-neutral-200">.zip</code> archive organized as follows:
            </p>

            <div className="p-3.5 bg-neutral-950 font-mono text-[11px] rounded-xl border border-neutral-800 space-y-1 text-neutral-300">
              <div className="text-amber-400 font-bold">my_scene_pack.zip</div>
              <div className="pl-4">├── <span className="text-amber-300">_pack_info.ini</span> (Scene title, author, cast list)</div>
              <div className="pl-4">├── <span className="text-blue-300">dub_video.mp4</span> (or .webm; video clip to dub)</div>
              <div className="pl-4">├── <span className="text-emerald-300">_backing_track.wav</span> (Optional music/instrumental)</div>
              <div className="pl-4">├── <span className="text-pink-300">icon.png</span> (Pack thumbnail)</div>
              <div className="pl-4">├── <span className="text-amber-300">01_intro.ini</span> (Character, Caption, Timestamp)</div>
              <div className="pl-4">├── <span className="text-emerald-300">01_intro.wav</span> (Original voice actor clip for audition)</div>
              <div className="pl-4">└── <span className="text-amber-300">02_reply.ini</span> ...</div>
            </div>
          </div>

          {/* Section 3: Video Codecs and Browser Limitations */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white font-[Outfit]">
              Video Codec Diagnostics (.mp4 vs .webm vs .ogv)
            </h3>
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800">
                <span className="font-semibold text-emerald-400 block mb-0.5">MP4 (H.264) & WebM (VP8/VP9) · Recommended</span>
                <p className="text-neutral-400 text-[11px]">
                  Universally decoded with zero latency by Google Chrome, Safari, Microsoft Edge, and Firefox.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800">
                <span className="font-semibold text-amber-400 block mb-0.5">Ogg Theora (.ogv) · Legacy Format Notice</span>
                <p className="text-neutral-400 text-[11px]">
                  Earlier Godot-based desktop versions of Choicer Voicer used Ogg Theora. Modern browser HTML5 video engines do not natively support Theora. If you encounter an .ogv pack, Voiceoke flags this in the Inspector and recommends converting to MP4 or WebM.
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Exporting Takes */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-white font-[Outfit]">
              Exporting Your Dubbed Scene
            </h3>
            <p>
              Voiceoke plays your dubbed lines in real-time alongside the video using browser audio synchronization. You can also export your recorded voice takes as a clean ZIP archive with separate audio files for each line, preserving your work for external video editors or sharing with friends!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-medium transition-colors text-xs"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
