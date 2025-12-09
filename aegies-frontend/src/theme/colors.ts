// AEGIS Theme Colors - Matching MVP Design (Light Theme)
// Based on Tailwind CSS slate-50, gray-900, blue-600, red-500, green-500

export const lightColors = {
  // Primary Colors (Blue from MVP)
  primary: '#3b82f6', // blue-600
  primaryDark: '#2563eb', // blue-700
  primaryLight: '#60a5fa', // blue-400
  
  // Background (Slate-50 from MVP)
  background: '#f8fafc', // slate-50
  surface: '#FFFFFF', // white
  surfaceElevated: '#FFFFFF',
  card: '#FFFFFF',
  
  // Text (Gray scale from MVP)
  text: '#111827', // gray-900
  textSecondary: '#6b7280', // gray-500
  textTertiary: '#9ca3af', // gray-400
  
  // Borders & Dividers
  border: '#e5e7eb', // gray-200
  divider: '#f3f4f6', // gray-100
  
  // Status Colors (Exact from MVP)
  success: '#22c55e', // green-500
  successLight: '#dcfce7', // green-100
  warning: '#f59e0b', // amber-500
  warningLight: '#fef3c7', // amber-100
  error: '#ef4444', // red-500
  errorLight: '#fee2e2', // red-100
  info: '#3b82f6', // blue-600
  infoLight: '#dbeafe', // blue-100
  infoDark: '#1e40af', // blue-800
  
  // Priority Colors (From MVP)
  highPriority: '#ef4444', // red-500
  mediumPriority: '#f59e0b', // amber-500
  lowPriority: '#eab308', // yellow-500
  
  // Accent
  accent: '#3b82f6', // blue-600
  accentLight: '#60a5fa', // blue-400
  
  // Secondary (for compatibility)
  secondary: '#8b5cf6', // purple-500
  secondaryDark: '#7c3aed', // purple-600
  secondaryLight: '#a78bfa', // purple-400
  
  // Overlay
  overlay: 'rgba(0, 0, 0, 0.6)',
  overlayLight: 'rgba(0, 0, 0, 0.1)',
  
  // Background variants
  backgroundDark: '#1e293b', // slate-800
  backgroundDarker: '#0f172a', // slate-900
  
  // Text variants
  textLight: '#FFFFFF',
  textLightSecondary: 'rgba(255, 255, 255, 0.7)',
  
  // MVP Specific Colors
  cyan: '#06b6d4', // cyan-500
  slate: '#64748b', // slate-500
  slateLight: '#f1f5f9', // slate-100
};

export const darkColors = {
  // Primary Colors
  primary: '#FF6B7F',
  primaryDark: '#e94560',
  primaryLight: '#ff8fa3',
  
  // Background
  background: '#000000',
  surface: '#1C1C1E',
  surfaceElevated: '#2C2C2E',
  card: '#1C1C1E',
  
  // Text
  text: '#FFFFFF',
  textSecondary: '#98989D',
  textTertiary: '#636366',
  
  // Borders & Dividers
  border: '#38383A',
  divider: '#2C2C2E',
  
  // Status Colors
  success: '#30D158',
  warning: '#FF9F0A',
  error: '#FF453A',
  info: '#0A84FF',
  
  // Priority Colors
  highPriority: '#FF453A',
  mediumPriority: '#FF9F0A',
  lowPriority: '#FFD60A',
  
  // Accent
  accent: '#0A84FF',
  accentLight: '#40A6FF',
  
  // Overlay
  overlay: 'rgba(0, 0, 0, 0.6)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
};

export type ColorScheme = 'light' | 'dark' | 'auto';

export const getColors = (scheme: 'light' | 'dark') => {
  return scheme === 'dark' ? darkColors : lightColors;
};

