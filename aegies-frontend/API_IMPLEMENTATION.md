# AEGIS API Implementation Guide

## Overview

This document provides a comprehensive guide to the API implementation in the AEGIS React Native application. All API services have been implemented according to the official API documentation.

**Base URL:** `http://localhost:8000/api/v1`  
**Authentication:** Bearer Token (JWT)

---

## API Services Implementation

### 1. Authentication Service (`src/api/authService.ts`)

**Endpoints Implemented:**
- ✅ `POST /auth/login` - Login with username/password (form-urlencoded)
- ✅ `POST /auth/logout` - Logout current user
- ✅ `GET /auth/me` - Get current user information

**Features:**
- Automatic token storage in secure storage
- Token injection in request headers
- Network error handling with mock fallback
- Proper error responses for 401/403 status codes

**Usage:**
```typescript
import { authService } from '../api/authService';

// Login
const result = await authService.login('badge_id_or_email', 'password');
if (result.success) {
  const { access_token, officer } = result.data;
}

// Get current user
const userResult = await authService.getCurrentUser();
if (userResult.success) {
  const officer = userResult.data;
}

// Logout
await authService.logout();
```

---

### 2. Dashboard Service (`src/api/dashboardService.ts`)

**Endpoints Implemented:**
- ✅ `GET /dashboard` - Get main dashboard data
- ✅ `GET /dashboard/stats` - Get dashboard statistics with period filter

**Query Parameters:**
- `period`: `today` | `week` | `month` | `all` (default: `all`)

**Usage:**
```typescript
import { dashboardService } from '../api/dashboardService';

// Get dashboard
const result = await dashboardService.getDashboard();
if (result.success) {
  const { officer_stats, priority_alerts, live_activity, ai_insight } = result.data;
}

// Get statistics
const statsResult = await dashboardService.getDashboardStats('week');
if (statsResult.success) {
  const stats = statsResult.data;
}
```

---

### 3. Case Management Service (`src/api/caseService.ts`)

**Endpoints Implemented:**
- ✅ `POST /cases` - Create new case
- ✅ `GET /cases` - List cases with filters
- ✅ `GET /cases/{case_id}` - Get case details
- ✅ `GET /cases/{case_id}/mule-accounts` - Get mule accounts for case
- ✅ `GET /cases/{case_id}/transactions` - Get transaction trail

**Query Parameters for List Cases:**
- `status`: Filter by status
- `priority`: Filter by priority
- `assigned_to`: `me` for current officer
- `limit`: Max results (default: 20, max: 100)
- `offset`: Pagination offset (default: 0)

**Usage:**
```typescript
import { caseService } from '../api/caseService';

// Create case
const createResult = await caseService.createCase({
  ncrp_complaint_id: 'NCRP-2025-MH-123456',
  fraud_type: 'UPI_FRAUD',
  fraud_amount: 85000,
  destination_account: { ... },
  victim: { ... }
});

// List cases
const listResult = await caseService.listCases({
  status: 'IN_PROGRESS',
  priority: 'HIGH',
  limit: 20,
  offset: 0
});

// Get case details
const detailsResult = await caseService.getCaseDetails('case-id');

// Get mule accounts
const muleResult = await caseService.getCaseMuleAccounts('case-id');

// Get transactions
const txnResult = await caseService.getCaseTransactions('case-id');
```

---

### 4. AI Predictions Service (`src/api/predictionService.ts`)

**Endpoints Implemented:**
- ✅ `GET /predictions/case/{case_id}` - Get case prediction
- ✅ `POST /predictions/feedback/{prediction_id}` - Submit prediction feedback

**Usage:**
```typescript
import { predictionService } from '../api/predictionService';

// Get prediction
const predResult = await predictionService.getCasePrediction('case-id');
if (predResult.success) {
  const { location_prediction, time_prediction, model_info } = predResult.data;
}

// Submit feedback
const feedbackResult = await predictionService.submitPredictionFeedback('prediction-id', {
  was_correct: true,
  actual_location: 'atm-uuid',
  notes: 'Withdrawal happened at predicted ATM'
});
```

---

### 5. Officers Service (`src/api/officerService.ts`)

