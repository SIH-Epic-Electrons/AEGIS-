// Optimistic update hook for better UX
import { useState } from 'react';

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function useOptimisticUpdate<T>(
  initialData: T,
  updateFn: (data: T) => Promise<ServiceResponse<T>>
) {
  const [data, setData] = useState<T>(initialData);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = async (optimisticUpdate: (prev: T) => T) => {
    const previousData = data;

    // Optimistic update
    setData(optimisticUpdate);
    setIsUpdating(true);
    setError(null);

    try {
      const result = await updateFn(data);
      if (result.success && result.data) {
        setData(result.data);
      } else {
        // Revert on error
        setData(previousData);
        setError(result.error || 'Update failed');
      }
    } catch (err: any) {
      setData(previousData);
      setError(err.message || 'Update failed');
    } finally {
      setIsUpdating(false);
    }
  };

  const reset = () => {
    setData(initialData);
    setError(null);
    setIsUpdating(false);
  };

  return { data, update, isUpdating, error, reset };
}

