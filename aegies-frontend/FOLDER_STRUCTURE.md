# AEGIS Frontend - Folder Structure Guide

## Current Structure

```
src/
├── api/              # API service layer (all API calls)
│   ├── authService.ts
│   ├── caseService.ts
│   ├── dashboardService.ts
│   └── ...
├── components/       # Reusable UI components
├── constants/         # App constants and config
├── context/          # React Context providers
├── hooks/            # Custom React hooks
├── screens/          # Screen components (ONLY .tsx files)
├── services/         # Business logic services
│   ├── apiClient.ts  # Centralized API client
│   ├── locationService.ts  # Location handling
│   └── ...
├── store/            # State management (Zustand)
├── theme/            # Theme configuration
├── types/            # TypeScript type definitions
└── utils/            # Utility functions
```

## Cleanup Required

### Duplicate Files to Remove

The following `.js` files in `screens/` should be removed (use `.tsx` versions instead):

- ❌ `screens/AlertDetailScreen.js` → Use `AlertDetailScreen.tsx`
- ❌ `screens/AlertsScreen.js` → Use `AlertsScreen.tsx`
- ❌ `screens/DashboardScreen.js` → Use `DashboardScreen.tsx`
- ❌ `screens/LoginScreen.js` → Use `AuthScreen.tsx`
- ❌ `screens/MapScreen.js` → Use `MapScreen.tsx`
- ❌ `screens/ReportsScreen.js` → Use `ReportsScreen.tsx`
- ❌ `screens/SettingsScreen.js` → Use `SettingsScreen.tsx`

## Best Practices

1. **Screens**: Only `.tsx` files, no `.js` duplicates
2. **Services**: Business logic, API calls, utilities
3. **Components**: Reusable, presentational components
4. **API Layer**: All backend communication goes through `api/` folder
5. **Types**: Shared TypeScript definitions in `types/`

## Migration Steps

1. Verify `.tsx` versions work correctly
2. Remove duplicate `.js` files
3. Update any imports that reference `.js` files
4. Test all screens to ensure nothing breaks

