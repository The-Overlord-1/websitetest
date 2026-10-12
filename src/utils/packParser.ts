import JSZip from 'jszip';
import {
  ParsedScenePack,
  SceneCharacter,
  DialogueLine,
  ArchiveFileEntry,
  ValidationIssue,
  PackValidationReport,
} from '../types/pack';
import {
  parseIni,
  getIniValue,
  getIniValueWithAliases,
  parseIniArray,
  parseTimestamp,
  ParsedIni,
} from './iniParser';

// Character color palette for cinematic contrast
const CHARACTER_PALETTE = [
  '#f59e0b', // Amber
  '#3b82f6', // Cobalt Blue
  '#10b981', // Emerald
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#e11d48', // Rose
];

/**
 * Normalizes file path inside zip (removes leading slash, converts backslashes)
 */
function cleanZipPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '');
}

/**
 * Filter out macOS metadata artifacts and junk files
 */
function isIgnoredSystemFile(path: string): boolean {
  const normalized = cleanZipPath(path);
  return (
    normalized.startsWith('__MACOSX/') ||
    normalized.includes('/.DS_Store') ||
    normalized.endsWith('.DS_Store') ||
    normalized.endsWith('Thumbs.db')
  );
}

/**
 * Safely determines mime type from filename
 */
function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'ogv':
    case 'ogg':
      return 'video/ogg';
    case 'mov':
      return 'video/quicktime';
    case 'm4v':
      return 'video/mp4';
    case 'mkv':
      return 'video/x-matroska';
    case 'avi':
      return 'video/x-msvideo';
    case 'wav':
      return 'audio/wav';
    case 'mp3':
      return 'audio/mpeg';
    case 'm4a':
      return 'audio/mp4';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Categorize a file based on extension and filename pattern
 */
function categorizeFile(path: string): ArchiveFileEntry['category'] {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  if (['mp4', 'webm', 'ogv', 'ogg', 'mov', 'mkv', 'm4v', 'avi'].includes(ext)) return 'video';
  if (['wav', 'mp3', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) return 'audio';
  if (ext === 'ini') return 'ini';
  if (ext === 'json') return 'json';
  if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext)) return 'image';
  if (['txt', 'srt', 'vtt', 'md', 'csv', 'tsv'].includes(ext)) return 'text';
  return 'other';
}

/**
 * Helper to get the filename component of a path
 */
function getBaseName(path: string): string {
  return path.split('/').pop() || path;
}

/**
 * Helper to natural-sort strings with numbers (e.g. 1, 2, 10 instead of 1, 10, 2)
 */
function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Parse an SRT/VTT subtitle file into dialogue lines
 */
function parseSrtSubtitles(srtText: string): Array<{ character: string; text: string; start: number; end: number }> {
  const results: Array<{ character: string; text: string; start: number; end: number }> = [];
  const blocks = srtText.replace(/\r/g, '').split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    const timeLineIndex = lines[0].includes('-->') ? 0 : lines[1]?.includes('-->') ? 1 : -1;
    if (timeLineIndex === -1) continue;

    const timeLine = lines[timeLineIndex];
    const [startRaw, endRaw] = timeLine.split('-->').map((s) => s.trim());

    const parseSrtTime = (t: string) => {
      const parts = t.replace(',', '.').split(':');
      if (parts.length === 3) {
        return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
      } else if (parts.length === 2) {
        return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
      }
      return 0;
    };

    const start = parseSrtTime(startRaw);
    const end = parseSrtTime(endRaw);

    const textLines = lines.slice(timeLineIndex + 1).join(' ').trim();
    if (!textLines) continue;

    let character = 'Speaker';
    let text = textLines;

    const charMatch = textLines.match(/^\[?([A-Za-z0-9 _\-]+)\]?\s*:\s*(.*)$/);
    if (charMatch) {
      character = charMatch[1].trim();
      text = charMatch[2].trim();
    }

    results.push({ character, text, start, end: Math.max(end, start + 1) });
  }

  return results;
}

/**
 * Check if a browser can play a given video MIME type
 */
