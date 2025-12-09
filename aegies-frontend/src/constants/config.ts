// For physical devices, replace 'localhost' with your computer's IP address
// Find your IP: macOS/Linux: `ifconfig | grep "inet "` or `ipconfig getifaddr en0`
// Windows: `ipconfig` (look for IPv4 Address)
// Example: 'http://192.168.1.100:3000/api'
// 
// Detected IP (update if different): 192.168.0.37
// For physical devices, use: 'http://192.168.0.37:3000/api'

// Try to get IP from environment variable, fallback to localhost
const getDevAPIUrl = () => {
  // Check if we have a custom dev URL set
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // For physical devices, use your computer's IP address
  // Update this IP to match your computer's IP (run ipconfig to find it)
  // Your current IP: 192.168.137.248
  return 'http://192.168.137.248/api/v1';
};

export const API_BASE_URL = __DEV__
  ? getDevAPIUrl()
  : 'https://api.aegis.gov.in/api/v1';

// Predictive Analytics Engine URL
const getDevPredictionUrl = () => {
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_PREDICTION_URL) {
    return process.env.EXPO_PUBLIC_PREDICTION_URL;
  }
  return 'http://localhost:8000';
};

export const PREDICTION_ENGINE_URL = __DEV__
  ? getDevPredictionUrl()
  : 'https://prediction-engine.aegis.gov.in';

export const CONFIG = {
  API_BASE_URL,
  PREDICTION_ENGINE_URL,
  APP_NAME: 'AEGIS',
  APP_VERSION: '1.0.0',
  ALERT_POLL_INTERVAL: 30000, // 30 seconds
  SYNC_INTERVAL: 60000, // 1 minute
  MAX_OFFLINE_QUEUE: 100,
  EVIDENCE_MAX_SIZE: 10 * 1024 * 1024, // 10MB
  CORDON_RADIUS: 2000, // 2km in meters
  AR_UPDATE_INTERVAL: 1000, // 1 second for AR distance updates
  PREDICTION_REFRESH_INTERVAL: 30000, // 30 seconds for prediction updates
};

export default CONFIG;

