/**
 * Validation Utility Functions
 * Provides easy-to-use validation functions
 */

import {
  complaintIdSchema,
  coordinateSchema,
  amountSchema,
  scamTypeSchema,
  timeSchema,
  alertFiltersSchema,
  phoneSchema,
  emailSchema,
  aadhaarSchema,
  upiIdSchema,
  reportFormSchema,
  actionSchema,
  outcomeSchema,
  evidenceSchema,
} from './validationSchemas';
import { z } from 'zod';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate complaint ID
 */
export const validateComplaintId = (id: string): ValidationResult => {
  try {
    complaintIdSchema.parse(id);
    return { valid: true };
  } catch (error: any) {
    return {
      valid: false,
      error: error.errors?.[0]?.message || 'Invalid complaint ID format',
    };
  }
};

/**
 * Validate coordinates
 */
export const validateCoordinates = (
  lat: number,
  lon: number
): ValidationResult => {
  try {
    coordinateSchema.parse({ latitude: lat, longitude: lon });
    return { valid: true };
  } catch (error: any) {
    return {
      valid: false,
      error: error.errors?.[0]?.message || 'Invalid coordinates',
    };
  }
};

/**
 * Validate amount
 */
export const validateAmount = (amount: number): ValidationResult => {
  try {
    amountSchema.parse(amount);
    return { valid: true };
  } catch (error: any) {
    return {
      valid: false,
      error: error.errors?.[0]?.message || 'Invalid amount',
    };
  }
};

/**
 * Validate scam type
 */
export const validateScamType = (type: string): ValidationResult => {
  try {
    scamTypeSchema.parse(type);
    return { valid: true };
  } catch (error: any) {
    return {
      valid: false,
      error: error.errors?.[0]?.message || 'Invalid scam type',
    };
  }
};

/**
 * Validate and sanitize input using a schema
 */
export const validateAndSanitizeInput = <T>(
  data: unknown,
  schema: z.ZodSchema<T>
): { valid: boolean; data?: T; error?: string } => {
  try {
    const validated = schema.parse(data);
    return { valid: true, data: validated };
  } catch (error: any) {
    return {
      valid: false,
      error: error.errors?.[0]?.message || 'Validation failed',
    };
  }
};

/**
 * Sanitize string to prevent XSS
 */
export const sanitizeString = (str: string): string => {
  if (typeof str !== 'string') return '';
  
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]+>/g, '') // Remove all HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
};

/**
 * Sanitize coordinates (round to safe precision)
 */
export const sanitizeCoordinates = (
  lat: number,
  lon: number
): { latitude: number; longitude: number } => {
  // Round to 6 decimal places (~0.1 meter precision)
  return {
    latitude: Math.round(lat * 1000000) / 1000000,
    longitude: Math.round(lon * 1000000) / 1000000,
  };
};

/**
 * Validate phone number
 */
export const validatePhone = (phone: string): ValidationResult => {
  try {
    phoneSchema.parse(phone);
    return { valid: true };
  } catch (error: any) {
    return {
      valid: false,
      error: error.errors?.[0]?.message || 'Invalid phone number',
    };
  }
};

/**
 * Validate email
 */
export const validateEmail = (email: string): ValidationResult => {
  try {
    emailSchema.parse(email);
    return { valid: true };
  } catch (error: any) {
    return {
      valid: false,
      error: error.errors?.[0]?.message || 'Invalid email',
    };
  }
};

/**
 * Validate Aadhaar
 */
export const validateAadhaar = (aadhaar: string): ValidationResult => {
  try {
    aadhaarSchema.parse(aadhaar);
    return { valid: true };
  } catch (error: any) {
    return {
      valid: false,
      error: error.errors?.[0]?.message || 'Invalid Aadhaar number',
    };
  }
};

/**
 * Validate UPI ID
 */
export const validateUPIId = (upiId: string): ValidationResult => {
  try {
    upiIdSchema.parse(upiId);
    return { valid: true };
  } catch (error: any) {
    return {
      valid: false,
      error: error.errors?.[0]?.message || 'Invalid UPI ID',
    };
  }
};

/**
 * Validate report form
 */
export const validateReportForm = (data: unknown) => {
  return validateAndSanitizeInput(data, reportFormSchema);
};

/**
 * Validate action
 */
export const validateAction = (data: unknown) => {
  return validateAndSanitizeInput(data, actionSchema);
};

/**
 * Validate outcome
 */
export const validateOutcome = (data: unknown) => {
  return validateAndSanitizeInput(data, outcomeSchema);
};

/**
 * Validate evidence
 */
export const validateEvidence = (data: unknown) => {
  return validateAndSanitizeInput(data, evidenceSchema);
};

/**
 * Validate alert filters
 */
export const validateAlertFilters = (filters: unknown) => {
  return validateAndSanitizeInput(filters, alertFiltersSchema);
};

/**
 * Validate IFSC Code
 * Format: 4 uppercase letters + 0 + 6 alphanumeric characters
 * Example: SBIN0001234, HDFC0001234
 */
export const validateIFSC = (ifsc: string): ValidationResult => {
  if (!ifsc || ifsc.trim() === '') {
    return { valid: true }; // Empty is allowed, will default to UNKNOWN
  }
  
  // IFSC pattern: ^[A-Z]{4}0[A-Z0-9]{6}$
  const ifscPattern = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  const upperIfsc = ifsc.trim().toUpperCase();
  
  if (ifscPattern.test(upperIfsc)) {
    return { valid: true };
  }
  
  return {
    valid: false,
    error: 'IFSC code must be 11 characters: 4 letters, then 0, then 6 alphanumeric (e.g., SBIN0001234)',
  };
};

/**
 * Format IFSC code (uppercase, remove spaces)
 */
export const formatIFSC = (ifsc: string): string => {
  if (!ifsc) return '';
  return ifsc.trim().toUpperCase().replace(/\s+/g, '');
};

/**
 * Normalize IFSC code for submission
 * Returns formatted IFSC if valid, or 'UNKNOWN' if invalid/empty
 */
export const normalizeIFSC = (ifsc: string): string => {
  if (!ifsc || ifsc.trim() === '') {
    return 'UNKNOWN';
  }
  
  const formatted = formatIFSC(ifsc);
  const validation = validateIFSC(formatted);
  
  if (validation.valid) {
    return formatted;
  }
  
  return 'UNKNOWN';
};

