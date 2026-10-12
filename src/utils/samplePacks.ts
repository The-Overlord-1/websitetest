import JSZip from 'jszip';

/**
 * Generates an audio buffer with synth music / chime and converts to standard WAV Blob
 */
function createWavBlob(durationSeconds: number, type: 'synthwave' | 'vocal_a' | 'vocal_b' | 'beep'): Blob {
  const sampleRate = 44100;
  const numChannels = 1;
  const totalSamples = Math.floor(sampleRate * durationSeconds);
  const buffer = new Float32Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    if (type === 'synthwave') {
      // Cinematic bass pad + arpeggio
      const bass = Math.sin(2 * Math.PI * 55 * t) * 0.3;
      const sub = Math.sin(2 * Math.PI * 110 * t) * 0.15;
      const arpFreq = [220, 261.63, 329.63, 392][Math.floor(t * 4) % 4];
      const arp = Math.sin(2 * Math.PI * arpFreq * t) * 0.15 * (1 - (t % 0.25) * 3);
      // Kick pulse every 0.5s
      const beatPhase = t % 0.5;
      const kick = Math.sin(2 * Math.PI * (120 - beatPhase * 160) * beatPhase) * Math.exp(-beatPhase * 14) * 0.4;
      sample = bass + sub + arp + kick;
    } else if (type === 'vocal_a') {
      // Formant synthesis for female/higher voice
      const pitch = 220 + Math.sin(t * 8) * 15;
      const f1 = Math.sin(2 * Math.PI * pitch * t) * 0.3;
      const f2 = Math.sin(2 * Math.PI * (pitch * 2.5) * t) * 0.15;
      const env = Math.sin((Math.PI * t) / durationSeconds);
      sample = (f1 + f2) * env;
    } else if (type === 'vocal_b') {
      // Formant synthesis for deep/robotic voice
      const pitch = 110 + Math.sin(t * 4) * 10;
      const f1 = (Math.sin(2 * Math.PI * pitch * t) > 0 ? 0.3 : -0.3); // pulse wave
      const f2 = Math.sin(2 * Math.PI * (pitch * 3) * t) * 0.1;
      const env = Math.sin((Math.PI * t) / durationSeconds);
      sample = (f1 + f2) * env * 0.4;
    } else {
      sample = Math.sin(2 * Math.PI * 880 * t) * 0.2 * Math.exp(-t * 8);
    }

    buffer[i] = Math.max(-1, Math.min(1, sample));
  }

  // Encode PCM 16-bit WAV
  const wavHeaderSize = 44;
  const wavBuffer = new ArrayBuffer(wavHeaderSize + totalSamples * 2);
  const view = new DataView(wavBuffer);

  const writeString = (offset: number, string: string) => {
    for (let j = 0; j < string.length; j++) {
      view.setUint8(offset + j, string.charCodeAt(j));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, totalSamples * 2, true);

  let offset = 44;
  for (let k = 0; k < totalSamples; k++) {
    const s = Math.max(-1, Math.min(1, buffer[k]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

/**
 * Creates a canvas-rendered animated video stream and records it to WebM video Blob
 */
async function createAnimatedVideoBlob(
  title: string,
  durationSeconds: number,
  theme: 'cyberpunk' | 'noir'
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d')!;

  const fps = 30;
  const totalFrames = Math.floor(durationSeconds * fps);
  const stream = canvas.captureStream(fps);

  // Check supported MIME type
  let mimeType = 'video/webm;codecs=vp8';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm';
  }

  const mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1000000 });
  const chunks: Blob[] = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const recordingPromise = new Promise<Blob>((resolve) => {
    mediaRecorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType }));
    };
  });

  mediaRecorder.start();

  let frame = 0;
  return new Promise<Blob>((resolveAll) => {
    const renderInterval = setInterval(() => {
      const progress = frame / totalFrames;
      const currentTime = frame / fps;

      // Background
      if (theme === 'cyberpunk') {
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, '#090d16');
        grad.addColorStop(1, '#1b0e2b');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Grid lines
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)';
        ctx.lineWidth = 1;
        const gridOffset = (frame * 1.5) % 40;
        for (let x = 0; x < canvas.width; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
        for (let y = gridOffset; y < canvas.height; y += 40) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }

        // Cyber scan glow bar
        ctx.fillStyle = 'rgba(236, 72, 153, 0.2)';
        ctx.fillRect(0, (frame * 3) % canvas.height, canvas.width, 4);

        // Animated target reticle
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const rx = canvas.width / 2 + Math.sin(currentTime * 1.5) * 60;
        const ry = canvas.height / 2 + Math.cos(currentTime * 1.2) * 30;
        ctx.arc(rx, ry, 28, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(rx - 2, ry - 2, 4, 4);
      } else {
        // Film Noir
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Venetian blinds light effect
        ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
        for (let i = 0; i < canvas.height; i += 32) {
          ctx.fillRect(0, i, canvas.width, 16);
        }

        // Film grain simulation
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        for (let p = 0; p < 80; p++) {
          ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
        }

        // Cinematic silhouette circle
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, 90, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Cinematic Title & Timecode Burn-In
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(title.toUpperCase(), 32, 48);

      ctx.fillStyle = '#9ca3af';
      ctx.font = '12px monospace';
      ctx.fillText(`SCENE DURATION: ${durationSeconds.toFixed(1)}S  ·  FPS: 30.00`, 32, 70);

      // Current Timecode box
      const mm = Math.floor(currentTime / 60).toString().padStart(2, '0');
      const ss = Math.floor(currentTime % 60).toString().padStart(2, '0');
      const ff = Math.floor((currentTime % 1) * 30).toString().padStart(2, '0');
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(canvas.width - 150, 24, 120, 32);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(canvas.width - 150, 24, 120, 32);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`TC ${mm}:${ss}:${ff}`, canvas.width - 140, 46);

      // Progress bar at bottom
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(0, canvas.height - 6, canvas.width, 6);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(0, canvas.height - 6, canvas.width * progress, 6);

      frame++;
      if (frame >= totalFrames) {
        clearInterval(renderInterval);
        mediaRecorder.stop();
        recordingPromise.then((b) => resolveAll(b));
      }
    }, 1000 / fps);
  });
}

