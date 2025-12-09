# API Integration Documentation

## Overview

All API services have been updated to match the official AEGIS API documentation (v1.0.0). The base URL is configured as `http://localhost:8000/api/v1` for development and `https://api.aegis.gov.in/api/v1` for production.

## Updated Services

### 1. Authentication Service (`authService.ts`)
- ✅ `POST /auth/login` - Form-urlencoded login
- ✅ `POST /auth/logout` - Logout with token removal
- ✅ `GET /auth/me` - Get current user

### 2. Dashboard Service (`dashboardService.ts`)
- ✅ `GET /dashboard` - Get main dashboard data
- ✅ `GET /dashboard/stats` - Get comprehensive statistics with period filtering

### 3. Case Management Service (`caseService.ts`)
- ✅ `POST /cases` - Create new case
- ✅ `GET /cases` - List cases with filters
- ✅ `GET /cases/{case_id}` - Get case details
- ✅ `GET /cases/{case_id}/mule-accounts` - Get mule accounts
- ✅ `GET /cases/{case_id}/transactions` - Get transaction trail

### 4. Prediction Service (`predictionService.ts`)
- ✅ `GET /predictions/case/{case_id}` - Get case prediction
- ✅ `POST /predictions/feedback/{prediction_id}` - Submit prediction feedback

### 5. Officer Service (`officerService.ts`)
- ✅ `GET /officers/me` - Get my profile
- ✅ `PUT /officers/me` - Update my profile
- ✅ `GET /officers/stats` - Get my statistics

### 6. Team Service (`teamService.ts`)
- ✅ `GET /teams` - List teams with status filter
- ✅ `GET /teams/{team_id}` - Get team details
- ✅ `POST /teams/{team_id}/deploy` - Deploy team
- ✅ `POST /teams/{team_id}/message` - Send team message

### 7. ATM Service (`atmService.ts`)
- ✅ `GET /atms` - List ATMs with location/bank filters
- ✅ `GET /atms/{atm_id}` - Get ATM details

### 8. Graph Service (`graphService.ts`)
- ✅ `GET /graph/case/{case_id}` - Get case graph
- ✅ `POST /graph/case/{case_id}/trace` - Trace money flow
- ✅ `GET /graph/mule/{account_id}/network` - Get mule network
- ✅ `GET /graph/case/{case_id}/visualization` - Get visualization graph

## Legacy Services (Maintained for Compatibility)

- `actionService.ts` - Handles actions, freezing, outcomes (may use different endpoints)
- `alertService.ts` - Alert management with I4C coordination
- `reportService.ts` - Report submission and status
- `leaService.ts` - LEA-specific endpoints
- `predictiveAnalyticsService.ts` - Predictive analytics engine
- `securityService.ts` - Security and compliance

## Configuration

Base URL is configured in `src/constants/config.ts`:
- Development: `http://localhost:8000/api/v1`
- Production: `https://api.aegis.gov.in/api/v1`

## Authentication

All services use Bearer token authentication. The token is automatically added via request interceptors from `secureStorage`.

## Error Handling

All services include:
- Network error handling with fallback to mock data for demo
- Proper error messages from API responses
- Consistent `ServiceResponse<T>` interface

## Mock Data

When the backend is unavailable (ERR_NETWORK or ECONNREFUSED), services return mock data to allow frontend development and testing.

## Usage Example

```typescript
import { caseService, dashboardService, authService } from '../api';

// Login
const loginResult = await authService.login('badge-id', 'password');
if (loginResult.success) {
  console.log('Logged in:', loginResult.data);
}

// Get dashboard
const dashboard = await dashboardService.getDashboard();
if (dashboard.success) {
  console.log('Dashboard data:', dashboard.data);
}

// Get case details
const caseDetails = await caseService.getCaseDetails('case-id');
if (caseDetails.success) {
  console.log('Case:', caseDetails.data);
}
```

## Next Steps

1. Update frontend components to use the new service methods
2. Replace any direct API calls with service methods
3. Test all endpoints with the actual backend
4. Remove mock data fallbacks when backend is stable

