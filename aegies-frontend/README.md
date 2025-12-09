# AEGIS LEA Mobile App

**Project AEGIS** - India's Cyber Shield. A production-grade, real-time AI-powered predictive intervention system for Law Enforcement Agency (LEA) officers.

> 📋 **For complete documentation, see [REPORT.md](./REPORT.md)**

## 🛡️ Overview

AEGIS transforms India's cybercrime response from reactive complaint handling into proactive, geospatially precise interdiction. The mobile app provides LEA officers with:

- **Real-time AI Predictions**: Top 3 likely cash withdrawal locations within 90 minutes
- **AR Field View**: Augmented reality guidance to predicted hotspots
- **Digital Cordon**: NPCI-integrated transaction freeze (2km radius)
- **Evidence Logger**: Camera-based evidence capture with auto-redaction
- **Offline Support**: Full functionality in rural areas with poor connectivity
- **Biometric Security**: Aadhaar OTP + Face ID/Fingerprint authentication

## 🏗️ Project Structure

```
AEGIS/
├── App.tsx                   # Root app with navigation
├── app.json                  # Expo configuration
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript configuration
├── src/
│   ├── api/                  # API services
│   │   ├── authService.ts    # Aadhaar OTP authentication
│   │   ├── alertService.ts   # Alert and dossier fetching
│   │   └── actionService.ts  # Actions (freeze, evidence, outcomes)
│   ├── components/           # Reusable UI components
│   │   ├── StatCard.tsx
│   │   ├── PredictionCard.tsx
│   │   └── AlertCard.tsx
│   ├── constants/            # App constants
│   │   ├── colors.ts         # Color palette
│   │   └── config.ts         # Configuration
│   ├── context/              # React Context (legacy, using Zustand now)
│   ├── hooks/                # Custom hooks
│   │   └── useBiometricLock.ts
│   ├── screens/              # Screen components
│   │   ├── AuthScreen.tsx           # Aadhaar OTP login
│   │   ├── DashboardScreen.tsx      # Home dashboard
│   │   ├── MapScreen.tsx            # Hotspot map
│   │   ├── AlertsScreen.tsx         # Active alerts
│   │   ├── AlertDetailScreen.tsx    # Alert dossier view
│   │   ├── ARScreen.tsx            # AR field view
│   │   ├── EvidenceScreen.tsx      # Evidence logger
│   │   ├── ReportsScreen.tsx       # Report submission
│   │   └── SettingsScreen.tsx      # Settings
│   ├── services/             # Core services
│   │   ├── secureStorage.ts  # Encrypted storage (expo-secure-store)
│   │   └── syncManager.ts    # Background sync
│   ├── store/                # Zustand state management
│   │   ├── authStore.ts      # Authentication state
│   │   └── alertStore.ts     # Alerts and actions state
│   ├── types/                # TypeScript interfaces
│   │   └── index.ts
│   └── utils/                # Utility functions
│       ├── geodesy.ts       # Distance/bearing calculations
│       ├── redaction.ts      # Privacy redaction (DPDP Act)
│       └── offlineManager.ts # SQLite offline queue
└── assets/                   # Images and icons
```

## 🚀 Features

### Core Functionality

1. **Authentication**
   - Aadhaar-based OTP login
   - Biometric lock (Face ID/Fingerprint)
   - Secure token storage (expo-secure-store)

2. **Real-time Dashboard**
   - Active predictions and alerts
   - Statistics (complaints, funds recovered, success rate)
   - Quick actions

3. **AR Field View**
   - Camera overlay with distance/bearing to hotspot
   - Real-time location tracking
   - ETA calculation
   - Interdiction confirmation

4. **Evidence Logger**
   - Camera capture
   - Auto-redaction (account numbers, phone numbers)
   - Manual annotations (blur, circle, label)
   - Offline queue with background sync

5. **Offline Support**
   - SQLite database for caching
   - Action queue for offline operations
   - Background sync when online
   - Evidence upload queue

