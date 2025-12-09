# Neo4j Case Graph Viewing Guide

## Quick Start

### 1. Access Neo4j Browser

**URL:** `http://localhost:7474`

**Default Credentials:**
- Username: `neo4j`
- Password: (your Neo4j password)

---

## 2. View All Cases

### List All Cases
```cypher
MATCH (c:Case)
RETURN c.case_id, c.case_number, c.fraud_amount, c.created_at
ORDER BY c.created_at DESC
LIMIT 20
```

### Count Cases
```cypher
MATCH (c:Case)
RETURN count(c) as total_cases
```

---

## 3. View Specific Case Graph

### Get Case by Case ID
**Replace `{case_id}` with your actual case ID (UUID)**

```cypher
MATCH (c:Case {case_id: '{case_id}'})
RETURN c
```

### View Complete Money Flow for a Case
```cypher
MATCH (c:Case {case_id: '{case_id}'})
OPTIONAL MATCH (c)-[:VICTIM_OF]->(victim:Account)
OPTIONAL MATCH path = (victim)-[txns:TRANSFERRED_TO*]->(end:Account)
WHERE ALL(rel IN relationships(path) WHERE rel.case_id = '{case_id}')
RETURN c, victim, path
```

### Visualize Case Graph (Recommended)
```cypher
MATCH (c:Case {case_id: '{case_id}'})
OPTIONAL MATCH (c)-[:VICTIM_OF]->(victim:Account)
OPTIONAL MATCH path = (victim)-[txns:TRANSFERRED_TO*]->(end:Account)
WHERE ALL(rel IN relationships(path) WHERE rel.case_id = '{case_id}')
RETURN c, nodes(path) as accounts, relationships(path) as transactions
```

---

## 4. View Accounts and Transactions

### All Accounts in a Case
```cypher
MATCH (c:Case {case_id: '{case_id}'})-[:VICTIM_OF]->(victim:Account)
OPTIONAL MATCH (victim)-[:TRANSFERRED_TO*]->(acc:Account)
RETURN DISTINCT acc.account_id, acc.account_number, acc.bank, 
       acc.holder_name, acc.is_mule, acc.mule_probability, acc.risk_score
ORDER BY acc.mule_probability DESC
```

### All Mule Accounts in a Case
```cypher
MATCH (c:Case {case_id: '{case_id}'})-[:VICTIM_OF]->(victim:Account)
OPTIONAL MATCH (victim)-[:TRANSFERRED_TO*]->(acc:Account)
WHERE acc.is_mule = 1
RETURN acc.account_id, acc.account_number, acc.bank, 
       acc.holder_name, acc.mule_probability, acc.risk_score
ORDER BY acc.mule_probability DESC
```

### All Transactions in a Case
```cypher
MATCH (c:Case {case_id: '{case_id}'})-[:VICTIM_OF]->(victim:Account)
MATCH (victim)-[t:TRANSFERRED_TO*]->(end:Account)
UNWIND relationships(t) as rel
WHERE rel.case_id = '{case_id}'
RETURN rel.transaction_id, startNode(rel).account_id as from_account,
       endNode(rel).account_id as to_account, rel.amount, 
       rel.transaction_type, rel.hop_number, rel.timestamp
ORDER BY rel.hop_number
```

---

## 5. Visual Graph Queries (Best for Visualization)

### Complete Case Graph with Styling
```cypher
MATCH (c:Case {case_id: '{case_id}'})
OPTIONAL MATCH (c)-[:VICTIM_OF]->(victim:Account)
OPTIONAL MATCH path = (victim)-[txns:TRANSFERRED_TO*]->(end:Account)
WHERE ALL(rel IN relationships(path) WHERE rel.case_id = '{case_id}')
WITH c, victim, path
RETURN c, 
       [node IN nodes(path) | node] as accounts,
       [rel IN relationships(path) | rel] as transactions
```

### Money Flow Chain (Sequential)
```cypher
MATCH (c:Case {case_id: '{case_id}'})
OPTIONAL MATCH (c)-[:VICTIM_OF]->(victim:Account)
OPTIONAL MATCH path = (victim)-[txns:TRANSFERRED_TO*]->(end:Account)
WHERE ALL(rel IN relationships(path) WHERE rel.case_id = '{case_id}')
WITH c, victim, path
ORDER BY length(path) DESC
LIMIT 1
RETURN c, victim, path
```

---

## 6. Statistics and Analysis

### Case Summary
```cypher
MATCH (c:Case {case_id: '{case_id}'})
OPTIONAL MATCH (c)-[:VICTIM_OF]->(victim:Account)
OPTIONAL MATCH (victim)-[:TRANSFERRED_TO*]->(acc:Account)
WITH c, victim, collect(DISTINCT acc) as accounts
RETURN c.case_number, c.fraud_amount,
       victim.account_id as victim_account,
       size(accounts) as total_accounts,
       size([a IN accounts WHERE a.is_mule = 1]) as mule_count,
       avg([a IN accounts | a.mule_probability]) as avg_mule_probability
```