/**
 * Creates a simple colored character icon PNG
 */
function createCharacterIconPng(label: string, bgColor: string): Blob {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label.slice(0, 2).toUpperCase(), 64, 64);

  // Return base64 or blob synchronously via dataURL
  const dataUrl = canvas.toDataURL('image/png');
  const byteString = atob(dataUrl.split(',')[1]);
  const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

export interface SamplePackDescriptor {
  id: string;
  name: string;
  genre: string;
  author: string;
  duration: number;
  description: string;
  characters: string[];
  lineCount: number;
}

export const SAMPLE_PACK_DESCRIPTORS: SamplePackDescriptor[] = [
  {
    id: 'cyberpunk',
    name: 'The Neon Protocol',
    genre: 'Sci-Fi Cyberpunk',
    author: 'Voiceoke Studios',
    duration: 12.0,
    description: 'A high-stakes security breach inside an orbital server bank. Fast-paced banter between rogue hacker Cipher and tactical combat android Unit 7.',
    characters: ['Cipher', 'Unit 7'],
    lineCount: 4,
  },
  {
    id: 'noir',
    name: 'Midnight in Casablanca',
    genre: 'Classic Film Noir',
    author: 'Cinematics Guild',
    duration: 14.0,
    description: 'A shadowy confrontation under flickering streetlights. Hardboiled detective Vance presses smuggler Margot on the missing cipher documents.',
    characters: ['Detective Vance', 'Margot'],
    lineCount: 4,
  },
];

/**
 * Builds an authentic Choicer Voicer ZIP archive with _pack_info.ini,
 * video, backing track WAV, and line .ini files + line reference WAVs.
 */
