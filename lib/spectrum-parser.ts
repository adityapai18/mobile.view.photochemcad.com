import { SpectrumData } from './types';

export interface ParsedSpectrumData {
  wavelength: number;
  value: number;
}

/**
 * Parse spectrum data from various file formats (CSV, TSV, TXT)
 * Supports tab-separated and comma-separated values
 */
export function parseSpectrumFile(
  content: string,
  filename: string
): ParsedSpectrumData[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) {
    throw new Error('File is empty');
  }

  // Detect delimiter (tab or comma)
  const firstLine = lines[0];
  const isTabDelimited = firstLine.includes('\t');
  const delimiter = isTabDelimited ? '\t' : ',';

  // Skip header if present (check if first line contains non-numeric values)
  let startIndex = 0;
  const firstLineParts = firstLine.split(delimiter);
  const hasHeader = firstLineParts.some(part => {
    const trimmed = part.trim();
    return trimmed && isNaN(parseFloat(trimmed));
  });

  if (hasHeader) {
    startIndex = 1;
  }

  const data: ParsedSpectrumData[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(delimiter).map(p => p.trim());
    if (parts.length < 2) continue;

    const wavelength = parseFloat(parts[0]);
    const value = parseFloat(parts[1]);

    if (isNaN(wavelength) || isNaN(value)) {
      continue; // Skip invalid rows
    }

    data.push({ wavelength, value });
  }

  if (data.length === 0) {
    throw new Error('No valid data points found in file');
  }

  // Sort by wavelength
  data.sort((a, b) => a.wavelength - b.wavelength);

  return data;
}

/**
 * Extract spectrum name from filename
 * Tries to infer name from filename patterns like "A01.absorption.txt"
 */
export function extractSpectrumName(filename: string): string {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.(txt|csv|tsx)$/i, '');
  
  // Try to extract meaningful name
  // Pattern: "A01.absorption" -> "A01 Absorption"
  // Pattern: "compound_name" -> "Compound Name"
  const parts = nameWithoutExt.split(/[._-]/);
  
  // If it looks like a code (e.g., "A01"), try to use the whole thing
  if (parts.length === 1) {
    return parts[0];
  }
  
  // Remove common suffixes like "absorption", "emission", "abs", "em"
  const filtered = parts.filter(
    p => !['absorption', 'emission', 'abs', 'em', 'spectrum'].includes(p.toLowerCase())
  );
  
  if (filtered.length > 0) {
    return filtered.join(' ');
  }
  
  return nameWithoutExt;
}

/**
 * Convert parsed spectrum data to SpectrumData format
 */
export function convertToSpectrumData(
  parsedData: ParsedSpectrumData[],
  compoundId: string,
  type: 'absorption' | 'emission'
): SpectrumData[] {
  return parsedData.map(point => ({
    compound_id: compoundId,
    wavelength: point.wavelength,
    ...(type === 'absorption'
      ? { coefficient: point.value }
      : { normalized: point.value }),
  }));
}
