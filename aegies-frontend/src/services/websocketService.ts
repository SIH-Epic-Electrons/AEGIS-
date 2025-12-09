// WebSocket Service for Real-Time Updates
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../constants/config';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private connectionStatus: ConnectionStatus = 'disconnected';
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private subscriptions: Set<string> = new Set();

  connect(token?: string) {
    if (this.socket?.connected) {
      return;
    }

    // Only connect if we have a valid API URL (not localhost in dev mode)
    // In dev mode with localhost, WebSocket will fail, so skip to avoid error spam
    if (typeof __DEV__ !== 'undefined' && __DEV__ && API_BASE_URL.includes('localhost')) {
      console.log('WebSocket: Skipping connection in dev mode (no server available)');
      return;
    }

    const wsUrl = API_BASE_URL.replace('http://', 'ws://').replace('https://', 'wss://');
    
    try {
      this.socket = io(wsUrl, {
        auth: token ? { token } : undefined,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 3000, // Increased delay to reduce spam
        timeout: 5000,
        autoConnect: false, // Manual connect
      });

      this.socket.on('connect', () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.setConnectionStatus('connected');
        
        // Re-subscribe to all previous subscriptions
        this.subscriptions.forEach(event => {
          this.socket?.emit('subscribe', event);
        });
        
        // Start ping interval
        this.startPing();
      });

      this.socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        this.setConnectionStatus('disconnected');
        this.stopPing();
        
        // Attempt reconnection if not manual disconnect
        if (reason !== 'io client disconnect') {
          this.attemptReconnect();
        }
      });

      this.socket.on('connect_error', (error) => {
        console.warn('WebSocket connection error:', error.message);
        this.setConnectionStatus('error');
        this.reconnectAttempts++;
        
        // Exponential backoff
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect();
        } else {
          console.log('WebSocket: Max reconnection attempts reached.');
          this.setConnectionStatus('error');
        }
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log('WebSocket reconnected after', attemptNumber, 'attempts');
        this.setConnectionStatus('connected');
        this.reconnectAttempts = 0;
      });

      this.socket.on('reconnect_attempt', () => {
        this.setConnectionStatus('reconnecting');
      });

      // Connect manually
      this.socket.connect();
    } catch (error) {
      console.warn('WebSocket: Failed to initialize (using polling fallback)');
    }

    // Forward all events to registered listeners
    if (!this.socket) return; // Guard against null socket
    this.socket.onAny((event, data) => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.forEach((listener) => listener(data));
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
    this.subscriptions.clear();
    this.stopPing();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.setConnectionStatus('disconnected');
  }

  private setConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      this.statusListeners.forEach(listener => listener(status));
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectTimeout) {
      return; // Already attempting
    }

    const delays = [3000, 6000, 12000, 24000, 30000]; // Exponential backoff
    const delay = delays[Math.min(this.reconnectAttempts, delays.length - 1)];

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (this.socket && !this.socket.connected) {
        this.setConnectionStatus('reconnecting');
        this.socket.connect();
      }
    }, delay);
  }

  private startPing(): void {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      this.ping();
    }, 30000); // Ping every 30 seconds
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  subscribe(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Subscribe to event on server if connected
    if (this.socket?.connected && !this.subscriptions.has(event)) {
      this.socket.emit('subscribe', event);
      this.subscriptions.add(event);
    }

    // Return unsubscribe function
    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(callback);
        if (eventListeners.size === 0) {
          this.listeners.delete(event);
          // Unsubscribe from server
          if (this.socket?.connected && this.subscriptions.has(event)) {
            this.socket.emit('unsubscribe', event);
            this.subscriptions.delete(event);
          }
        }
      }
    };
  }

  /**
   * Subscribe to connection status changes
   */
  subscribeToStatus(callback: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(callback);
    // Immediately call with current status
    callback(this.connectionStatus);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Manual reconnect
   */
  reconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
    this.reconnectAttempts = 0;
    this.connect();
  }

  /**
   * Ping server to check connection health
   */
  ping(): void {
    if (this.socket?.connected) {
      this.socket.emit('ping', { timestamp: Date.now() });
    }
  }

  emit(event: string, data: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const websocketService = new WebSocketService();