export async function generateChoicerVoicerZip(packId: 'cyberpunk' | 'noir'): Promise<File> {
  const zip = new JSZip();

  if (packId === 'cyberpunk') {
    const duration = 12.0;

    // 1. _pack_info.ini
    const packInfoContent = `[General]
Title=The Neon Protocol
Author=Voiceoke Studios
Readme=Rogue hacker Cipher and android Unit 7 infiltrate the central data core.
Icon=icon.png
dub_video=dub_video.webm
_backing_track=_backing_track.wav
dub_characters=["Cipher", "Unit 7"]
dub_timestamps=[1.20, 4.20, 7.40, 10.00]
dub_durations=[2.80, 2.90, 2.40, 2.00]
Dub_Type=Scene
`;
    zip.file('_pack_info.ini', packInfoContent);

    // 2. Video file (WebM)
    const videoBlob = await createAnimatedVideoBlob('The Neon Protocol', duration, 'cyberpunk');
    zip.file('dub_video.webm', videoBlob);

    // 3. Backing track (_backing_track.wav)
    const backingBlob = createWavBlob(duration, 'synthwave');
    zip.file('_backing_track.wav', backingBlob);

    // 4. Character Icons & Pack Icon
    zip.file('icon.png', createCharacterIconPng('NP', '#8b5cf6'));
    zip.file('cipher.png', createCharacterIconPng('CP', '#f59e0b'));
    zip.file('unit_7.png', createCharacterIconPng('U7', '#3b82f6'));

    // 5. Line 1: Cipher
    zip.file(
      '01_cipher_breach.ini',
      `[General]
Character=Cipher
Caption=Sub-level firewall is cracking. We have forty seconds before trace lockdown!
Timestamp=1.20
StartTime=1.20
EndTime=4.00
Audio=01_cipher_breach.wav
`
    );
    zip.file('01_cipher_breach.wav', createWavBlob(2.8, 'vocal_a'));

    // 6. Line 2: Unit 7
    zip.file(
      '02_unit7_warning.ini',
      `[General]
Character=Unit 7
Caption=Forty seconds is insufficient. Hostile counter-intrusion drones have deployed in Sector 4.
Timestamp=4.20
StartTime=4.20
EndTime=7.10
Audio=02_unit7_warning.wav
`
    );
    zip.file('02_unit7_warning.wav', createWavBlob(2.9, 'vocal_b'));

    // 7. Line 3: Cipher
    zip.file(
      '03_cipher_bypass.ini',
      `[General]
Character=Cipher
Caption=Then buy me some time, partner! Rerouting the optic junction right now!
Timestamp=7.40
StartTime=7.40
EndTime=9.80
Audio=03_cipher_bypass.wav
`
    );
    zip.file('03_cipher_bypass.wav', createWavBlob(2.4, 'vocal_a'));

    // 8. Line 4: Unit 7
    zip.file(
      '04_unit7_engage.ini',
      `[General]
Character=Unit 7
Caption=Kinetic barriers engaged. Extract the data core and do not look back.
Timestamp=10.00
StartTime=10.00
EndTime=12.00
Audio=04_unit7_engage.wav
`
    );
    zip.file('04_unit7_engage.wav', createWavBlob(2.0, 'vocal_b'));

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    return new File([zipBlob], 'The_Neon_Protocol_Choicer_Voicer_Pack.zip', { type: 'application/zip' });
  } else {
    // Noir Scene Pack
    const duration = 14.0;

    const packInfoContent = `[General]
Title=Midnight in Casablanca
Author=Cinematics Guild
Readme=A shadowy interrogation on rainy cobblestones.
Icon=icon.png
dub_video=dub_video.webm
_backing_track=_backing_track.wav
dub_characters=["Detective Vance", "Margot"]
dub_timestamps=[1.00, 4.50, 8.10, 11.20]
dub_durations=[3.20, 3.30, 2.80, 2.60]
Dub_Type=Scene
`;
    zip.file('_pack_info.ini', packInfoContent);

    const videoBlob = await createAnimatedVideoBlob('Midnight in Casablanca', duration, 'noir');
    zip.file('dub_video.webm', videoBlob);

    const backingBlob = createWavBlob(duration, 'synthwave');
    zip.file('_backing_track.wav', backingBlob);

    zip.file('icon.png', createCharacterIconPng('MC', '#1f2937'));
    zip.file('detective_vance.png', createCharacterIconPng('DV', '#f97316'));
    zip.file('margot.png', createCharacterIconPng('MG', '#ec4899'));

    zip.file(
      '01_vance_intro.ini',
      `[General]
Character=Detective Vance
Caption=You picked a stormy night for a midnight stroll along the docks, Margot.
Timestamp=1.00
StartTime=1.00
EndTime=4.20
Audio=01_vance_intro.wav
`
    );
    zip.file('01_vance_intro.wav', createWavBlob(3.2, 'vocal_b'));

    zip.file(
      '02_margot_reply.ini',
      `[General]
Character=Margot
Caption=A lady needs fresh air, Vance. Even when the harbor smells of cheap tobacco.
Timestamp=4.50
StartTime=4.50
EndTime=7.80
Audio=02_margot_reply.wav
`
    );
    zip.file('02_margot_reply.wav', createWavBlob(3.3, 'vocal_a'));

    zip.file(
      '03_vance_papers.ini',
      `[General]
Character=Detective Vance
Caption=Cut the banter. Where are the blueprints? The last ferry departs at midnight.
Timestamp=8.10
StartTime=8.10
EndTime=10.90
Audio=03_vance_papers.wav
`
    );
    zip.file('03_vance_papers.wav', createWavBlob(2.8, 'vocal_b'));

    zip.file(
      '04_margot_deal.ini',
      `[General]
Character=Margot
Caption=They are safe. But the price doubled the moment your men showed up.
Timestamp=11.20
StartTime=11.20
EndTime=13.80
Audio=04_margot_deal.wav
`
    );
    zip.file('04_margot_deal.wav', createWavBlob(2.6, 'vocal_a'));

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    return new File([zipBlob], 'Midnight_in_Casablanca_Choicer_Voicer_Pack.zip', { type: 'application/zip' });
  }
}

