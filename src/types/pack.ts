export interface SceneCharacter {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string;
}

export interface DialogueLine {
  id: string;
  lineNumber: number;
  character: string;
  text: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  originalAudioUrl?: string;
  originalAudioName?: string;
  rawIniPath?: string;
}

export interface DubTake {
  id: string;
  lineId: string;
  takeNumber: number;
  audioBlob: Blob;
  audioUrl: string;
  duration: number;
  recordedAt: number;
}

export interface ArchiveFileEntry {
  path: string;
  name: string;
  size: number;
  category: 'video' | 'audio' | 'ini' | 'json' | 'image' | 'text' | 'other';
  status: 'valid' | 'warning' | 'error' | 'ignored';
  note?: string;
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  filePath?: string;
  fixSuggestion?: string;
}

export interface PackValidationReport {
  isValid: boolean;
  formatName: string;
  issues: ValidationIssue[];
  summary: string;
  videoCodecNote?: string;
}

export interface ParsedScenePack {
  title: string;
  author: string;
  description?: string;
  iconUrl?: string;
  formatDetected: 'choicer-voicer-ini' | 'choicer-voicer-json' | 'subtitles-media' | 'custom';
  characters: SceneCharacter[];
  lines: DialogueLine[];
  videoFileName: string;
  videoBlobUrl: string;
  videoMimeType: string;
  backingTrackFileName?: string;
  backingTrackBlobUrl?: string;
  archiveEntries: ArchiveFileEntry[];
  validationReport: PackValidationReport;
  rawZipName: string;
}
