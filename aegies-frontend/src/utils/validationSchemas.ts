/**
 * Validation Schemas using Zod
 * Defines schemas for all input validation
 */

import { z } from 'zod';

/**
 * Complaint ID validation
 * Format: NCRP-YYYYMMDD-XXXXXX or NCRP-YYYY-XXXXXX
 */
export const complaintIdSchema = z
  .string()
  .regex(
    /^NCRP-\d{4}(\d{4})?-\d{6}$/,
    'Complaint ID must be in format NCRP-YYYYMMDD-XXXXXX or NCRP-YYYY-XXXXXX'
  )
  .min(15)
  .max(25);

/**
 * Coordinate validation (India bounds)
 */
export const coordinateSchema = z.object({
  latitude: z
    .number()
    .min(6.5, 'Latitude must be within India bounds (6.5 to 37.1)')
    .max(37.1, 'Latitude must be within India bounds (6.5 to 37.1)')
    .finite('Latitude must be a valid number'),
  longitude: z
    .number()
    .min(68.1, 'Longitude must be within India bounds (68.1 to 97.4)')
    .max(97.4, 'Longitude must be within India bounds (68.1 to 97.4)')
    .finite('Longitude must be a valid number'),
});

/**
 * Amount validation
 */
export const amountSchema = z
  .number()
  .positive('Amount must be positive')
  .min(1, 'Amount must be at least ₹1')
  .max(10000000, 'Amount cannot exceed ₹1 crore (10,000,000)')
  .finite('Amount must be a valid number');

/**
 * Scam type validation
 */
export const scamTypeSchema = z.enum([
  'upi_fraud',
  'loan_app',
  'job_scam',
  'investment',
  'impersonation',
  'romance',
  'other',
]);

/**
 * Time validation (ISO 8601, not future, not too old)
 */
export const timeSchema = z
  .string()
  .datetime('Time must be in ISO 8601 format')
  .refine(
    (date) => {
      const d = new Date(date);
      const now = new Date();
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      return d <= now && d >= oneYearAgo;
    },
    {
      message: 'Time must be within the last year and not in the future',
    }
  );

/**
 * Alert filters schema
 */
export const alertFiltersSchema = z.object({
  stateCode: z
    .string()
    .length(2, 'State code must be 2 letters')
    .regex(/^[A-Z]{2}$/, 'State code must be uppercase letters')
    .optional(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  crossStateOnly: z.boolean().optional(),
});

/**
 * Phone number validation (10 digits)
 */
export const phoneSchema = z
  .string()
  .regex(/^\d{10}$/, 'Phone number must be exactly 10 digits');

/**
 * Email validation
 */
export const emailSchema = z.string().email('Invalid email format');

/**
 * Aadhaar validation (12 digits)
 */
export const aadhaarSchema = z
  .string()
  .regex(/^\d{12}$/, 'Aadhaar number must be exactly 12 digits');

/**
 * UPI ID validation
 */
export const upiIdSchema = z
  .string()
  .regex(
    /^[\w.-]+@[\w]+$/,
    'UPI ID must be in format: username@bankname'
  )
  .min(3)
  .max(100);

/**
 * Report form schema
 */
export const reportFormSchema = z.object({
  // Step 1: Incident Type
  scamType: scamTypeSchema,

  // Step 2: Details
  amount: z.string().transform((val) => {
    const num = parseFloat(val);
    if (isNaN(num)) throw new Error('Amount must be a valid number');
    return num;
  }).pipe(amountSchema),
  description: z.string().min(10, 'Description must be at least 10 characters').max(5000),
  incidentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  incidentTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),

  // Step 3: Transaction
  transactionId: z.string().min(1, 'Transaction ID is required').max(100).optional(),
  bankName: z.string().min(1, 'Bank name is required').max(100).optional(),
  accountNumber: z.string().min(1).max(50).optional(),
  upiId: upiIdSchema.optional(),
  beneficiaryName: z.string().min(1).max(100).optional(),

  // Step 4: Location
  location: coordinateSchema.nullable().optional(),

  // Step 5: Evidence
  photos: z.array(z.string()).max(10, 'Maximum 10 photos allowed'),
  documents: z.array(z.string()).max(5, 'Maximum 5 documents allowed'),

  // Step 6: Contact
  phoneNumber: phoneSchema,
  email: emailSchema.optional(),
  aadhaarNumber: aadhaarSchema.optional(),
}).refine(
  (data) => {
    // If UPI fraud, UPI ID is required
    if (data.scamType === 'upi_fraud' && !data.upiId) {
      return false;
    }
    return true;
  },
  {
    message: 'UPI ID is required for UPI fraud reports',
    path: ['upiId'],
  }
);

/**
 * Action submission schema
 */
export const actionSchema = z.object({
  alertId: z.string().min(1, 'Alert ID is required'),
  type: z.enum(['freeze', 'navigate', 'outcome', 'cordon', 'other']),
  data: z.record(z.string(), z.any()),
});

/**
 * Outcome submission schema
 */
export const outcomeSchema = z.object({
  success: z.boolean(),
  amountRecovered: z.number().min(0).max(10000000).optional(),
  suspectApprehended: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
  newState: z.string().length(2).regex(/^[A-Z]{2}$/).optional(),
});

/**
 * Evidence upload schema
 */
export const evidenceSchema = z.object({
  alertId: z.string().min(1),
  type: z.enum(['photo', 'video', 'document']),
  uri: z.string().url('Invalid file URI'),
  annotations: z.array(z.any()).optional(),
  redacted: z.boolean(),
});