function testBrowserVideoSupport(mimeType: string, fileName: string): {
  canPlay: boolean;
  note?: string;
} {
  if (typeof document === 'undefined') return { canPlay: true };
  const v = document.createElement('video');
  const support = v.canPlayType(mimeType);

  if (fileName.toLowerCase().endsWith('.ogv') || mimeType === 'video/ogg') {
    if (support === '') {
      return {
        canPlay: false,
        note: `The video "${fileName}" uses Ogg Theora (.ogv). Modern browser engines (Google Chrome, Microsoft Edge, Safari) do not have built-in Ogg Theora decoders. The dialogue timeline and audio tracks will work, but the video requires converting to MP4 (H.264) or WebM.`,
      };
    }
  }

  if (support === '') {
    return {
      canPlay: false,
      note: `The browser video engine cannot decode "${fileName}" (${mimeType}).`,
    };
  }

  return { canPlay: true };
}

/**
 * Main parser for user-imported ZIP archives.
 * Inspects format, handles nested folder structures, extracts media safely into local Blob URLs,
 * and parses Choicer Voicer INI files, arrays, and line files.
 */
export async function parseScenePackZip(file: File): Promise<ParsedScenePack> {
  const issues: ValidationIssue[] = [];
  let zip: JSZip;

  try {
    zip = await JSZip.loadAsync(file);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown ZIP error';
    throw new Error(`Unable to read ZIP archive. The file may be corrupted or password-protected: ${message}`);
  }

  // 1. Audit archive file list & filter macOS junk
  const archiveEntries: ArchiveFileEntry[] = [];
  const rawFiles: Record<string, JSZip.JSZipObject> = {};

  zip.forEach((relativePath, zipEntry) => {
    if (zipEntry.dir || isIgnoredSystemFile(relativePath)) return;
    const normalized = cleanZipPath(relativePath);
    rawFiles[normalized] = zipEntry;

    // @ts-expect-error JSZip internal _data uncompressedSize
    const uncompressedSize = zipEntry._data?.uncompressedSize || 0;

    archiveEntries.push({
      path: normalized,
      name: getBaseName(normalized),
      size: uncompressedSize,
      category: categorizeFile(normalized),
      status: 'valid',
    });
  });

  if (archiveEntries.length === 0) {
    throw new Error('The ZIP archive is empty. Please select a valid Choicer Voicer scene pack.');
  }

  const fileKeys = Object.keys(rawFiles);

  // -------------------------------------------------------------
  // TEMPORARY DEVELOPMENT LOGGING (as explicitly requested)
  // -------------------------------------------------------------
  console.group('🎙️ [Voiceoke Pack Inspector]');
  console.info(`Inspecting ZIP: "${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
  console.info(`Total Archive Files Found: ${archiveEntries.length}`);
  console.table(
    archiveEntries.map((e) => ({
      Path: e.path,
      Name: e.name,
      Category: e.category,
      SizeKB: (e.size / 1024).toFixed(1),
    }))
  );
  // -------------------------------------------------------------

  // Helper to find file by predicate anywhere in archive
  const findKey = (predicate: (path: string, base: string) => boolean): string | undefined => {
    return fileKeys.find((k) => predicate(k, getBaseName(k)));
  };

  const findAllKeys = (predicate: (path: string, base: string) => boolean): string[] => {
    return fileKeys.filter((k) => predicate(k, getBaseName(k)));
  };

  // 2. Identify Metadata Files (regardless of directory nesting)
  const packInfoIniKey = findKey((_, base) => /^_?pack_?info\.ini$/i.test(base)) ||
    findKey((_, base) => /^_?dub_?info\.ini$/i.test(base)) ||
    findKey((_, base) => /^(pack|dub|scene|info)\.ini$/i.test(base));

  const packJsonKey = findKey((_, base) => /^(pack|data|scene|manifest|dubbooth)\.json$/i.test(base));
  const srtKeys = findAllKeys((_, base) => /\.(srt|vtt)$/i.test(base));

  // Determine detected format
  let formatDetected: ParsedScenePack['formatDetected'] = 'unknown' as any;
  let formatName = 'Unknown Pack Format';

  if (packInfoIniKey) {
    formatDetected = 'choicer-voicer-ini';
    formatName = 'Choicer Voicer (Standard INI Pack)';
  } else if (packJsonKey) {
    formatDetected = 'choicer-voicer-json';
    formatName = 'DubBooth / Choicer Voicer (JSON Pack)';
  } else if (srtKeys.length > 0) {
    formatDetected = 'subtitles-media';
    formatName = 'Video & Subtitles Dub Pack';
  } else {
    // Check if there are individual line INI files
    const lineInis = findAllKeys((_, base) => base.toLowerCase().endsWith('.ini'));
    if (lineInis.length > 0) {
      formatDetected = 'choicer-voicer-ini';
      formatName = 'Choicer Voicer (Multi-File INI Pack)';
    } else {
      formatDetected = 'custom';
      formatName = 'Standalone Media Archive';
    }
  }

  console.info(`Detected Pack Format: ${formatName} (Key: ${packInfoIniKey || packJsonKey || 'None'})`);

  // 3. Parse Metadata Header (if INI or JSON present)
  let title = file.name.replace(/\.zip$/i, '').replace(/[_-]+/g, ' ');
  let author = 'Unknown Creator';
  let description = '';
  let declaredVideoName = '';
  let declaredBackingTrack = '';
  let declaredIconName = '';
  let parsedPackInfoIni: ParsedIni | null = null;

  const characterMap = new Map<string, SceneCharacter>();
  const getOrAddCharacter = (name: string, avatarUrl?: string): SceneCharacter => {
    const cleanName = (name || 'Actor').trim();
    const id = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (!characterMap.has(id)) {
      const colorIndex = characterMap.size % CHARACTER_PALETTE.length;
      characterMap.set(id, {
        id,
        name: cleanName,
        color: CHARACTER_PALETTE[colorIndex],
        avatarUrl,
      });
    }
    return characterMap.get(id)!;
  };

  // Helper to extract character avatar image if matching file exists
  const findAvatarUrl = async (name: string): Promise<string | undefined> => {
    const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const imgKey = findKey((k, base) => {
      if (categorizeFile(k) !== 'image') return false;
      const baseClean = base.split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      return baseClean === safeName;
    });
    if (imgKey) {
      const blob = await rawFiles[imgKey].async('blob');
      return URL.createObjectURL(new Blob([blob], { type: getMimeType(imgKey) }));
    }
    return undefined;
  };

  if (packInfoIniKey) {
    try {
      const iniText = await rawFiles[packInfoIniKey].async('text');
      parsedPackInfoIni = parseIni(iniText);

      title =
        getIniValueWithAliases(parsedPackInfoIni, ['Title', 'PackTitle', 'Pack_Title', 'Name']) ||
        title;
      author =
        getIniValueWithAliases(parsedPackInfoIni, ['Author', 'Creator', 'PackAuthor', 'Credits']) ||
        author;
      description =
        getIniValueWithAliases(parsedPackInfoIni, ['Readme', 'Description', 'Info', 'Notes']) ||
        '';

      declaredVideoName = getIniValueWithAliases(parsedPackInfoIni, [
        'dub_video',
        'video',
        'video_file',
        'movie',
        'clip',
      ]);

      declaredBackingTrack = getIniValueWithAliases(parsedPackInfoIni, [
        '_backing_track',
        'backing_track',
        'dub_audio',
        'audio',
        'music',
        'instrumental',
      ]);

      declaredIconName = getIniValueWithAliases(parsedPackInfoIni, ['Icon', 'Thumbnail', 'Image']);

      // Pre-register declared characters
      const declaredCharsRaw = getIniValueWithAliases(parsedPackInfoIni, [
        'dub_characters',
        'characters',
        'character_list',
        'cast',
      ]);
      if (declaredCharsRaw) {
        const declaredList = parseIniArray(declaredCharsRaw);
        for (const c of declaredList) {
          const av = await findAvatarUrl(c);
          getOrAddCharacter(c, av);
        }
      }
    } catch (err) {
      console.warn('Error reading pack info ini:', err);
      issues.push({
        severity: 'warning',
        code: 'INI_HEADER_ERROR',
        message: `Failed to parse metadata in ${packInfoIniKey}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // 4. Video File Resolution (Handle any folder depth and extensions)
  let chosenVideoKey: string | undefined;

  // Attempt 1: Check declared video filename
  if (declaredVideoName) {
    const cleanDeclared = getBaseName(declaredVideoName).toLowerCase();
    chosenVideoKey = findKey((_, base) => base.toLowerCase() === cleanDeclared);
  }

  // Attempt 2: Search for any file named dub_video.*
  if (!chosenVideoKey) {
    const dubVideoCandidates = findAllKeys((_, base) => {
      const b = base.toLowerCase();
      return (
        (b.includes('dub_video') || b.includes('dubvideo') || b.startsWith('dub_')) &&
        /\.(mp4|webm|ogv|ogg|mov|m4v|mkv|avi)$/i.test(b)
      );
    });

    if (dubVideoCandidates.length > 0) {
      // Prioritize browser playable formats: MP4 > WebM > MOV > OGV
      const formatPriority = ['.mp4', '.webm', '.mov', '.m4v', '.ogv', '.ogg', '.mkv', '.avi'];
      dubVideoCandidates.sort((a, b) => {
        const extA = a.substring(a.lastIndexOf('.')).toLowerCase();
        const extB = b.substring(b.lastIndexOf('.')).toLowerCase();
        return formatPriority.indexOf(extA) - formatPriority.indexOf(extB);
      });
      chosenVideoKey = dubVideoCandidates[0];
    }
  }

  // Attempt 3: Search for ANY video file in the entire ZIP archive
  if (!chosenVideoKey) {
    const allVideoCandidates = findAllKeys((k) => categorizeFile(k) === 'video');
    if (allVideoCandidates.length > 0) {
      const formatPriority = ['.mp4', '.webm', '.mov', '.m4v', '.ogv', '.ogg', '.mkv', '.avi'];
      allVideoCandidates.sort((a, b) => {
        const extA = a.substring(a.lastIndexOf('.')).toLowerCase();
        const extB = b.substring(b.lastIndexOf('.')).toLowerCase();
        return formatPriority.indexOf(extA) - formatPriority.indexOf(extB);
      });
      chosenVideoKey = allVideoCandidates[0];
    }
  }

  console.info(`Selected Scene Video File: ${chosenVideoKey || 'NONE FOUND'}`);

  let videoBlobUrl = '';
  let videoFileName = '';
  let videoMimeType = '';
  let videoCodecNote = '';

  if (chosenVideoKey) {
    videoFileName = getBaseName(chosenVideoKey);
    videoMimeType = getMimeType(videoFileName);

    try {
      const videoEntry = rawFiles[chosenVideoKey];
      const videoBlob = await videoEntry.async('blob');
      // Create explicit typed Blob and local browser Object URL
      videoBlobUrl = URL.createObjectURL(new Blob([videoBlob], { type: videoMimeType }));

      // Codec test
      const codecTest = testBrowserVideoSupport(videoMimeType, videoFileName);
      if (!codecTest.canPlay) {
        videoCodecNote = codecTest.note || '';
        issues.push({
          severity: 'warning',
          code: 'UNSUPPORTED_VIDEO_CODEC',
          message: codecTest.note || `Browser cannot natively decode ${videoFileName}.`,
          filePath: chosenVideoKey,
          fixSuggestion: 'Convert the scene video to H.264 MP4 or WebM for universal browser playback.',
        });
      }
    } catch (err) {
      console.error('Failed to extract video blob:', err);
      issues.push({
        severity: 'error',
        code: 'VIDEO_EXTRACTION_FAILED',
        message: `Failed to extract video file "${videoFileName}" from archive.`,
      });
    }
  } else {
    issues.push({
      severity: 'error',
      code: 'NO_VIDEO_FOUND',
      message: 'No video file (.mp4, .webm, .ogv, .mov) was found in the scene pack.',
      fixSuggestion: 'Ensure the ZIP includes a dub_video.mp4 or dub_video.webm clip.',
    });
  }

  // 5. Backing Track Resolution
  let backingTrackKey = declaredBackingTrack
    ? findKey((_, base) => base.toLowerCase() === getBaseName(declaredBackingTrack).toLowerCase())
    : undefined;

  if (!backingTrackKey) {
    backingTrackKey = findKey((_, base) =>
      /^(_?backing_track|dub_audio|instrumental|bgm|music)\.(wav|mp3|ogg|m4a)$/i.test(base)
    );
  }

  let backingTrackBlobUrl: string | undefined;
  let backingTrackFileName: string | undefined;

  if (backingTrackKey) {
    backingTrackFileName = getBaseName(backingTrackKey);
    try {
      const backingBlob = await rawFiles[backingTrackKey].async('blob');
      backingTrackBlobUrl = URL.createObjectURL(
        new Blob([backingBlob], { type: getMimeType(backingTrackFileName) })
      );
      console.info(`Backing Audio Track: ${backingTrackKey}`);
    } catch (err) {
      console.warn('Failed to extract backing track:', err);
    }
  }

  // 6. Icon Resolution
  let iconUrl: string | undefined;
  let iconKey = declaredIconName
    ? findKey((_, base) => base.toLowerCase() === getBaseName(declaredIconName).toLowerCase())
    : undefined;
  if (!iconKey) {
    iconKey = findKey((_, base) => /^(_?pack_?icon|icon|thumb|poster)\.(png|jpg|jpeg|webp)$/i.test(base));
  }
  if (iconKey) {
    try {
      const iconBlob = await rawFiles[iconKey].async('blob');
      iconUrl = URL.createObjectURL(new Blob([iconBlob], { type: getMimeType(iconKey) }));
    } catch {
      // Ignore icon errors
    }
  }

  // 7. Dialogue Line Extraction (Comprehensive Multi-Format Strategy)
  const lines: DialogueLine[] = [];

  // Helper to find audio clip for a line
  const findCompanionAudio = async (
    lineIndex: number,
    declaredAudio?: string,
    companionBaseName?: string
  ): Promise<{ audioUrl?: string; audioName?: string }> => {
    let matchedKey: string | undefined;

    // 1. Check explicitly declared audio
    if (declaredAudio) {
      const clean = getBaseName(declaredAudio).toLowerCase();
      matchedKey = findKey((_, base) => base.toLowerCase() === clean);
    }

    // 2. Check matching companion basename
    if (!matchedKey && companionBaseName) {
      matchedKey = findKey((k, base) => {
        if (categorizeFile(k) !== 'audio') return false;
        const b = base.substring(0, base.lastIndexOf('.')).toLowerCase();
        return b === companionBaseName.toLowerCase();
      });
    }

    // 3. Check numbered prefix matching lineIndex + 1 (e.g. 01_something.wav or 1.wav)
    if (!matchedKey) {
      const numStr = (lineIndex + 1).toString();
      const paddedStr = numStr.padStart(2, '0');
      matchedKey = findKey((k, base) => {
        if (categorizeFile(k) !== 'audio') return false;
        // Don't match backing track
        if (base.toLowerCase().includes('backing_track') || base.toLowerCase().includes('dub_audio')) {
          return false;
        }
        const b = base.toLowerCase();
        return (
          b.startsWith(`${paddedStr}_`) ||
          b.startsWith(`${paddedStr}.`) ||
          b.startsWith(`${numStr}_`) ||
          b.startsWith(`${numStr}.`)
        );
      });
    }

    if (matchedKey) {
      try {
        const audioBlob = await rawFiles[matchedKey].async('blob');
        const audioUrl = URL.createObjectURL(
          new Blob([audioBlob], { type: getMimeType(matchedKey) })
        );
        return { audioUrl, audioName: getBaseName(matchedKey) };
      } catch {
        return {};
      }
    }

    return {};
  };

  // STRATEGY A: Check if lines are stored as arrays or sections inside _pack_info.ini
  if (parsedPackInfoIni) {
    // A1: Check for parallel arrays (dub_timestamps, dub_characters, dub_captions, dub_durations)
    const timestampsRaw = getIniValueWithAliases(parsedPackInfoIni, [
      'dub_timestamps',
      'timestamps',
      'timeline',
      'times',
    ]);
    const charactersRaw = getIniValueWithAliases(parsedPackInfoIni, [
      'dub_characters',
      'characters',
      'speakers',
    ]);
    const captionsRaw = getIniValueWithAliases(parsedPackInfoIni, [
      'dub_captions',
      'captions',
      'subtitles',
      'lines',
      'dialogue',
    ]);
    const durationsRaw = getIniValueWithAliases(parsedPackInfoIni, [
      'dub_durations',
      'durations',
      'lengths',
    ]);

    if (timestampsRaw) {
      const timestampList = parseIniArray(timestampsRaw).map((t) => parseTimestamp(t));
      const characterList = parseIniArray(charactersRaw);
      const captionList = parseIniArray(captionsRaw);
      const durationList = parseIniArray(durationsRaw).map((d) => parseTimestamp(d));

      if (timestampList.length > 0) {
        console.info(
          `Found parallel arrays in pack_info.ini: ${timestampList.length} timestamps, ${captionList.length} captions.`
        );

        for (let i = 0; i < timestampList.length; i++) {
          const startTime = timestampList[i];
          const charName = characterList[i] || 'Actor';
          const dur = durationList[i] || 3.0;
          const endTime = startTime + dur;

          let caption = captionList[i] || '';

          // If caption is empty, check if there's a numbered .txt or .ini file for this line
          if (!caption) {
            const lineNum = (i + 1).toString().padStart(2, '0');
            const companionTxtKey = findKey(
              (k, base) =>
                categorizeFile(k) === 'text' &&
                (base.startsWith(`${lineNum}_`) || base.startsWith(`${lineNum}.`))
            );
            if (companionTxtKey) {
              try {
                const txt = await rawFiles[companionTxtKey].async('text');
                caption = txt.trim();
              } catch {}
            }
          }

          const { audioUrl, audioName } = await findCompanionAudio(i);
          const av = await findAvatarUrl(charName);
          getOrAddCharacter(charName, av);

          lines.push({
            id: `line_${i + 1}`,
            lineNumber: i + 1,
            character: charName,
            text: caption || `(Line ${i + 1})`,
            startTime,
            endTime,
            originalAudioUrl: audioUrl,
            originalAudioName: audioName,
          });
        }
      }
    }

    // A2: Check for line sections in pack_info.ini (e.g. [Line_0], [Line_1], [01], [Dub_0])
    if (lines.length === 0) {
      const lineSectionNames = Object.keys(parsedPackInfoIni.sections).filter((sec) =>
        /^(line|clip|dub|dialogue|sub|segment)[\s._-]?\d+$/i.test(sec) || /^\d+$/i.test(sec)
      );

      if (lineSectionNames.length > 0) {
        // Sort sections numerically
        lineSectionNames.sort(naturalSort);
        console.info(`Found ${lineSectionNames.length} line sections in pack_info.ini.`);

        for (let idx = 0; idx < lineSectionNames.length; idx++) {
          const secName = lineSectionNames[idx];
          const sec = parsedPackInfoIni.sections[secName];

          const charName =
            sec.character || sec.char || sec.speaker || sec.actor || sec.dub_characters || sec.voice || 'Actor';
          const caption =
            sec.caption || sec.text || sec.subtitle || sec.line || sec.dialogue || sec.quote || '';

          const startTime = parseTimestamp(
            sec.timestamp || sec.starttime || sec.start || sec.time || sec.offset || sec.dub_timestamps
          );
          let endTime = parseTimestamp(sec.endtime || sec.end);
          const duration = parseTimestamp(sec.duration || sec.length || sec.dub_durations);

          if (endTime <= startTime && duration > 0) {
            endTime = startTime + duration;
          } else if (endTime <= startTime) {
            endTime = startTime + 3.0;
          }

          const audioRef = sec.audio || sec.sound || sec.clip || sec.voice;
          const { audioUrl, audioName } = await findCompanionAudio(idx, audioRef);
          const av = await findAvatarUrl(charName);
          getOrAddCharacter(charName, av);

          lines.push({
            id: `line_${idx + 1}`,
            lineNumber: idx + 1,
            character: charName,
            text: caption || `(Line ${idx + 1})`,
            startTime,
            endTime,
            originalAudioUrl: audioUrl,
            originalAudioName: audioName,
          });
        }
      }
    }
  }

  // STRATEGY B: Check for individual line .ini files (e.g. 01_name.ini, line_01.ini)
  if (lines.length === 0) {
    const individualIniKeys = findAllKeys((k, base) => {
      const lower = base.toLowerCase();
      return (
        lower.endsWith('.ini') &&
        !lower.includes('pack_info') &&
        !lower.includes('packinfo') &&
        !lower.includes('dub_info') &&
        !lower.includes('desktop.ini')
      );
    }).sort(naturalSort);

    if (individualIniKeys.length > 0) {
      console.info(`Found ${individualIniKeys.length} individual line INI files.`);

      for (let idx = 0; idx < individualIniKeys.length; idx++) {
        const lineKey = individualIniKeys[idx];
        const base = getBaseName(lineKey).replace(/\.ini$/i, '');
        const iniText = await rawFiles[lineKey].async('text');
        const parsedLineIni = parseIni(iniText);

        const charName =
          getIniValueWithAliases(parsedLineIni, [
            'dub_characters',
            'dub_character',
            'character',
            'char',
            'speaker',
            'actor',
            'voice',
            'name',
          ]) || 'Actor';

        let caption = getIniValueWithAliases(parsedLineIni, [
          'caption',
          'captions',
          'text',
          'subtitle',
          'subtitles',
          'line',
          'lines',
          'dialogue',
          'quote',
        ]);

        // If caption is empty in INI, check if companion .txt exists
        if (!caption) {
          const companionTxtKey = findKey((k, b) => {
            const bClean = b.replace(/\.txt$/i, '');
            return b.toLowerCase().endsWith('.txt') && bClean.toLowerCase() === base.toLowerCase();
          });
          if (companionTxtKey) {
            try {
              const txt = await rawFiles[companionTxtKey].async('text');
              caption = txt.trim();
            } catch {}
          }
        }

        const startTime = parseTimestamp(
          getIniValueWithAliases(parsedLineIni, [
            'dub_timestamps',
            'dub_timestamp',
            'timestamp',
            'starttime',
            'start',
            'time',
            'offset',
            'pos',
          ])
        );

        let endTime = parseTimestamp(
          getIniValueWithAliases(parsedLineIni, ['endtime', 'end', 'stop'])
        );
        const duration = parseTimestamp(
          getIniValueWithAliases(parsedLineIni, ['dub_durations', 'duration', 'length'])
        );

        if (endTime <= startTime && duration > 0) {
          endTime = startTime + duration;
        } else if (endTime <= startTime) {
          endTime = startTime + 3.0;
        }

        const audioRef = getIniValueWithAliases(parsedLineIni, ['audio', 'sound', 'voice', 'clip', 'file']);
        const { audioUrl, audioName } = await findCompanionAudio(idx, audioRef, base);

        const av = await findAvatarUrl(charName);
        getOrAddCharacter(charName, av);

        lines.push({
          id: `line_${idx + 1}`,
          lineNumber: idx + 1,
          character: charName,
          text: caption || `(Line ${idx + 1})`,
          startTime,
          endTime,
          originalAudioUrl: audioUrl,
          originalAudioName: audioName,
          rawIniPath: lineKey,
        });
      }
    }
  }

  // STRATEGY C: Check for individual line .txt files (common in Voice Packs: 01_name.txt)
  if (lines.length === 0) {
    const individualTxtKeys = findAllKeys((k, base) => {
      const lower = base.toLowerCase();
      return (
        lower.endsWith('.txt') &&
        !lower.startsWith('_') &&
        !lower.includes('readme') &&
        !lower.includes('license') &&
        !lower.includes('author') &&
        /\d+/.test(base) // has line number
      );
    }).sort(naturalSort);

    if (individualTxtKeys.length > 0) {
      console.info(`Found ${individualTxtKeys.length} numbered line TXT files.`);

      for (let idx = 0; idx < individualTxtKeys.length; idx++) {
        const txtKey = individualTxtKeys[idx];
        const base = getBaseName(txtKey).replace(/\.txt$/i, '');
        const txtContent = (await rawFiles[txtKey].async('text')).trim();

        let charName = 'Actor';
        let caption = txtContent;

        // Check if format is "Character: Caption"
        const colonMatch = txtContent.match(/^\[?([A-Za-z0-9 _\-]+)\]?\s*:\s*(.*)$/);
        if (colonMatch) {
          charName = colonMatch[1].trim();
          caption = colonMatch[2].trim();
        } else if (txtContent.includes('=')) {
          // Key-value inside txt
          const parsed = parseIni(txtContent);
          charName = getIniValueWithAliases(parsed, ['character', 'speaker', 'actor'], 'Actor');
          caption = getIniValueWithAliases(parsed, ['caption', 'text', 'line'], txtContent);
        }

        const startTime = idx * 3.5;
        const endTime = startTime + 3.0;

        const { audioUrl, audioName } = await findCompanionAudio(idx, undefined, base);
        const av = await findAvatarUrl(charName);
        getOrAddCharacter(charName, av);

        lines.push({
          id: `line_${idx + 1}`,
          lineNumber: idx + 1,
          character: charName,
          text: caption,
          startTime,
          endTime,
          originalAudioUrl: audioUrl,
          originalAudioName: audioName,
        });
      }
    }
  }

  // STRATEGY D: Check for master subtitles (.srt / .vtt or _subtitle.txt)
  if (lines.length === 0 && srtKeys.length > 0) {
    const srtKey = srtKeys[0];
    const srtText = await rawFiles[srtKey].async('text');
    console.info(`Parsing subtitles from ${srtKey}`);
    const srtLines = parseSrtSubtitles(srtText);

    srtLines.forEach((item, idx) => {
      getOrAddCharacter(item.character);
      lines.push({
        id: `line_${idx + 1}`,
        lineNumber: idx + 1,
        character: item.character,
        text: item.text,
        startTime: item.start,
        endTime: item.end,
      });
    });
  }

  // STRATEGY E: Modern JSON format
  if (lines.length === 0 && packJsonKey) {
    try {
      const jsonText = await rawFiles[packJsonKey].async('text');
      const parsedData = JSON.parse(jsonText);
      console.info(`Parsing JSON pack from ${packJsonKey}`);

      title = parsedData.title || parsedData.name || title;
      author = parsedData.author || parsedData.creator || author;
      description = parsedData.description || parsedData.readme || '';

      const rawLines = parsedData.lines || parsedData.dialogue || parsedData.subtitles || [];
      if (Array.isArray(rawLines)) {
        for (let idx = 0; idx < rawLines.length; idx++) {
          const item = rawLines[idx];
          const charName = item.character || item.speaker || item.characterId || 'Actor';
          const caption = item.text || item.caption || item.line || '';
          const startTime = typeof item.startTime === 'number' ? item.startTime : parseTimestamp(item.startTime || item.start);
          let endTime = typeof item.endTime === 'number' ? item.endTime : parseTimestamp(item.endTime || item.end);
          if (endTime <= startTime) endTime = startTime + 3.0;

          let originalAudioUrl: string | undefined;
          if (item.audio) {
            const aEntry = findKey((_, b) => b.toLowerCase() === getBaseName(item.audio).toLowerCase());
            if (aEntry) {
              const b = await rawFiles[aEntry].async('blob');
              originalAudioUrl = URL.createObjectURL(new Blob([b], { type: getMimeType(item.audio) }));
            }
          }

          getOrAddCharacter(charName);
          lines.push({
            id: `line_${idx + 1}`,
            lineNumber: idx + 1,
            character: charName,
            text: caption,
            startTime,
            endTime,
            originalAudioUrl,
            originalAudioName: item.audio,
          });
        }
      }
    } catch (err) {
      console.error('Error parsing JSON pack:', err);
    }
  }

  // Final check: did we extract lines?
  if (lines.length === 0) {
    issues.push({
      severity: 'error',
      code: 'NO_DIALOGUE_LINES_FOUND',
      message:
        'No dialogue lines or timing data could be extracted from this pack. A dubbing pack requires dialogue lines with timestamps (defined in _pack_info.ini, individual .ini files, or subtitles).',
      fixSuggestion:
        'Verify that the pack includes line timings (e.g. dub_timestamps in _pack_info.ini or 01_line.ini files).',
    });
  }

  // Sort lines chronologically
  lines.sort((a, b) => a.startTime - b.startTime);

  // Ensure characters are registered
  if (characterMap.size === 0) {
    const fallbackChar = getOrAddCharacter('Actor');
    lines.forEach((l) => (l.character = fallbackChar.name));
  }

  console.info(`Extraction Summary: ${lines.length} lines parsed, ${characterMap.size} characters found.`);
  console.groupEnd();

  const hasErrors = issues.some((i) => i.severity === 'error');
  const summary = hasErrors
    ? `Pack parsed with ${issues.filter((i) => i.severity === 'error').length} error(s).`
    : `Successfully imported "${title}": ${lines.length} lines, ${characterMap.size} characters, video: ${videoFileName || 'none'}.`;

  const validationReport: PackValidationReport = {
    isValid: !hasErrors,
    formatName,
    issues,
    summary,
    videoCodecNote,
  };

  return {
    title,
    author,
    description,
    iconUrl,
    formatDetected,
    characters: Array.from(characterMap.values()),
    lines,
    videoFileName,
    videoBlobUrl,
    videoMimeType,
    backingTrackFileName,
    backingTrackBlobUrl,
    archiveEntries,
    validationReport,
    rawZipName: file.name,
  };
}
