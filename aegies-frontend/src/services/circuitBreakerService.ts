/**
 * Circuit Breaker Service
 * Prevents cascading failures by stopping requests to failing services
 */

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

export interface CircuitBreakerConfig {
  failureThreshold?: number; // Failures before opening
  successThreshold?: number; // Successes before closing
  timeout?: number; // Time in OPEN before HALF_OPEN (ms)
  resetTimeout?: number; // Time before resetting failure count (ms)
}

const DEFAULT_CONFIG: Required<CircuitBreakerConfig> = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000, // 30 seconds
  resetTimeout: 60000, // 1 minute
};

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number | null = null;
  private lastResetTime: number = Date.now();
  private config: Required<CircuitBreakerConfig>;

  constructor(config: CircuitBreakerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    this.updateState();
    return this.state;
  }

  /**
   * Update state based on time and thresholds
   */
  private updateState(): void {
    const now = Date.now();

    // Reset failure count if reset timeout passed
    if (now - this.lastResetTime > this.config.resetTimeout) {
      this.failureCount = 0;
      this.lastResetTime = now;
    }

    // State machine transitions
    if (this.state === CircuitState.OPEN) {
      // Check if timeout passed, move to HALF_OPEN
      if (this.lastFailureTime && now - this.lastFailureTime > this.config.timeout) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      }
    } else if (this.state === CircuitState.HALF_OPEN) {
      // If we have enough successes, close the circuit
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
      }
    }
  }

  /**
   * Record a successful operation
   */
  recordSuccess(): void {
    this.updateState();

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success
      this.failureCount = 0;
      this.lastResetTime = Date.now();
    }
  }

  /**
   * Record a failed operation
   */
  recordFailure(): void {
    this.updateState();

    this.failureCount++;
    this.lastFailureTime = Date.now();

    // If we hit the threshold, open the circuit
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.successCount = 0;
    }
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.updateState();

    // If circuit is open, reject immediately
    if (this.state === CircuitState.OPEN) {
      throw new Error('Circuit breaker is OPEN - service unavailable');
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Check if requests are allowed
   */
  isOpen(): boolean {
    return this.getState() === CircuitState.OPEN;
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.lastResetTime = Date.now();
  }
}

/**
 * Circuit breaker instances for different services
 */
export const circuitBreakers = {
  predictions: new CircuitBreaker({ failureThreshold: 5, timeout: 30000 }),
  alerts: new CircuitBreaker({ failureThreshold: 5, timeout: 30000 }),
  actions: new CircuitBreaker({ failureThreshold: 3, timeout: 20000 }),
  reports: new CircuitBreaker({ failureThreshold: 3, timeout: 20000 }),
  model: new CircuitBreaker({ failureThreshold: 3, timeout: 30000 }),
};

