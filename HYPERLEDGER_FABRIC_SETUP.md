# Hyperledger Fabric Setup for AEGIS

Hyperledger Fabric has been installed and configured for the AEGIS audit trail system. This document provides an overview of what was set up.

## What Was Installed

### 1. Network Configuration
- **Location**: `backend/fabric-network/`
- **Network Type**: 2-organization network (Org1: AEGIS Backend, Org2: Audit Authority)
- **Orderer**: Solo orderer (development mode)
- **Channel**: `audit-channel`
- **Chaincode**: `audit-trail` (JavaScript)

### 2. Chaincode
- **Location**: `backend/fabric-network/chaincode/audit-trail/`
- **Language**: JavaScript (Node.js)
- **Functions**:
  - `CreateAuditEvent`: Store audit events on blockchain
  - `QueryAuditEvent`: Query specific event by ID
  - `QueryAuditEventsByOfficer`: Get all events for an officer
  - `QueryAuditEventsByType`: Get events by type
  - `QueryAuditEventsByDateRange`: Get events in date range
  - `QueryAuditEventsByAlert`: Get events by alert ID
  - `QueryAuditEventsByComplaint`: Get events by complaint ID

### 3. Backend Integration
- **Service**: `backend/app/services/fabric_service.py`
- **API Endpoints**: `backend/app/api/v1/endpoints/audit.py`
  - `POST /api/v1/audit/events` - Create audit event
  - `GET /api/v1/audit/events/{event_id}` - Get specific event
  - `GET /api/v1/audit/events` - Query events with filters

### 4. Setup Scripts
- `scripts/check-prerequisites.sh` - Check if all prerequisites are installed
- `scripts/install-fabric.sh` - Install Fabric binaries and Docker images
- `scripts/setup-network.sh` - Generate network configuration
- `scripts/start-network.sh` - Start the Fabric network
- `scripts/stop-network.sh` - Stop the Fabric network

## Quick Start

### 1. Check Prerequisites
```bash
cd backend/fabric-network
./scripts/check-prerequisites.sh
```

### 2. Install Fabric
```bash
./scripts/install-fabric.sh
```

### 3. Setup Network
```bash
./scripts/setup-network.sh
```

### 4. Start Network
```bash
./scripts/start-network.sh
```

## Documentation

- **Setup Guide**: `backend/fabric-network/SETUP_GUIDE.md` - Detailed setup instructions
- **Quick Start**: `backend/fabric-network/QUICKSTART.md` - Quick reference guide
- **README**: `backend/fabric-network/README.md` - Overview and architecture

## Network Architecture

```
┌─────────────────┐
│   Orderer       │
│  (Solo)         │
│  :7050          │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌───▼───┐
│ Org1  │ │ Org2  │
│ Peer0 │ │ Peer0 │
│ :7051 │ │ :9051 │
└───────┘ └───────┘
    │         │
    └────┬────┘
         │
    ┌────▼────┐
    │ Channel │
    │audit-   │
    │channel  │
    └─────────┘
```

## Integration with Frontend

The frontend already has audit service integration:
- **File**: `aegies-frontend/src/services/auditService.ts`
- **Endpoint**: Sends events to `/api/v1/audit/events`
- **Event Types**: ComplaintFiled, AlertTriggered, CordonActivated, OutcomeLogged, EvidenceCaptured, ActionTaken

## Current Status

✅ Network configuration created
✅ Chaincode implemented
✅ Backend service created
✅ API endpoints created
✅ Setup scripts created
✅ Documentation created

⚠️ **Note**: The Fabric service currently uses local storage as a fallback. To enable full blockchain integration:

1. Start the Fabric network (see Quick Start above)
2. Update `fabric_service.py` to use actual Fabric SDK/gRPC calls
3. Configure network connection settings in `.env`

## Testing

### Test Chaincode Directly
```bash
docker exec -it cli bash
peer chaincode invoke -C audit-channel -n audit-trail -c '{"Args":["CreateAuditEvent",...]}'
```

### Test via API
```bash
curl -X POST http://localhost:8000/api/v1/audit/events \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"eventType":"ComplaintFiled","complaintId":"test-123"}'
```

## Next Steps

1. **Start the Network**: Follow Quick Start guide
2. **Test Integration**: Verify API endpoints work
3. **Production Setup**: Configure for production (Raft ordering, TLS, etc.)
4. **Monitoring**: Set up monitoring and logging
5. **Backup**: Configure backup strategy for ledger data

## Support

For issues:
1. Check logs: `docker-compose -f network-config/docker-compose.yaml logs -f`
2. Review setup guide: `backend/fabric-network/SETUP_GUIDE.md`
3. Check prerequisites: `./scripts/check-prerequisites.sh`

## Resources

- [Hyperledger Fabric Docs](https://hyperledger-fabric.readthedocs.io/)
- [Fabric Samples](https://github.com/hyperledger/fabric-samples)
- [AEGIS Fabric Setup Guide](./backend/fabric-network/SETUP_GUIDE.md)