6. **Digital Cordon**
   - Activate transaction freeze (2km radius)
   - NPCI integration ready
   - Real-time status updates

## 📦 Installation

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (Mac) or Android Studio

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start development server**
   ```bash
   npm start
   ```

3. **Run on device/simulator**
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app

## 🔧 Configuration

### API Endpoints

Update `src/constants/config.ts`:

```typescript
export const API_BASE_URL = 'https://api.aegis.gov.in/api';
```

### Environment Variables

Create `.env` file:

```env
API_BASE_URL=https://api.aegis.gov.in/api
EXPO_PUBLIC_ENV=production
```

## 🎨 Design System

### Colors

- **Saffron**: `#FF9933` (National color)
- **Green**: `#138808` (National color)
- **Cyber Blue**: `#007BFF`
- **Error/High Priority**: `#e94560`
- **Warning/Medium Priority**: `#ff9800`
- **Success**: `#4CAF50`

### Typography

- **Font**: Inter (via `@expo-google-fonts/inter`)
- **Primary**: 16px, 18px, 20px, 24px
- **Secondary**: 12px, 14px

## 🔐 Security & Compliance

- **DPDP Act 2023**: Auto-redaction of sensitive data
- **Encryption**: AES-256 via expo-secure-store
- **Biometric Auth**: Face ID / Fingerprint
- **Audit Trail**: All actions logged to backend

## 📱 Key Technologies

| Technology | Purpose |
|-----------|---------|
| React Native 0.74 | Cross-platform framework |
| Expo 51 | Development platform |
| TypeScript | Type safety |
| Zustand | State management |
| React Navigation | Navigation |
| Expo Camera | Camera & AR |
| Expo Location | Geolocation |
| Expo SQLite | Offline database |
| Expo Secure Store | Encrypted storage |
| Expo Background Fetch | Background sync |

## 🔄 Workflow: Alert to Interdiction

1. **Officer logs in** → Aadhaar OTP + Biometric lock
2. **Receives alert** → Views dossier with victim (anonymized), suspect MO, hotspots
3. **Opens AR View** → Real-time distance/bearing to hotspot
4. **Arrives at hotspot** → Confirms interdiction
5. **Captures evidence** → Auto-redacted, queued offline
6. **Submits outcome** → Funds recovered, suspect status
7. **Background sync** → Evidence uploaded when online

## 🧪 Development

### Type Checking

```bash
npm run type-check
```

### Building for Production

#### iOS
```bash
expo build:ios
```

#### Android
```bash
expo build:android
```

## 📝 API Integration

The app uses mock data by default. To connect to your backend:

1. Update `API_BASE_URL` in `src/constants/config.ts`
2. Implement these endpoints:
   - `POST /api/auth/lea-login` - Aadhaar OTP login
   - `GET /api/alerts?role=lea` - Get alerts
   - `GET /api/alerts/:id` - Get alert with dossier
   - `POST /api/alerts/:id/cordon` - Activate digital cordon
   - `POST /api/actions` - Submit action
   - `POST /api/evidence` - Upload evidence
   - `POST /api/alerts/:id/outcome` - Submit outcome

## 🐛 Troubleshooting

### Camera Permission Issues
- Ensure `expo-camera` permissions in `app.json`
- Check device settings

### Location Not Working
- Verify location permissions in `app.json`
- Check device location services

### Offline Queue Not Syncing
- Check network connectivity
- Verify background fetch is registered
- Check `expo-background-fetch` configuration

## 📄 License

Developed for National Cybercrime Reporting Portal (NCRP) - SIH 2025, Problem Statement #25257.

## 🙏 Acknowledgments

- National Cybercrime Reporting Portal (NCRP)
- NPCI for Digital Cordon integration
- Law Enforcement Agencies across India

---

**AEGIS** - India's Sovereign Shield Against Digital Fraud 🇮🇳
