/**
 * Audio Recording and Live Metering Engine for Voiceoke Dubbing Studio.
 * Requests microphone only upon user action, measures live input level, and creates takes.
 */

export interface RecordingSession {
  mediaRecorder: MediaRecorder;
  audioChunks: Blob[];
  stream: MediaStream;
  analyser: AnalyserNode;
  audioContext: AudioContext;
  startTime: number;
}

export function isMicrophoneSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia;
}

export function getPreferredAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/wav',
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

/**
 * Starts microphone recording session with real-time level analyzer
 */
export async function startRecordingSession(onLevelUpdate?: (level: number) => void): Promise<{
  session: RecordingSession;
  stop: () => Promise<{ blob: Blob; duration: number }>;
}> {
  if (!isMicrophoneSupported()) {
    throw new Error('Microphone access is not supported in this browser or context.');
  }

  // Request audio permission only when recording starts
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (err: unknown) {
    if (err instanceof DOMException) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('Microphone permission was denied. Please allow microphone access in your browser address bar to record your voice.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        throw new Error('No audio input microphone was found connected to your computer.');
      }
    }
    throw new Error(`Microphone error: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Set up AudioContext for real-time visual meter
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;
  source.connect(analyser);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  let animationId = 0;

  const pollLevel = () => {
    analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const avg = sum / dataArray.length;
    // Map avg (0-255) to 0-100 percentage
    const normalized = Math.min(100, Math.round((avg / 128) * 100));
    if (onLevelUpdate) {
      onLevelUpdate(normalized);
    }
    animationId = requestAnimationFrame(pollLevel);
  };

  pollLevel();

  const mimeType = getPreferredAudioMimeType();
  const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const audioChunks: Blob[] = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      audioChunks.push(e.data);
    }
  };

  const startTime = performance.now();
  mediaRecorder.start(100);

  const session: RecordingSession = {
    mediaRecorder,
    audioChunks,
    stream,
    analyser,
    audioContext,
    startTime,
  };

  const stop = (): Promise<{ blob: Blob; duration: number }> => {
    return new Promise((resolve) => {
      cancelAnimationFrame(animationId);
      if (onLevelUpdate) onLevelUpdate(0);

      mediaRecorder.onstop = () => {
        const duration = (performance.now() - startTime) / 1000;
        const finalBlob = new Blob(audioChunks, { type: mimeType || 'audio/webm' });

        // Release hardware mic tracks
        stream.getTracks().forEach((track) => track.stop());
        audioContext.close().catch(() => {});

        resolve({ blob: finalBlob, duration });
      };

      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    });
  };

  return { session, stop };
}
