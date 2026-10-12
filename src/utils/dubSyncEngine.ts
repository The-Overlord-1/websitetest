import { DialogueLine, DubTake } from '../types/pack';

/**
 * Manages synchronized audio playback for backing tracks and user takes alongside HTML5 video.
 */
export class DubSyncManager {
  private videoEl: HTMLVideoElement | null = null;
  private backingAudioEl: HTMLAudioElement | null = null;
  private lineTakeAudioMap = new Map<string, HTMLAudioElement>();
  private lines: DialogueLine[] = [];
  private takes: Map<string, DubTake> = new Map(); // lineId -> active take

  private backingVolume = 0.8;
  private takesVolume = 1.0;
  private recordingActive = false;
  private isDestroyed = false;

  constructor(
    videoEl: HTMLVideoElement,
    backingTrackUrl?: string,
    lines: DialogueLine[] = []
  ) {
    this.videoEl = videoEl;
    this.lines = lines;

    if (backingTrackUrl) {
      this.backingAudioEl = new Audio(backingTrackUrl);
      this.backingAudioEl.volume = this.backingVolume;
      this.backingAudioEl.preload = 'auto';
    }

    this.setupListeners();
  }

  public updateLines(lines: DialogueLine[]) {
    this.lines = lines;
  }

  public updateTakes(takes: Map<string, DubTake>) {
    this.takes = takes;

    // Pre-instantiate audio elements for fast synchronized triggers
    this.lineTakeAudioMap.forEach((audio) => {
      audio.pause();
    });
    this.lineTakeAudioMap.clear();

    takes.forEach((take, lineId) => {
      const audio = new Audio(take.audioUrl);
      audio.volume = this.takesVolume;
      audio.preload = 'auto';
      this.lineTakeAudioMap.set(lineId, audio);
    });
  }

  public setBackingVolume(vol: number) {
    this.backingVolume = Math.max(0, Math.min(1, vol));
    if (this.backingAudioEl) {
      this.backingAudioEl.volume = this.backingVolume;
    }
  }

  public setTakesVolume(vol: number) {
    this.takesVolume = Math.max(0, Math.min(1, vol));
    this.lineTakeAudioMap.forEach((audio) => {
      audio.volume = this.takesVolume;
    });
  }

  public setRecordingActive(active: boolean) {
    this.recordingActive = active;
    if (active) {
      // Never replay an existing take over the microphone during a retake.
      this.lineTakeAudioMap.forEach((audio) => audio.pause());
    }
  }

  private setupListeners() {
    if (!this.videoEl) return;

    this.videoEl.addEventListener('play', this.handlePlay);
    this.videoEl.addEventListener('pause', this.handlePause);
    this.videoEl.addEventListener('seeking', this.handleSeek);
    this.videoEl.addEventListener('timeupdate', this.handleTimeUpdate);
    this.videoEl.addEventListener('ended', this.handleEnded);
  }

  private handlePlay = () => {
    if (this.backingAudioEl && this.videoEl) {
      this.backingAudioEl.currentTime = this.videoEl.currentTime;
      // Avoid feeding the backing track back into the microphone during a take.
      if (this.recordingActive) {
        this.backingAudioEl.pause();
      } else {
        this.backingAudioEl.play().catch(() => {});
      }
    }
  };

  private handlePause = () => {
    if (this.backingAudioEl) {
      this.backingAudioEl.pause();
    }
    this.lineTakeAudioMap.forEach((audio) => {
      audio.pause();
    });
  };

  private handleSeek = () => {
    if (!this.videoEl) return;
    const currentTime = this.videoEl.currentTime;

    if (this.backingAudioEl) {
      this.backingAudioEl.currentTime = currentTime;
    }

    // Never restart a dubbed take while a microphone take is active.
    if (this.recordingActive) {
      this.lineTakeAudioMap.forEach((audio) => audio.pause());
      return;
    }

    // Stop and re-align takes
    this.lineTakeAudioMap.forEach((audio, lineId) => {
      const line = this.lines.find((l) => l.id === lineId);
      if (line) {
        if (currentTime >= line.startTime && currentTime < line.endTime) {
          const offset = currentTime - line.startTime;
          audio.currentTime = offset;
          if (!this.recordingActive && !this.videoEl?.paused) {
            audio.play().catch(() => {});
          }
        } else {
          audio.pause();
          audio.currentTime = 0;
        }
      }
    });
  };

  private handleTimeUpdate = () => {
    if (!this.videoEl || this.videoEl.paused) return;
    const currentTime = this.videoEl.currentTime;

    // Drift correction for backing audio track (keep within 150ms)
    if (this.backingAudioEl && !this.backingAudioEl.paused) {
      const diff = Math.abs(this.backingAudioEl.currentTime - currentTime);
      if (diff > 0.15) {
        this.backingAudioEl.currentTime = currentTime;
      }
    }

    // During a recording, keep the scene visible but do not play existing takes
    // into the microphone while the user is performing a retake.
    if (this.recordingActive) {
      this.lineTakeAudioMap.forEach((audio) => audio.pause());
      return;
    }

    // Check each line take trigger
    for (const line of this.lines) {
      const takeAudio = this.lineTakeAudioMap.get(line.id);
      const isWithinLine = currentTime >= line.startTime && currentTime <= line.endTime;

      if (takeAudio) {
        if (isWithinLine) {
          if (takeAudio.paused) {
            const offset = Math.max(0, currentTime - line.startTime);
            takeAudio.currentTime = offset;
            takeAudio.play().catch(() => {});
          }
        } else {
          if (!takeAudio.paused) {
            takeAudio.pause();
            takeAudio.currentTime = 0;
          }
        }
      }
    }

  };

  private handleEnded = () => {
    if (this.backingAudioEl) {
      this.backingAudioEl.pause();
      this.backingAudioEl.currentTime = 0;
    }
    this.lineTakeAudioMap.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
  };

  public destroy() {
    this.isDestroyed = true;
    if (this.videoEl) {
      this.videoEl.removeEventListener('play', this.handlePlay);
      this.videoEl.removeEventListener('pause', this.handlePause);
      this.videoEl.removeEventListener('seeking', this.handleSeek);
      this.videoEl.removeEventListener('timeupdate', this.handleTimeUpdate);
      this.videoEl.removeEventListener('ended', this.handleEnded);
    }
    if (this.backingAudioEl) {
      this.backingAudioEl.pause();
      this.backingAudioEl = null;
    }
    this.lineTakeAudioMap.forEach((audio) => {
      audio.pause();
    });
    this.lineTakeAudioMap.clear();
  }
}
