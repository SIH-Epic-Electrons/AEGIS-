/**
 * Error Handler Service
 * Standardizes error handling and provides user-friendly messages
 */

export enum ErrorType {
  NETWORK = 'NETWORK',
  SERVER = 'SERVER',
  CLIENT = 'CLIENT',
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  RATE_LIMIT = 'RATE_LIMIT',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

export interface StructuredError {
  type: ErrorType;
  message: string;
  technicalMessage?: string;
  retryable: boolean;
  suggestedAction: string;
  statusCode?: number;
  originalError?: any;
}

/**
 * Classify error type
 */
export const classifyError = (error: any): ErrorType => {
  // Network errors
  if (
    error.code === 'ERR_NETWORK' ||
    error.code === 'ECONNREFUSED' ||
    error.message?.includes('Network Error') ||
    error.message?.includes('network')
  ) {
    return ErrorType.NETWORK;
  }

  // Timeout errors
  if (
    error.code === 'ETIMEDOUT' ||
    error.code === 'ECONNABORTED' ||
    error.message?.includes('timeout') ||
    error.response?.status === 408
  ) {
    return ErrorType.TIMEOUT;
  }

  // HTTP status codes
  if (error.response) {
    const status = error.response.status;

    // Authentication errors
    if (status === 401 || status === 403) {
      return ErrorType.AUTHENTICATION;
    }

    // Rate limit
    if (status === 429) {
      return ErrorType.RATE_LIMIT;
    }

    // Validation errors
    if (status === 400 || status === 422) {
      return ErrorType.VALIDATION;
    }

    // Server errors
    if (status >= 500 && status < 600) {
      return ErrorType.SERVER;
    }

    // Client errors
    if (status >= 400 && status < 500) {
      return ErrorType.CLIENT;
    }
  }

  return ErrorType.UNKNOWN;
};

/**
 * Get user-friendly error message
 */
export const getUserFriendlyMessage = (errorType: ErrorType, error?: any): string => {
  switch (errorType) {
    case ErrorType.NETWORK:
      return 'Unable to connect. Please check your internet connection and try again.';
    case ErrorType.TIMEOUT:
      return 'Request timed out. Please try again.';
    case ErrorType.SERVER:
      return 'Service temporarily unavailable. Please try again in a moment.';
    case ErrorType.VALIDATION:
      return error?.response?.data?.message || 'Invalid data provided. Please check and try again.';
    case ErrorType.AUTHENTICATION:
      return 'Your session has expired. Please log in again.';
    case ErrorType.RATE_LIMIT:
      return 'Too many requests. Please wait a moment before trying again.';
    case ErrorType.CLIENT:
      return error?.response?.data?.message || 'Invalid request. Please check your input.';
    case ErrorType.UNKNOWN:
    default:
      return 'Something went wrong. Please try again.';
  }
};

/**
 * Check if error is retryable
 */
export const isRetryableErrorType = (errorType: ErrorType): boolean => {
  return [
    ErrorType.NETWORK,
    ErrorType.TIMEOUT,
    ErrorType.SERVER,
    ErrorType.RATE_LIMIT,
  ].includes(errorType);
};

/**
 * Get suggested action for user
 */
export const getSuggestedAction = (errorType: ErrorType): string => {
  switch (errorType) {
    case ErrorType.NETWORK:
      return 'Check your internet connection and retry';
    case ErrorType.TIMEOUT:
      return 'Retry the operation';
    case ErrorType.SERVER:
      return 'Wait a moment and retry';
    case ErrorType.VALIDATION:
      return 'Review your input and correct any errors';
    case ErrorType.AUTHENTICATION:
      return 'Log out and log in again';
    case ErrorType.RATE_LIMIT:
      return 'Wait 30 seconds before retrying';
    case ErrorType.CLIENT:
      return 'Check your input and try again';
    case ErrorType.UNKNOWN:
    default:
      return 'Try again or contact support if the problem persists';
  }
};

/**
 * Get technical error message (for development)
 */
export const getTechnicalMessage = (error: any): string => {
  if (__DEV__) {
    if (error.response) {
      return `HTTP ${error.response.status}: ${error.response.statusText} - ${JSON.stringify(error.response.data)}`;
    }
    if (error.message) {
      return error.message;
    }
    return JSON.stringify(error);
  }
  return '';
};

/**
 * Handle and structure an error
 */
export const handleError = (error: any, context?: string): StructuredError => {
  const errorType = classifyError(error);
  const message = getUserFriendlyMessage(errorType, error);
  const technicalMessage = getTechnicalMessage(error);
  const retryable = isRetryableErrorType(errorType);
  const suggestedAction = getSuggestedAction(errorType);

  // Log error in development
  if (__DEV__) {
    console.error(`[ErrorHandler] ${context || 'Error'}:`, {
      type: errorType,
      message,
      technicalMessage,
      error,
    });
  }

  return {
    type: errorType,
    message,
    technicalMessage,
    retryable,
    suggestedAction,
    statusCode: error.response?.status,
    originalError: error,
  };
};

/**
 * Log error to error tracking service (Sentry, etc.)
 */
export const logError = async (error: StructuredError, context?: Record<string, any>) => {
  // Import error tracking service
  try {
    const { captureStructuredError } = await import('./errorTrackingService');
    captureStructuredError(error, context);
  } catch (err) {
    // Fallback to console if error tracking fails
    console.error('Error logging failed:', err);
  }
};