**Endpoints Implemented:**
- ✅ `GET /officers/me` - Get my profile
- ✅ `PUT /officers/me` - Update my profile
- ✅ `GET /officers/stats` - Get my statistics

**Usage:**
```typescript
import { officerService } from '../api/officerService';

// Get profile
const profileResult = await officerService.getMyProfile();

// Update profile
const updateResult = await officerService.updateMyProfile({
  phone: '+919876543211',
  settings: {
    notifications_enabled: true,
    dark_mode: false
  }
});

// Get statistics
const statsResult = await officerService.getMyStatistics();
```

---

### 6. Teams Service (`src/api/teamService.ts`)

**Endpoints Implemented:**
- ✅ `GET /teams` - List teams
- ✅ `GET /teams/{team_id}` - Get team details
- ✅ `POST /teams/{team_id}/deploy` - Deploy team
- ✅ `POST /teams/{team_id}/message` - Send team message

**Query Parameters for List Teams:**
- `status`: `AVAILABLE` | `DEPLOYED` | `OFF_DUTY`

**Usage:**
```typescript
import { teamService } from '../api/teamService';

// List teams
const teamsResult = await teamService.listTeams('AVAILABLE');

// Get team details
const teamResult = await teamService.getTeamDetails('team-id');

// Deploy team
const deployResult = await teamService.deployTeam('team-id', {
  case_id: 'case-id',
  target_location: { lat: 19.2183, lon: 72.9781 },
  priority: 'URGENT',
  instructions: 'Cover SBI ATM Thane West'
});

// Send message
const messageResult = await teamService.sendTeamMessage('team-id', {
  case_id: 'case-id',
  message: 'Suspect sighted. Approach with caution.',
  priority: 'HIGH'
});
```

---

### 7. ATMs Service (`src/api/atmService.ts`)

**Endpoints Implemented:**
- ✅ `GET /atms` - List ATMs
- ✅ `GET /atms/{atm_id}` - Get ATM details

**Query Parameters for List ATMs:**
- `lat`: Center latitude
- `lon`: Center longitude
- `radius_km`: Search radius (default: 5)
- `bank`: Filter by bank
- `city`: Filter by city
- `limit`: Max results (default: 50, max: 200)

**Usage:**
```typescript
import { atmService } from '../api/atmService';

// List ATMs
const atmsResult = await atmService.listATMs({
  lat: 19.076,
  lon: 72.8777,
  radius_km: 10,
  bank: 'SBI',
  limit: 50
});

// Get ATM details
const atmResult = await atmService.getATMDetails('atm-id');
```

---

### 8. Graph Visualization Service (`src/api/graphService.ts`)

**Endpoints Implemented:**
- ✅ `GET /graph/case/{case_id}` - Get case graph
- ✅ `POST /graph/case/{case_id}/trace` - Trace money flow
- ✅ `GET /graph/mule/{account_id}/network` - Get mule network
- ✅ `GET /graph/case/{case_id}/visualization` - Get graph for visualization

**Usage:**
```typescript
import { graphService } from '../api/graphService';

// Get case graph
const graphResult = await graphService.getCaseGraph('case-id');

// Trace money flow
const traceResult = await graphService.traceMoneyFlow('case-id');

// Get mule network
const networkResult = await graphService.getMuleNetwork('account-id');

// Get visualization graph
const vizResult = await graphService.getGraphForVisualization('case-id');
```

---

### 9. Action Service (`src/api/actionService.ts`)

**Endpoints Implemented:**
- ✅ `POST /alerts/{alertId}/freeze` - Freeze account
- ✅ `POST /alerts/{alertId}/cordon` - Activate digital cordon
- ✅ `DELETE /alerts/{alertId}/cordon` - Deactivate digital cordon
- ✅ `POST /alerts/{alertId}/outcome` - Submit outcome
- ✅ `POST /evidence` - Upload evidence

