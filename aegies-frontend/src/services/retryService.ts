/**
 * Retry Service with Exponential Backoff
 * Handles transient failures with configurable retry logic
 */

export interface RetryConfig {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: (error: any) => boolean;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: any;
  attempts: number;
}

const DEFAULT_CONFIG: Required<Omit<RetryConfig, 'retryableErrors'>> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

/**
 * Check if an error is retryable
 */
const isRetryableError = (error: any): boolean => {
  // Network errors
  if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    return true;
  }

  // HTTP status codes
  if (error.response) {
    const status = error.response.status;
    // 5xx server errors
    if (status >= 500 && status < 600) {
      return true;
    }
    // 408 Request Timeout
    if (status === 408) {
      return true;
    }
    // 429 Too Many Requests
    if (status === 429) {
      return true;
    }
  }

  // Timeout errors
  if (error.message?.includes('timeout') || error.message?.includes('TIMEOUT')) {
    return true;
  }

  return false;
};

/**
 * Sleep utility
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Retry an async function with exponential backoff
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<RetryResult<T>> => {
  const {
    maxAttempts = DEFAULT_CONFIG.maxAttempts,
    initialDelay = DEFAULT_CONFIG.initialDelay,
    maxDelay = DEFAULT_CONFIG.maxDelay,
    backoffMultiplier = DEFAULT_CONFIG.backoffMultiplier,
    retryableErrors = isRetryableError,
  } = config;

  let lastError: any;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const data = await fn();
      return {
        success: true,
        data,
        attempts: attempt,
      };
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable
      if (!retryableErrors(error)) {
        return {
          success: false,
          error,
          attempts: attempt,
        };
      }

      // If this was the last attempt, don't wait
      if (attempt === maxAttempts) {
        break;
      }

      // Wait before retrying with exponential backoff
      await sleep(Math.min(delay, maxDelay));
      delay *= backoffMultiplier;
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: maxAttempts,
  };
};

/**
 * Retry configuration presets
 */
export const retryConfigs = {
  critical: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  },
  nonCritical: {
    maxAttempts: 2,
    initialDelay: 500,
    maxDelay: 5000,
    backoffMultiplier: 2,
  },
  fileUpload: {
    maxAttempts: 2,
    initialDelay: 2000,
    maxDelay: 15000,
    backoffMultiplier: 2,
  },
};

