/**
 * Robust INI and configuration parser designed for Choicer Voicer, CVDPE, and DubBooth pack specifications.
 * Handles section headers, key=value, key:value, comments, arrays, timestamps, and BOM characters.
 */

export interface ParsedIni {
  sections: Record<string, Record<string, string>>;
  globals: Record<string, string>;
  rawLines: string[];
}

/**
 * Parses INI formatted strings into sections and key-value dictionaries.
 */
export function parseIni(content: string): ParsedIni {
  const result: ParsedIni = {
    sections: {},
    globals: {},
    rawLines: [],
  };

  if (!content) return result;

  // Strip UTF-8 Byte Order Mark (BOM) if present
  const cleaned = content.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/);
  result.rawLines = lines;

  let currentSection = '';

  for (let rawLine of lines) {
    let line = rawLine.trim();

    // Skip empty lines or full comment lines
    if (!line || line.startsWith(';') || line.startsWith('#') || line.startsWith('//')) {
      continue;
    }

    // Section header [SectionName] (ignoring any trailing comments like [General] ; info)
    const sectionMatch = line.match(/^\[([^\]]+)\]/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      if (!result.sections[currentSection]) {
        result.sections[currentSection] = {};
      }
      continue;
    }

    // Find separator: '=' or ':'
    let separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      separatorIndex = line.indexOf(':');
    }

    if (separatorIndex !== -1) {
      const rawKey = line.substring(0, separatorIndex).trim();
      let rawVal = line.substring(separatorIndex + 1).trim();

      // Handle trailing comments unless value is enclosed in quotes
      const isQuoted =
        (rawVal.startsWith('"') && rawVal.endsWith('"')) ||
        (rawVal.startsWith("'") && rawVal.endsWith("'"));

      if (!isQuoted) {
        // Strip trailing comment starting with ; or // or # if separated by whitespace
        const commentMatch = rawVal.match(/^(.*?)\s+(?:;|#|\/\/).*$/);
        if (commentMatch) {
          rawVal = commentMatch[1].trim();
        }
      } else {
        // Strip surrounding quotes
        rawVal = rawVal.substring(1, rawVal.length - 1);
      }

      // Unescape newlines if present
      rawVal = rawVal.replace(/\\n/g, '\n').replace(/\\r/g, '');

      if (currentSection) {
        if (!result.sections[currentSection]) {
          result.sections[currentSection] = {};
        }
        result.sections[currentSection][rawKey] = rawVal;
      } else {
        result.globals[rawKey] = rawVal;
      }
    }
  }

  return result;
}

/**
 * Searches for a key case-insensitively across a list of possible aliases.
 */
export function getIniValueWithAliases(
  ini: ParsedIni,
  aliases: string[],
  defaultVal = ''
): string {
  const lowerAliases = aliases.map((a) => a.toLowerCase());

  // 1. Search in globals
  for (const [k, v] of Object.entries(ini.globals)) {
    if (lowerAliases.includes(k.toLowerCase())) return v;
  }

  // 2. Search in prioritized sections (general, info, line, dub, etc.)
  const prioritySections = ['general', 'info', 'line', 'dub', 'pack', 'metadata'];
  for (const p of prioritySections) {
    for (const [secName, secValues] of Object.entries(ini.sections)) {
      if (secName.toLowerCase() === p) {
        for (const [k, v] of Object.entries(secValues)) {
          if (lowerAliases.includes(k.toLowerCase())) return v;
        }
      }
    }
  }

  // 3. Search in all other sections
  for (const secValues of Object.values(ini.sections)) {
    for (const [k, v] of Object.entries(secValues)) {
      if (lowerAliases.includes(k.toLowerCase())) return v;
    }
  }

  return defaultVal;
}

/**
 * Helper to fetch a key case-insensitively from either sections or globals.
 */
export function getIniValue(ini: ParsedIni, key: string, defaultVal = ''): string {
  return getIniValueWithAliases(ini, [key], defaultVal);
}

/**
 * Parses bracketed or comma/semicolon delimited array values like:
 * '["Alice", "Bob"]', '[1.2, 4.5]', 'Alice, Bob', or '1.0, 3.5'
 */
export function parseIniArray(val: string | undefined): string[] {
  if (!val) return [];
  let trimmed = val.trim();

  // Strip outer brackets if present: [ ... ]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    // Try JSON.parse first
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim());
      }
    } catch {
      // Manual fallback
      trimmed = trimmed.substring(1, trimmed.length - 1).trim();
    }
  }

  if (!trimmed) return [];

  // Parse items split by comma, handling quotes
  const items: string[] = [];
  const regex = /(?:^|,|;)\s*(?:"([^"]*)"|'([^']*)'|([^,;]+))/g;
  let match;
  while ((match = regex.exec(trimmed)) !== null) {
    const item = match[1] ?? match[2] ?? match[3];
    if (item !== undefined && item.trim().length > 0) {
      items.push(item.trim());
    }
  }

  return items;
}

/**
 * Parses timestamp strings like "2.5", "00:02.500", "01:23", "84.2s" into float seconds.
 */
export function parseTimestamp(val: string | number | undefined): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return Math.max(0, val);

  const cleaned = String(val).replace(/s$/i, '').trim();

  // Check if formatted as MM:SS or HH:MM:SS
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':').map((p) => parseFloat(p) || 0);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.max(0, num);
}

/**
 * Formats seconds into MM:SS.cc for audio/video dubbing display
 */
export function formatTimecode(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00.00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const centis = Math.floor((seconds % 1) * 100);

  const mm = mins.toString().padStart(2, '0');
  const ss = secs.toString().padStart(2, '0');
  const cc = centis.toString().padStart(2, '0');

  return `${mm}:${ss}.${cc}`;
}