### Transaction Statistics
```cypher
MATCH (c:Case {case_id: '{case_id}'})-[:VICTIM_OF]->(victim:Account)
MATCH (victim)-[t:TRANSFERRED_TO*]->(end:Account)
UNWIND relationships(t) as rel
WHERE rel.case_id = '{case_id}'
RETURN count(rel) as total_transactions,
       sum(rel.amount) as total_amount,
       avg(rel.amount) as avg_amount,
       max(rel.amount) as max_amount,
       min(rel.amount) as min_amount
```

---

## 7. Using API Endpoints (Alternative)

### Get Case Graph via API
```bash
# Replace {case_id} with your case ID
# Replace {token} with your JWT token

curl -X GET "http://localhost:8000/api/v1/graph/case/{case_id}" \
  -H "Authorization: Bearer {token}"
```

### Get Visualization-Optimized Graph
```bash
curl -X GET "http://localhost:8000/api/v1/graph/case/{case_id}/visualization" \
  -H "Authorization: Bearer {token}"
```

### Example with Swagger UI
1. Go to: `http://localhost:8000/docs`
2. Navigate to: `GET /api/v1/graph/case/{case_id}`
3. Enter your case ID
4. Click "Execute"
5. View the JSON response

---

## 8. Neo4j Browser Styling (Optional)

### Set Node Colors
In Neo4j Browser, you can style nodes:

1. Click the **"Style"** icon (paintbrush) in the left sidebar
2. Add these rules:

**For Accounts:**
```cypher
// Victim accounts (green)
MATCH (a:Account)
WHERE EXISTS((:Case)-[:VICTIM_OF]->(a))
SET a.color = '#10b981'  // Green

// Mule accounts (orange/red)
MATCH (a:Account)
WHERE a.is_mule = 1
SET a.color = '#f97316'  // Orange

// Regular accounts (blue)
MATCH (a:Account)
WHERE a.is_mule = 0 AND NOT EXISTS((:Case)-[:VICTIM_OF]->(a))
SET a.color = '#3b82f6'  // Blue
```

**For Cases:**
```cypher
MATCH (c:Case)
SET c.color = '#8b5cf6'  // Purple
```

### Set Relationship Colors
```cypher
// IMPS (orange)
MATCH ()-[r:TRANSFERRED_TO]->()
WHERE r.transaction_type = 'IMPS'
SET r.color = '#f97316'

// NEFT (red)
MATCH ()-[r:TRANSFERRED_TO]->()
WHERE r.transaction_type = 'NEFT'
SET r.color = '#ef4444'

// RTGS (purple)
MATCH ()-[r:TRANSFERRED_TO]->()
WHERE r.transaction_type = 'RTGS'
SET r.color = '#a855f7'

// UPI (cyan)
MATCH ()-[r:TRANSFERRED_TO]->()
WHERE r.transaction_type = 'UPI'
SET r.color = '#06b6d4'
```

---

## 9. Quick Reference Commands

### Find Latest Case
```cypher
MATCH (c:Case)
RETURN c.case_id, c.case_number
ORDER BY c.created_at DESC
LIMIT 1
```

### Find Case by Case Number
```cypher
MATCH (c:Case {case_number: 'MH-2025-12345'})
RETURN c.case_id
```

### View All Mule Accounts (All Cases)
```cypher
MATCH (a:Account)
WHERE a.is_mule = 1
RETURN a.account_id, a.account_number, a.bank, 
       a.mule_probability, a.risk_score
ORDER BY a.mule_probability DESC
LIMIT 20
```

### Find Accounts with High Mule Probability
```cypher
MATCH (a:Account)
WHERE a.mule_probability >= 0.5
RETURN a.account_id, a.account_number, a.bank,
       a.mule_probability, a.risk_score
ORDER BY a.mule_probability DESC
```

---

## 10. Troubleshooting

### Case Not Found
```cypher
// Check if case exists
MATCH (c:Case)
WHERE c.case_id CONTAINS '{partial_case_id}'
RETURN c.case_id, c.case_number
```

### No Transactions Found
```cypher
// Check if victim relationship exists
MATCH (c:Case {case_id: '{case_id}'})
OPTIONAL MATCH (c)-[:VICTIM_OF]->(v:Account)
RETURN c, v
```

### Clear All Data (Development Only!)
```cypher
// WARNING: This deletes ALL data!
MATCH (n)
DETACH DELETE n
```

---

## 11. Example: View Test Case

After running the test case generator, use the case ID from the output:

```cypher
// Replace with your test case ID
MATCH (c:Case {case_id: 'your-test-case-id-here'})
OPTIONAL MATCH (c)-[:VICTIM_OF]->(victim:Account)
OPTIONAL MATCH path = (victim)-[txns:TRANSFERRED_TO*]->(end:Account)
RETURN c, victim, path
```

---

## 12. Tips for Better Visualization

1. **Use Graph View:** Click the "Graph" tab in Neo4j Browser for visual representation
2. **Expand Nodes:** Click on nodes to expand relationships
3. **Filter by Properties:** Use WHERE clauses to filter specific accounts
4. **Limit Results:** Use LIMIT to avoid overwhelming the browser
5. **Export Data:** Use "Export CSV" to save query results

---

**Need Help?**
- Check Neo4j documentation: https://neo4j.com/docs/
- Check API documentation: http://localhost:8000/docs
- View service code: `backend/app/services/neo4j_graph_service.py`

