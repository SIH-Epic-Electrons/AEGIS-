# AEGIS - Anticipatory Engine for Geolocated Intervention against Scams

**A Comprehensive AI-Powered Fraud Detection and Prevention System**

---

## 📋 Problem Statement

### Current Challenges

1. **Rapid Money Movement**: Fraudsters transfer stolen money across multiple accounts within minutes, making recovery nearly impossible once funds are withdrawn.



2. **Manual Investigation Process**: Traditional fraud investigation relies on manual processes, taking hours or days to trace transactions, by which time money is already withdrawn.

3. **Mule Account Proliferation**: Criminals use "mule accounts" (accounts opened specifically to receive and transfer stolen money) that are difficult to identify using traditional methods.

4. **Time-Critical Nature**: The window to prevent money withdrawal is extremely narrow (typically 30-60 minutes), requiring immediate action.

5. **Limited Cross-Bank Visibility**: Law Enforcement Agencies (LEA) cannot track money flow across different banks in real-time, leading to delayed responses.


### Impact

- **Financial Loss**: Billions of rupees lost annually to online fraud
- **Victim Suffering**: Citizens lose life savings, leading to severe distress
- **Law Enforcement Overload**: LEA officers struggle with overwhelming case volumes
- **Low Recovery Rate**: Less than 5% of fraud money is recovered

---

## 🎯 Motive

### Primary Goal

**To create an AI-powered system that can:**
1. **Predict** where and when the criminals will withdraw money (specific ATM locations)
2. **Identify** mule accounts in transaction chains
3. **Freeze** accounts within seconds to prevent money withdrawal
4. **Alert** nearby law enforcement teams to intercept criminals

### Why This Matters

- **Speed**: Money moves in seconds, criminals travel in minutes - we need to act faster
- **Prevention**: Freezing accounts prevents money withdrawal, enabling recovery
- **Efficiency**: AI automation reduces investigation time from hours to seconds
- **Justice**: Helps catch criminals and recover victim funds

### Real-World Impact

- **Before AEGIS**: 5% recovery rate, hours of investigation time
- **With AEGIS**: 60%+ recovery rate (estimated), seconds of analysis time

---

## 🚀 Approach to Solve

### Three-Pillar Solution

#### 1. **Predictive Analytics (CST Transformer)**
- **What**: Predicts where criminals will withdraw money
- **How**: Uses Spatio-Temporal Transformer to analyze:
  - Victim location
  - Fraud type and timing
  - Historical ATM usage patterns
  - Geographic and temporal patterns
- **Output**: Top 3 predicted ATM locations with confidence scores

#### 2. **Mule Account Detection (GNN)**
- **What**: Identifies mule accounts in transaction networks
- **How**: Uses Graph Neural Network to analyze:
  - Account relationships and transaction patterns
  - Account characteristics (age, balance, velocity)
  - Network structure and money flow
- **Output**: Mule probability and risk score for each account

#### 3. **Real-Time Action System**
- **What**: Enables immediate account freezing and team deployment
- **How**: 
  - Integrates with CFCFRMS (Central Fraud Communication System)
  - Sends freeze requests to banks
  - Alerts nearby LEA teams via mobile app
  - Provides real-time case tracking

### Workflow

```
1. Complaint Received (NCRP Portal)
   ↓
2. AI Analysis (CST + GNN)
   ├─ Predicts ATM location
   └─ Identifies mule accounts
   ↓
3. Immediate Action
   ├─ Freeze mule accounts (via CFCFRMS)
   └─ Alert nearby LEA teams
   ↓
4. Interception
   ├─ Teams reach predicted ATM
   └─ Criminal caught red-handed
   ↓
5. Recovery
   ├─ Money frozen in accounts
   └─ Funds returned to victim
```

---

## 💻 Tech Stack

### Backend
- **Framework**: FastAPI (Python)
- **Database**: 
  - PostgreSQL (case data, predictions)
  - Neo4j (graph database for money flow visualization)
- **AI/ML**:
  - PyTorch (deep learning framework)
  - torch-geometric (graph neural networks)
  - Transformers (spatio-temporal modeling)
- **APIs**: RESTful API with Swagger documentation

### Frontend
- **Mobile App**: React Native / Flutter (for LEA officers)
- **Web Dashboard**: HTML/CSS/JavaScript (for case management)
- **Visualization**: D3.js / vis.js (for graph visualization)

### Infrastructure
- **Containerization**: Docker
- **API Gateway**: FastAPI with authentication
- **Real-time**: WebSocket for live updates

