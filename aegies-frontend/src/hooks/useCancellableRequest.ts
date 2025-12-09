// Cancellable request hook to prevent race conditions
import { useRef, useEffect } from 'react';

export function useCancellableRequest() {
  const abortControllerRef = useRef<AbortController | null>(null);

  const makeRequest = async <T>(
    requestFn: (signal: AbortSignal) => Promise<T>
  ): Promise<T | null> => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      return await requestFn(abortControllerRef.current.signal);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return null; // Request was cancelled
      }
      throw error;
    }
  };

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return makeRequest;
}