/**
 * Creates an intentionally invalid/unsupported pack to demonstrate diagnostics and error reporting
 */
export async function generateDiagnosticTestZip(
  type: 'empty' | 'missing_video' | 'missing_lines' | 'ogv_legacy' | 'nested_folder'
): Promise<File> {
  const zip = new JSZip();

  if (type === 'nested_folder') {
    zip.file(
      'custom_pack_folder/subfolder/_pack_info.ini',
      `[General]\nTitle=Deeply Nested Scene\nAuthor=Studio Explorer\ndub_video=subfolder_video.webm\nCharacters=Agent\n`
    );
    const vid = await createAnimatedVideoBlob('Deeply Nested Scene', 4, 'cyberpunk');
    zip.file('custom_pack_folder/assets/media/subfolder_video.webm', vid);
    zip.file(
      'custom_pack_folder/subfolder/lines/01_intro.ini',
      `[General]\nCharacter=Agent\nCaption=Deeply nested directory structure parsed with zero issues!\nTimestamp=0.8\nEndTime=3.6\n`
    );
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    return new File([zipBlob], 'test_pack_nested_folders.zip', { type: 'application/zip' });
  }

  if (type === 'empty') {
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    return new File([zipBlob], 'corrupt_empty_pack.zip', { type: 'application/zip' });
  }

  if (type === 'missing_video') {
    zip.file(
      '_pack_info.ini',
      `[General]\nTitle=Scene With No Video\nAuthor=Test User\nCharacters=Hero\n`
    );
    zip.file(
      '01_test.ini',
      `[General]\nCharacter=Hero\nCaption=Where is my movie?\nTimestamp=1.0\n`
    );
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    return new File([zipBlob], 'test_pack_missing_video.zip', { type: 'application/zip' });
  }

  if (type === 'missing_lines') {
    zip.file('_pack_info.ini', `[General]\nTitle=Video Only Pack\nAuthor=Silent\n`);
    const vid = await createAnimatedVideoBlob('Silent Video', 3, 'noir');
    zip.file('dub_video.webm', vid);
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    return new File([zipBlob], 'test_pack_no_lines.zip', { type: 'application/zip' });
  }

  // ogv_legacy
  zip.file('_pack_info.ini', `[General]\nTitle=Legacy Ogg Theora Pack\nAuthor=Old Engine\nCharacters=Hero\n`);
  zip.file('01_line.ini', `[General]\nCharacter=Hero\nCaption=I was encoded in 2008.\nTimestamp=0.5\nEndTime=2.5\n`);
  // Dummy file named .ogv to trigger format diagnostics
  zip.file('dub_video.ogv', new Blob(['OggS dummy bitstream'], { type: 'video/ogg' }));
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return new File([zipBlob], 'test_pack_legacy_theora.zip', { type: 'application/zip' });
}
