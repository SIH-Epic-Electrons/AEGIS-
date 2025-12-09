# Using Fabric Test Network with AEGIS

## ✅ Success! Fabric Test Network is Running

The Hyperledger Fabric test network is now successfully running with:
- ✅ Channel `mychannel` created
- ✅ Peers joined to channel
- ✅ Network ready for chaincode deployment

## Network Details

- **Channel**: `mychannel`
- **Organizations**: Org1, Org2
- **Peers**: 
  - `peer0.org1.example.com:7051`
  - `peer0.org2.example.com:9051`
- **Orderer**: `orderer.example.com:7050`

## Next Steps: Deploy AEGIS Chaincode

### 1. Deploy Audit Trail Chaincode

```bash
cd fabric-samples/test-network

# Package the chaincode
peer lifecycle chaincode package audit-trail.tar.gz \
  --path ../../AEGIS--main/backend/fabric-network/chaincode/audit-trail \
  --lang node \
  --label audit-trail_1.0

# Install on Org1
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051

peer lifecycle chaincode install audit-trail.tar.gz

# Install on Org2
export CORE_PEER_LOCALMSPID="Org2MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp
export CORE_PEER_ADDRESS=localhost:9051

peer lifecycle chaincode install audit-trail.tar.gz

# Approve and commit (as Org1 admin)
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051

# Get package ID
PACKAGE_ID=$(peer lifecycle chaincode queryinstalled --output json | jq -r '.installed_chaincodes[0].package_id')

# Approve for Org1
peer lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --channelID mychannel --name audit-trail --version 1.0 --package-id $PACKAGE_ID --sequence 1 --tls --cafile ${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem

# Approve for Org2
export CORE_PEER_LOCALMSPID="Org2MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp
export CORE_PEER_ADDRESS=localhost:9051

peer lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --channelID mychannel --name audit-trail --version 1.0 --package-id $PACKAGE_ID --sequence 1 --tls --cafile ${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem

# Commit (as Org1 admin)
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051

peer lifecycle chaincode commit -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --channelID mychannel --name audit-trail --version 1.0 --sequence 1 --tls --cafile ${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem --peerAddresses localhost:7051 --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt --peerAddresses localhost:9051 --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt
```

### 2. Update Backend Configuration

Update `backend/blockchain/network.yaml` to point to the test network:

```yaml
name: TestNetwork
version: 1.0.0
client:
  organization: Org1
  connection:
    timeout:
      peer:
        endorser: '300'
organizations:
  Org1:
    mspid: Org1MSP
    peers:
      - peer0.org1.example.com
    certificateAuthorities:
      - ca.org1.example.com
peers:
  peer0.org1.example.com:
    url: grpc://localhost:7051
    eventUrl: grpc://localhost:7053
    grpcOptions:
      ssl-target-name-override: peer0.org1.example.com
      request-timeout: 120001
certificateAuthorities:
  ca.org1.example.com:
    url: https://localhost:7054
    caName: ca.org1.example.com
    httpOptions:
      verify: false
channels:
  mychannel:
    orderers:
      - orderer.example.com
    peers:
      peer0.org1.example.com:
        endorsingPeer: true
        chaincodeQuery: true
        ledgerQuery: true
        eventSource: true
orderers:
  orderer.example.com:
    url: grpc://localhost:7050
    grpcOptions:
      ssl-target-name-override: orderer.example.com
```

### 3. Update Environment Variables

In your `.env` file:

```bash
BLOCKCHAIN_ENABLED=true
BLOCKCHAIN_NETWORK_CONFIG=./blockchain/network.yaml
BLOCKCHAIN_USER_NAME=Admin
BLOCKCHAIN_ORG_NAME=Org1
```

## Useful Commands

### Start/Stop Network
```bash
cd fabric-samples/test-network
./network.sh up createChannel    # Start network
./network.sh down                # Stop network
```

### Check Network Status
```bash
docker ps | grep -E "peer|orderer"
docker exec peer0.org1.example.com peer channel list
```

### Test Chaincode
```bash
# Invoke
peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile ${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem -C mychannel -n audit-trail --peerAddresses localhost:7051 --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt -c '{"function":"CreateAuditEvent","Args":["{\"eventId\":\"test123\",\"eventType\":\"LOGIN\",\"userId\":\"user1\"}"]}'

# Query
peer chaincode query -C mychannel -n audit-trail -c '{"function":"QueryAuditEvent","Args":["test123"]}'
```

## Benefits of Test Network

✅ **No MSP Issues**: Properly configured MSP out of the box  
✅ **Production-like**: Uses same structure as production networks  
✅ **Well-documented**: Extensive documentation and examples  
✅ **Easy to use**: Simple scripts for common operations  

## Troubleshooting

If you encounter issues:

1. **Check network is running**: `docker ps | grep peer`
2. **Check channel exists**: `docker exec peer0.org1.example.com peer channel list`
3. **View logs**: `docker logs peer0.org1.example.com`
4. **Restart network**: `./network.sh down && ./network.sh up createChannel`

## Next Steps

1. Deploy your audit-trail chaincode to the test network
2. Update backend configuration to use test network
3. Test blockchain integration with your AEGIS backend
4. Deploy predictions chaincode when ready

Your blockchain integration code is ready - just point it to the test network!

