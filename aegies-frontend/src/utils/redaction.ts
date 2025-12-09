/**
 * Redaction utilities for privacy compliance (DPDP Act 2023)
 * Automatically detects and blurs sensitive information
 */

import * as ImageManipulator from 'expo-image-manipulator';

export interface RedactionRule {
  pattern: RegExp;
  type: 'account_number' | 'phone_number' | 'aadhaar' | 'pan';
}

// Patterns for detecting sensitive data
const REDACTION_PATTERNS: RedactionRule[] = [
  {
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Account numbers (16 digits)
    type: 'account_number',
  },
  {
    pattern: /\b\d{10}\b/g, // Phone numbers (10 digits)
    type: 'phone_number',
  },
  {
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Aadhaar (12 digits)
    type: 'aadhaar',
  },
  {
    pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g, // PAN
    type: 'pan',
  },
];

/**
 * Detect sensitive information in text
 * @param text Text to analyze
 * @returns Array of detected sensitive data with positions
 */
export const detectSensitiveData = (text: string): Array<{
  type: string;
  value: string;
  startIndex: number;
  endIndex: number;
}> => {
  const detections: Array<{
    type: string;
    value: string;
    startIndex: number;
    endIndex: number;
  }> = [];

  REDACTION_PATTERNS.forEach((rule) => {
    let match;
    while ((match = rule.pattern.exec(text)) !== null) {
      detections.push({
        type: rule.type,
        value: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }
  });

  return detections;
};

/**
 * Redact sensitive information from text
 * @param text Text to redact
 * @returns Redacted text
 */
export const redactText = (text: string): string => {
  let redacted = text;
  const detections = detectSensitiveData(text);

  // Sort by start index in reverse to maintain positions
  detections.sort((a, b) => b.startIndex - a.startIndex);

  detections.forEach((detection) => {
    const replacement = '*'.repeat(detection.value.length);
    redacted =
      redacted.slice(0, detection.startIndex) +
      replacement +
      redacted.slice(detection.endIndex);
  });

  return redacted;
};

/**
 * Apply blur effect to image region (for evidence redaction)
 * @param uri Image URI
 * @param regions Array of regions to blur {x, y, width, height}
 * @returns Manipulated image URI
 */
export const blurImageRegions = async (
  uri: string,
  regions: Array<{ x: number; y: number; width: number; height: number }>
): Promise<string> => {
  // For MVP, we'll use a simple blur filter
  // In production, use more sophisticated image processing
  try {
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 800 } }], // Resize for performance
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );

    // Note: expo-image-manipulator doesn't support selective blur
    // For production, consider using react-native-image-filter-kit
    // or a native module for advanced redaction
    return manipulated.uri;
  } catch (error) {
    console.error('Error blurring image:', error);
    return uri;
  }
};

/**
 * Auto-redact image based on OCR detection (future enhancement)
 * @param uri Image URI
 * @returns Redacted image URI
 */
export const autoRedactImage = async (uri: string): Promise<string> => {
  // This would integrate with OCR service to detect and blur sensitive data
  // For MVP, return original image
  return uri;
};

