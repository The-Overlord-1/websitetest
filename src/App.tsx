/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import {
  Film,
  Upload,
  Download,
  AlertTriangle,
  Info,
  CheckCircle2,
  Sliders,
  Layers,
  Sparkles,
  HelpCircle,
  FileArchive,
} from 'lucide-react';
import { ParsedScenePack, DialogueLine, DubTake, ValidationIssue } from './types/pack';
import { parseScenePackZip } from './utils/packParser';
import { DubSyncManager } from './utils/dubSyncEngine';
import { startRecordingSession, isMicrophoneSupported } from './utils/audioRecorder';
import { Header } from './components/Header';
import { PackImporter } from './components/PackImporter';
import { VideoPlayer } from './components/VideoPlayer';
import { TimelineView } from './components/TimelineView';
import { RecordingStudioModal } from './components/RecordingStudioModal';
import { PackInspectionModal } from './components/PackInspectionModal';
import { PackGuideModal } from './components/PackGuideModal';
import { AudioMixControls } from './components/AudioMixDrawer';

export default function App() {
  // Navigation & Modals: default to home
  const [activeNavTab, setActiveNavTab] = useState<'home' | 'workspace' | 'inspector' | 'guide'>('home');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Pack State
  const [currentPack, setCurrentPack] = useState<ParsedScenePack | null>(null);
  const [isLoadingPack, setIsLoadingPack] = useState(false);
  const [loadingStepText, setLoadingStepText] = useState('');
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastIssues, setLastIssues] = useState<ValidationIssue[]>([]);

  // Video Playback State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeLine, setActiveLine] = useState<DialogueLine | null>(null);
  const [loopActiveLine, setLoopActiveLine] = useState(false);

  // Takes & Audio Mixing State
  const [lineTakes, setLineTakes] = useState<Map<string, DubTake[]>>(new Map());
  const [activeTakeMap, setActiveTakeMap] = useState<Map<string, DubTake>>(new Map());
  const [takesVolume, setTakesVolume] = useState(1.0);
  const [backingVolume, setBackingVolume] = useState(0.8);
  const [muteOriginalDuringTakes, setMuteOriginalDuringTakes] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Original Audio Audition State
  const [auditionAudioUrl, setAuditionAudioUrl] = useState<string | null>(null);
  const auditionAudioRef = useRef<HTMLAudioElement | null>(null);

  // Sync Manager Ref
  const syncManagerRef = useRef<DubSyncManager | null>(null);

  // Recording State Machine
  const [recordingLine, setRecordingLine] = useState<DialogueLine | null>(null);
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdownValue, setCountdownValue] = useState(3);
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordedTake, setRecordedTake] = useState<DubTake | null>(null);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [micErrorMessage, setMicErrorMessage] = useState<string | null>(null);
  const activeRecordStopFn = useRef<(() => Promise<{ blob: Blob; duration: number }>) | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const finishInProgressRef = useRef(false);

  // Release timers, microphone recording, and audition playback on unmount.
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current !== null) {
        window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      if (recordingTimerRef.current !== null) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (activeRecordStopFn.current) {
        activeRecordStopFn.current().catch(() => {});
        activeRecordStopFn.current = null;
      }
      if (auditionAudioRef.current) {
        auditionAudioRef.current.pause();
        auditionAudioRef.current = null;
      }
    };
  }, []);

  // Create one sync manager per loaded scene. Do not destroy it every time
  // a volume or take changes: that caused playback state and video volume resets.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentPack) {
      syncManagerRef.current?.destroy();
      syncManagerRef.current = null;
      return;
    }

    const manager = new DubSyncManager(
      video,
      currentPack.backingTrackBlobUrl,
      currentPack.lines
    );
    syncManagerRef.current = manager;

    return () => {
      manager.destroy();
      if (syncManagerRef.current === manager) {
        syncManagerRef.current = null;
      }
    };
  }, [currentPack]);

  // Keep the existing manager up to date without repeatedly tearing it down.
  useEffect(() => {
    const manager = syncManagerRef.current;
    if (!manager || !currentPack) return;
    manager.updateLines(currentPack.lines);
    manager.updateTakes(activeTakeMap);
    manager.setBackingVolume(backingVolume);
    manager.setTakesVolume(takesVolume);
  }, [currentPack, activeTakeMap, backingVolume, takesVolume]);

  useEffect(() => {
    // Keep the sync engine in recording-safe mode during countdown, microphone
    // permission prompts, active recording, and retakes.
    syncManagerRef.current?.setRecordingActive(isRecordingModalOpen && !recordedTake);
  }, [isRecordingModalOpen, recordedTake, currentPack]);

  // Video Event Listeners for currentTime & activeLine tracking
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration || 0);
    };

    if (video.readyState >= 1) {
      setDuration(video.duration || 0);
    }

    const handleTimeUpdate = () => {
      const cur = video.currentTime;
      setCurrentTime(cur);

      // Find active line matching current playback time
      if (currentPack) {
        const found = currentPack.lines.find(
          (l) => cur >= l.startTime && cur <= l.endTime
        );
        if (found) {
          setActiveLine(found);
        }

        // Handle Loop Active Line
        if (loopActiveLine && activeLine) {
          if (cur >= activeLine.endTime) {
            video.currentTime = activeLine.startTime;
            video.play().catch(() => {});
          }
        }
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setActiveLine(null);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [currentPack, loopActiveLine, activeLine]);

  // Handle local ZIP file selection
  const handleFileSelected = async (file: File) => {
    setIsLoadingPack(true);
    setLastError(null);
    setLastIssues([]);
    setLoadingStepText('Inspecting ZIP directory structure safely...');

    try {
      setLoadingStepText('Extracting video, metadata, and dialogue timings...');
      const parsedPack = await parseScenePackZip(file);

      // Clean up previous blob URLs if any
      if (currentPack) {
        URL.revokeObjectURL(currentPack.videoBlobUrl);
        if (currentPack.backingTrackBlobUrl) URL.revokeObjectURL(currentPack.backingTrackBlobUrl);
      }

      setCurrentPack(parsedPack);
      setCurrentTime(0);
      setDuration(0);
      setActiveLine(parsedPack.lines.length > 0 ? parsedPack.lines[0] : null);
      setLineTakes(new Map());
      setActiveTakeMap(new Map());
      setIsImportModalOpen(false);
      setActiveNavTab('workspace');

      if (parsedPack.validationReport.issues.length > 0) {
        setLastIssues(parsedPack.validationReport.issues);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLastError(msg);
    } finally {
      setIsLoadingPack(false);
      setLoadingStepText('');
    }
  };

  // Video Transport Handlers
  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  const handleSeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, time));
  }, []);

  const handleSeekToLine = useCallback(
    (line: DialogueLine) => {
      setActiveLine(line);
      handleSeek(line.startTime);
    },
    [handleSeek]
  );

  // Audition Original Voice Actor audio
  const handlePlayOriginalAudio = (audioUrl: string) => {
    if (auditionAudioRef.current) {
      auditionAudioRef.current.pause();
    }

    if (auditionAudioUrl === audioUrl) {
      setAuditionAudioUrl(null);
      return;
    }

    const audio = new Audio(audioUrl);
    auditionAudioRef.current = audio;
    setAuditionAudioUrl(audioUrl);

    audio.onended = () => {
      setAuditionAudioUrl(null);
    };
    audio.play().catch(() => {
      setAuditionAudioUrl(null);
    });
  };

  // Play a specific dubbed take
  const handlePlayTake = (take: DubTake) => {
    if (auditionAudioRef.current) {
      auditionAudioRef.current.pause();
    }
    const audio = new Audio(take.audioUrl);
    auditionAudioRef.current = audio;
    audio.play().catch(() => {});
  };

  // Take Management
  const handleSelectActiveTake = (lineId: string, take: DubTake) => {
    setActiveTakeMap((prev) => {
      const next = new Map(prev);
      next.set(lineId, take);
      return next;
    });
  };

  const handleDeleteTake = (lineId: string, takeId: string) => {
    setLineTakes((prev) => {
      const next = new Map(prev);
      const currentList = next.get(lineId) || [];
      const filtered = currentList.filter((t) => t.id !== takeId);
      if (filtered.length === 0) {
        next.delete(lineId);
      } else {
        next.set(lineId, filtered);
      }
      return next;
    });

    setActiveTakeMap((prev) => {
      const next = new Map(prev);
      if (next.get(lineId)?.id === takeId) {
        const remaining = lineTakes.get(lineId)?.filter((t) => t.id !== takeId) || [];
        if (remaining.length > 0) {
          next.set(lineId, remaining[remaining.length - 1]);
        } else {
          next.delete(lineId);
        }
      }
      return next;
    });
  };

  // RECORDING WORKFLOW
  const handleStartRecordLine = async (line: DialogueLine) => {
    // Clear any previous countdown/elapsed timer before starting a new take.
    if (countdownTimerRef.current !== null) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    setRecordingLine(line);
    setActiveLine(line);
    setMicErrorMessage(null);
    setRecordedTake(null);
    setIsRecordingModalOpen(true);
    setIsCountingDown(true);
    setCountdownValue(3);
    setIsRecording(false);
    setRecordingElapsed(0);

    // The player mutes through its native muted property during this pause
    // and throughout the countdown, without changing the volume slider value.
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = line.startTime;
    }

    let count = 3;
    countdownTimerRef.current = window.setInterval(async () => {
      count--;
      if (count > 0) {
        setCountdownValue(count);
      } else {
        if (countdownTimerRef.current !== null) {
          window.clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        setIsCountingDown(false);
        await initiateLiveRecording(line);
      }
    }, 1000);
  };

  const initiateLiveRecording = async (line: DialogueLine) => {
    try {
      const { session, stop } = await startRecordingSession((lvl) => {
        setAudioLevel(lvl);
      });
      activeRecordStopFn.current = stop;
      setIsRecording(true);

      // Start video playback synchronously with mic take
      if (videoRef.current) {
        videoRef.current.currentTime = line.startTime;
        videoRef.current.play().catch(() => {});
      }

      // Track elapsed time
      const startTimeMs = performance.now();
      const lineDuration = Math.max(1, line.endTime - line.startTime);

      recordingTimerRef.current = window.setInterval(() => {
        const elapsed = (performance.now() - startTimeMs) / 1000;
        setRecordingElapsed(elapsed);

        // Automatically finish take when line duration is reached (with 0.4s grace)
        if (elapsed >= lineDuration + 0.4) {
          handleFinishRecording();
        }
      }, 100);
    } catch (err: unknown) {
      setIsRecording(false);
      setMicErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleFinishRecording = async () => {
    if (finishInProgressRef.current) return;
    const stopRecording = activeRecordStopFn.current;
    if (!stopRecording) return;
    finishInProgressRef.current = true;

    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (videoRef.current) videoRef.current.pause();

    try {
      activeRecordStopFn.current = null;
      const { blob, duration: dur } = await stopRecording();
      setIsRecording(false);
      setAudioLevel(0);

      if (recordingLine && blob.size > 0) {
        const existingTakes = lineTakes.get(recordingLine.id) || [];
        const nextTakeNum = existingTakes.length + 1;
        const takeUrl = URL.createObjectURL(blob);
        const newTake: DubTake = {
          id: `take_${recordingLine.id}_${Date.now()}`,
          lineId: recordingLine.id,
          takeNumber: nextTakeNum,
          audioBlob: blob,
          audioUrl: takeUrl,
          duration: dur,
          recordedAt: Date.now(),
        };
        setRecordedTake(newTake);
      } else if (blob.size === 0) {
        setMicErrorMessage('No audio was captured. Check your microphone and try recording again.');
      }
    } catch (err: unknown) {
      setMicErrorMessage(err instanceof Error ? err.message : String(err));
      setIsRecording(false);
    } finally {
      finishInProgressRef.current = false;
    }
  };

  const handleAcceptTake = (take: DubTake) => {
    if (!recordingLine) return;

    setLineTakes((prev) => {
      const next = new Map(prev);
      const list = next.get(recordingLine.id) || [];
      next.set(recordingLine.id, [...list, take]);
      return next;
    });

    setActiveTakeMap((prev) => {
      const next = new Map(prev);
      next.set(recordingLine.id, take);
      return next;
    });

    setIsRecordingModalOpen(false);
    setRecordingLine(null);
    setRecordedTake(null);
  };

  const handleRetake = () => {
    if (recordingLine) {
      handleStartRecordLine(recordingLine);
    }
  };

  const handleCancelRecording = () => {
    finishInProgressRef.current = false;
    if (countdownTimerRef.current !== null) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (activeRecordStopFn.current) {
      activeRecordStopFn.current().catch(() => {});
      activeRecordStopFn.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setIsCountingDown(false);
    setIsRecording(false);
    setIsRecordingModalOpen(false);
    setRecordingLine(null);
    setRecordedTake(null);
    setAudioLevel(0);
  };

  // Export Takes as ZIP
  const handleExportTakesZip = async () => {
    if (!currentPack || activeTakeMap.size === 0) {
      alert('Please record at least one dialogue line take before exporting.');
      return;
    }

    setIsExporting(true);
    try {
      const zip = new JSZip();

      // Readme with metadata
      const manifest = {
        scene: currentPack.title,
        author: currentPack.author,
        dubbedTakesCount: activeTakeMap.size,
        exportedAt: new Date().toISOString(),
        takes: [] as any[],
      };

      for (const [lineId, take] of activeTakeMap.entries()) {
        const line = currentPack.lines.find((l) => l.id === lineId);
        const fileName = `${line?.lineNumber || 1}_${line?.character || 'Actor'}_take${take.takeNumber}.webm`;
        zip.file(fileName, take.audioBlob);
        manifest.takes.push({
          lineId,
          lineNumber: line?.lineNumber,
          character: line?.character,
          text: line?.text,
          startTime: line?.startTime,
          endTime: line?.endTime,
          takeFile: fileName,
          duration: take.duration,
        });
      }

      zip.file('dub_manifest.json', JSON.stringify(manifest, null, 2));

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentPack.title.replace(/[^a-z0-9]/gi, '_')}_Dubbed_Takes.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const getCharacterColor = (charName: string) => {
    const c = currentPack?.characters.find((char) => char.name.toLowerCase() === charName.toLowerCase());
    return c?.color || '#f59e0b';
  };

  const handleGoHome = () => {
    setActiveNavTab('home');
  };

  const handleGoStudio = () => {
    if (currentPack) {
      setActiveNavTab('workspace');
    }
  };

  const handleUnloadPack = () => {
    if (currentPack) {
      URL.revokeObjectURL(currentPack.videoBlobUrl);
      if (currentPack.backingTrackBlobUrl) {
        URL.revokeObjectURL(currentPack.backingTrackBlobUrl);
      }
    }
    setCurrentPack(null);
    setActiveTakeMap(new Map());
    setLineTakes(new Map());
    setActiveNavTab('home');
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-[Plus_Jakarta_Sans]">
      {/* Universal Top Bar */}
      <Header
        hasLoadedPack={!!currentPack}
        packTitle={currentPack?.title}
        onHomeClick={handleGoHome}
        onStudioClick={handleGoStudio}
        onImportClick={() => setIsImportModalOpen(true)}
        onDownloadPackClick={handleExportTakesZip}
        onOpenInspectClick={() => setIsInspectorOpen(true)}
        onOpenHelpClick={() => setIsGuideOpen(true)}
        activeTab={activeNavTab}
      />

      {/* Main App Body */}
      <main className="flex-1 flex flex-col">
        {!currentPack || activeNavTab === 'home' ? (
          /* View 1: Homepage / Empty State Importer */
          <div className="flex-1 flex items-center justify-center p-4">
            <PackImporter
              onFileSelected={handleFileSelected}
              isLoading={isLoadingPack}
              loadingStepText={loadingStepText}
              lastError={lastError}
              lastIssues={lastIssues}
              activePack={currentPack}
              activeDubbedTakesCount={activeTakeMap.size}
              onResumeStudio={handleGoStudio}
              onUnloadPack={handleUnloadPack}
            />
          </div>
        ) : (
          /* View 2: Studio Workspace (Video Monitor + Timeline + Mixer) */
          <div className="max-w-[1440px] w-full mx-auto p-4 sm:p-6 space-y-6">
            {/* Scene Header Strip */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <button
                    onClick={handleGoHome}
                    className="hover:text-amber-400 transition-colors flex items-center gap-1 font-medium"
                    title="Return to Home"
                  >
                    <span>Home</span>
                  </button>
                  <span className="text-neutral-600">/</span>
                  <span className="font-semibold text-amber-400">{currentPack.validationReport.formatName}</span>
                  <span aria-hidden="true">·</span>
                  <span>Creator: {currentPack.author}</span>
                  <span aria-hidden="true">·</span>
                  <span>{currentPack.lines.length} Lines</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-white font-[Outfit]">
                  {currentPack.title}
                </h1>
              </div>

              {/* Navigation Action Buttons */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={handleGoHome}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
                  title="Return to Home screen"
                >
                  <span>Home</span>
                </button>
                <button
                  onClick={() => setIsInspectorOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
                >
                  <FileArchive className="w-3.5 h-3.5 text-amber-400" />
                  <span>Archive & Codec Details</span>
                </button>
              </div>
            </div>

            {/* Import Summary Strip */}
            <div className="p-3 bg-neutral-900/60 border border-neutral-800/80 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-4 text-neutral-300">
                <div className="flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-blue-400" />
                  <span className="font-semibold text-white">Video:</span>
                  <span>{currentPack.videoFileName || 'None detected'}</span>
                  {currentPack.videoFileName && (
                    <span className="text-[11px] text-neutral-500 font-mono">({currentPack.videoMimeType})</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-white">Dialogue:</span>
                  <span className="text-amber-400 font-medium">{currentPack.lines.length} lines parsed</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-white">Cast:</span>
                  <span>{currentPack.characters.map((c) => c.name).join(', ') || 'None'}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-white">Audio Files:</span>
                  <span>
                    {currentPack.archiveEntries.filter((e) => e.category === 'audio').length} detected
                    {currentPack.backingTrackFileName ? ` (Backing: ${currentPack.backingTrackFileName})` : ''}
                  </span>
                </div>
              </div>

              {currentPack.validationReport.issues.length > 0 && (
                <button
                  onClick={() => setIsInspectorOpen(true)}
                  className="inline-flex items-center gap-1.5 text-[11px] text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg transition-colors border border-amber-500/20"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>{currentPack.validationReport.issues.length} Import Notice(s)</span>
                </button>
              )}
            </div>

            {/* Split Screen Workspace (1440px Desktop baseline) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Video Monitor & Audio Mixer (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <VideoPlayer
                  pack={currentPack}
                  videoRef={videoRef}
                  currentTime={currentTime}
                  duration={duration}
                  isPlaying={isPlaying}
                  onPlayPause={handlePlayPause}
                  onSeek={handleSeek}
                  activeLine={activeLine}
                  activeTake={activeLine ? activeTakeMap.get(activeLine.id) || null : null}
                  loopActiveLine={loopActiveLine}
                  setLoopActiveLine={setLoopActiveLine}
                  lines={currentPack.lines}
                  onSelectLine={(l) => {
                    setActiveLine(l);
                    handleSeekToLine(l);
                  }}
                  isRecording={isRecording}
                  muteOriginalAudio={isRecordingModalOpen && !recordedTake}
                  muteOriginalDuringTakes={muteOriginalDuringTakes}
                />

                {/* Real-time Dubbing Mixer Controls */}
                <AudioMixControls
                  takesVolume={takesVolume}
                  setTakesVolume={setTakesVolume}
                  backingVolume={backingVolume}
                  setBackingVolume={setBackingVolume}
                  muteOriginalDuringTakes={muteOriginalDuringTakes}
                  setMuteOriginalDuringTakes={setMuteOriginalDuringTakes}
                  hasBackingTrack={!!currentPack.backingTrackBlobUrl}
                  onExportTakesZip={handleExportTakesZip}
                  isExporting={isExporting}
                />
              </div>

              {/* Right Column: Dialogue Line Timeline & Takes Manager (5 cols) */}
              <div className="lg:col-span-5 h-[680px]">
                <TimelineView
                  pack={currentPack}
                  lines={currentPack.lines}
                  activeLineId={activeLine?.id || null}
                  onSelectLine={(line) => {
                    setActiveLine(line);
                  }}
                  onSeekToLine={handleSeekToLine}
                  lineTakes={lineTakes}
                  activeTakeMap={activeTakeMap}
                  onStartRecordLine={handleStartRecordLine}
                  onPlayTake={handlePlayTake}
                  onDeleteTake={handleDeleteTake}
                  onSelectActiveTake={handleSelectActiveTake}
                  onPlayOriginalAudio={handlePlayOriginalAudio}
                  playingAudioUrl={auditionAudioUrl}
                  isRecording={isRecording || isCountingDown}
                  recordingLineId={recordingLine?.id || null}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 shadow-2xl relative">
            <button
              onClick={() => setIsImportModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
            >
              ✕
            </button>
            <PackImporter
              onFileSelected={handleFileSelected}
              isLoading={isLoadingPack}
              loadingStepText={loadingStepText}
              lastError={lastError}
              lastIssues={lastIssues}
              isModalMode={true}
              onDismissModal={() => setIsImportModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Recording Studio Modal */}
      {isRecordingModalOpen && recordingLine && (
        <RecordingStudioModal
          line={recordingLine}
          characterColor={getCharacterColor(recordingLine.character)}
          isCountingDown={isCountingDown}
          countdownValue={countdownValue}
          isRecording={isRecording}
          audioLevel={audioLevel}
          recordedTake={recordedTake}
          onCancel={handleCancelRecording}
          onFinishRecording={handleFinishRecording}
          onAcceptTake={handleAcceptTake}
          onRetake={handleRetake}
          recordingElapsed={recordingElapsed}
          lineDuration={Math.max(1, recordingLine.endTime - recordingLine.startTime)}
          errorMessage={micErrorMessage}
        />
      )}

      {/* Pack Inspection Modal */}
      {isInspectorOpen && currentPack && (
        <PackInspectionModal
          pack={currentPack}
          onClose={() => setIsInspectorOpen(false)}
        />
      )}

      {/* Pack Guide Modal */}
      {isGuideOpen && (
        <PackGuideModal onClose={() => setIsGuideOpen(false)} />
      )}
    </div>
  );
}