### AI Models
1. **CST Transformer**: Spatio-temporal transformer for location prediction
2. **GNN (GAT)**: Graph Attention Network for mule detection

---

## 👥 Team Responsibilities

### 1. Design & Flow
**Team Member**: Deekshith

**Responsibilities**:
- Create mockup data and validate proper flow
- Design and finalize UI screens
- Ensure user experience aligns with LEA workflow
- Create wireframes and prototypes

**Deliverables**:
- UI/UX mockups
- Screen flow diagrams
- User journey maps

---

### 2. Mobile App Frontend
**Team Members**: Varshini, Deekshith

**Responsibilities**:
- Develop and implement mobile app frontend screens
- Integrate with backend API
- Implement real-time notifications
- Create map visualization for ATM locations
- Build case management interface

**Deliverables**:
- Functional mobile app
- Real-time alert system
- Map integration
- Case tracking interface

---

### 3. Requirement Analysis & Process Understanding
**Team Members**: Pavan, Soumya

**Responsibilities**:
- Analyze and understand i4C (Indian Cybercrime Coordination Centre) requirements
- Investigate major issues LEA faces while tracking money flow
- Validate approach using Bubble (prototyping tool)
- Confirm if implemented method is correct
- Document requirements and processes

**Deliverables**:
- Requirement documentation
- Process flow diagrams
- Validation reports
- Stakeholder feedback

---

### 4. UI Screen Testing & Improvements
**Team Member**: Yashaswini

**Responsibilities**:
- Test UI screens for bugs and issues
- Identify potential improvements
- Communicate changes to frontend team
- Ensure accessibility and usability
- Perform user acceptance testing

**Deliverables**:
- Test reports
- Bug documentation
- Improvement recommendations
- User feedback analysis

---

### 5. Work Monitoring
**Team Member**: Ravi Sir

**Responsibilities**:
- Monitor work progress for each team member hourly
- Ensure productivity and prevent time wastage
- Coordinate between team members
- Track milestones and deadlines
- Provide guidance and support

**Deliverables**:
- Progress reports
- Time tracking
- Milestone tracking
- Team coordination

---

### 6. Documentation Review
**All Team Members**

**Responsibilities**:
- Review and go through all documentation
- Ensure alignment with project's current state
- Understand technical implementations
- Provide feedback on documentation
- Keep documentation updated

**Deliverables**:
- Documentation review reports
- Updated documentation
- Knowledge sharing sessions

---

## 📊 Key Features

### 1. Real-Time Fraud Detection
- Instant analysis of fraud complaints
- Automatic mule account identification
- Cross-bank transaction tracking

### 2. Predictive ATM Location
- Predicts top 3 ATM locations with confidence scores
- Considers victim location, fraud type, and timing
- Updates predictions in real-time

### 3. Account Freezing
- Immediate freeze requests via CFCFRMS
- Multi-bank support
- Real-time freeze status tracking

### 4. Law Enforcement Integration
- Mobile app for LEA officers
- Real-time alerts and notifications
- Team deployment coordination
- Case tracking and management

### 5. Money Flow Visualization
- Graph visualization of transaction chains
- Mule account highlighting
- Interactive network exploration

---

## 🎯 Success Metrics

- **Response Time**: < 60 seconds from complaint to action
- **Prediction Accuracy**: > 80% for ATM location prediction
- **Mule Detection**: > 90% accuracy in identifying mule accounts
- **Recovery Rate**: Target 80%+ money recovery
- **Case Resolution**: 50% reduction in investigation time

---

## 📈 Future Enhancements

1. **Federated Learning**: Train models across banks without sharing sensitive data
2. **Advanced Analytics**: Predictive fraud prevention before money is stolen
3. **Multi-Language Support**: Support for regional languages
4. **Integration with More Banks**: Expand to all major banks in India
5. **NPCI Integration**: Direct integration with NPCI for real-time freeze

---

## 📚 Documentation

- **CST Transformer**: See `Documents/CST-Transformer-Line-by-Line.md`
- **Mule GNN**: See `Documents/Mule-GNN-Line-by-Line.md`
- **API Documentation**: Available at `/docs` endpoint
- **Integration Guide**: See `Documents/AEGIS-Integration-Research-Documentation.md`

---

## 🤝 Contributing

This is a research project for i4C (Indian Cybercrime Coordination Centre). For questions or contributions, please contact the project team.

---

## 📄 License

This project is developed for i4C and is subject to government regulations and compliance requirements.

---

**Version**: 1.0  
**Last Updated**: January 2025  
**Project**: AEGIS - Anticipatory Engine for Geolocated Intervention against Scams