**Usage:**
```typescript
import { actionService } from '../api/actionService';

// Freeze account
const freezeResult = await actionService.freezeAccount('alert-id', 'complaint-id');

// Activate cordon
const cordonResult = await actionService.activateCordon('alert-id', 'hotspot-id');

// Submit outcome
const outcomeResult = await actionService.submitOutcome('alert-id', {
  success: true,
  amountRecovered: 85000,
  suspectApprehended: true,
  notes: 'Suspect apprehended at ATM'
});

// Upload evidence
const evidenceResult = await actionService.uploadEvidence({
  id: 'evidence-id',
  alertId: 'alert-id',
  type: 'photo',
  uri: 'file://...',
  annotations: [],
  redacted: false
});
```

---

### 10. Federated Learning Service (`src/api/federatedLearningService.ts`)

**Endpoints Implemented:**
- ✅ `GET /fl/health` - Health check
- ✅ `GET /fl/config` - Get configuration
- ✅ `POST /fl/clients/register` - Register client
- ✅ `GET /fl/clients` - List clients
- ✅ `POST /fl/rounds/start` - Start training round
- ✅ `POST /fl/rounds/{round_number}/update` - Submit weight update
- ✅ `GET /fl/rounds/{round_number}/status` - Get round status
- ✅ `POST /fl/rounds/{round_number}/aggregate` - Aggregate round
- ✅ `GET /fl/models/{model_type}/global` - Get global model
- ✅ `GET /fl/models/{model_type}/version` - Get model version
- ✅ `GET /fl/progress/{model_type}` - Get training progress

**Note:** These endpoints do NOT require authentication.

**Usage:**
```typescript
import { federatedLearningService } from '../api/federatedLearningService';

// Health check
const healthResult = await federatedLearningService.healthCheck();

// Get config
const configResult = await federatedLearningService.getConfig();

// Register client
const registerResult = await federatedLearningService.registerClient({
  client_id: 'sbi',
  info: {
    bank_name: 'State Bank of India',
    region: 'Maharashtra'
  }
});

// Start training round
const roundResult = await federatedLearningService.startTrainingRound({
  model_type: 'cst_transformer',
  client_ids: ['sbi', 'hdfc', 'icici']
});

// Submit weight update
const weightResult = await federatedLearningService.submitWeightUpdate(43, {
  client_id: 'sbi',
  model_type: 'cst_transformer',
  round_number: 43,
  weights: { ... },
  num_samples: 5400,
  metrics: { loss: 7.234, accuracy: 0.0015 }
});
```

---

## Common Patterns

### Service Response Format

All services return a consistent `ServiceResponse<T>` format:

```typescript
interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### Error Handling

All services handle:
- Network errors (with mock fallback for development)
- HTTP error responses (401, 403, 404, 500, etc.)
- Timeout errors
- Invalid responses

### Authentication

All authenticated endpoints automatically:
- Retrieve token from secure storage
- Inject `Authorization: Bearer <token>` header
- Handle token expiration (401 responses)

### Mock Data Fallback

When the backend is unreachable (development mode), all services provide realistic mock data to allow frontend development to continue.

---

## Configuration

API configuration is managed in `src/constants/config.ts`:

```typescript
export const API_BASE_URL = __DEV__
  ? 'http://localhost:8000/api/v1'
  : 'https://api.aegis.gov.in/api/v1';
```

For physical devices, update `localhost` to your computer's IP address.

---

## Rate Limiting

The API implements rate limiting:
- **Default**: 100 requests/minute per client
- **FL endpoints**: 1000 requests/minute
- **Dashboard**: 30 requests/minute

The frontend should handle rate limit errors (429 status code) gracefully.

---

## Testing

All services can be tested independently:

```typescript
// Example test
import { authService } from '../api/authService';

test('login should return access token', async () => {
  const result = await authService.login('test@example.com', 'password');
  expect(result.success).toBe(true);
  expect(result.data?.access_token).toBeDefined();
});
```

---

## Next Steps

1. **Integration Testing**: Test all endpoints with actual backend
2. **Error Recovery**: Implement retry logic for transient failures
3. **Caching**: Add response caching for frequently accessed data
4. **Offline Support**: Implement offline queue for critical actions
5. **WebSocket Integration**: Connect real-time updates via WebSocket

---

## Support

For API documentation, visit:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
- **OpenAPI JSON**: `http://localhost:8000/openapi.json`

---

*Last Updated: December 2025*  
*API Version: 1.0.0*

