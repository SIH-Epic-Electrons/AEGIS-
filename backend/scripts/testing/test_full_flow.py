"""
Test Complete AEGIS Flow
Tests: Case → CFCFRMS Trace → Mule Detection → Neo4j Graph
"""

import asyncio
import sys
from pathlib import Path
from uuid import uuid4
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.services.cfcfrms_simulator import CFCFRMSSimulator
from app.services.mule_detector_service import MuleDetectorService
from app.services.neo4j_graph_service import Neo4jGraphService


async def test_full_flow():
    """Test complete AEGIS flow"""
    print("🧪 Testing Complete AEGIS Flow...\n")
    
    # 1. Create test case
    case_id = uuid4()
    print(f"1️⃣  Case ID: {case_id}")
    
    # 2. Trace money flow (CFCFRMS simulation)
    print("\n2️⃣  Tracing money flow (CFCFRMS simulation)...")
    transactions = CFCFRMSSimulator.trace_money_flow(
        case_id=case_id,
        victim_account="VICTIM_001",
        victim_bank="ICICI",
        fraud_amount=350000,
        complaint_timestamp=datetime.now(),
        num_hops=4
    )
    print(f"   ✅ Traced {len(transactions)} transactions")
    for i, txn in enumerate(transactions[:3], 1):
        print(f"      Hop {i}: {txn['from_bank']} → {txn['to_bank']} (₹{txn['amount']:,.0f})")
    
    # 3. Detect mule accounts (GNN model)
    print("\n3️⃣  Detecting mule accounts (GNN model)...")
    service = MuleDetectorService()
    service.load_model()
    
    if not service.loaded:
        print("   ⚠️  Model not loaded, using heuristics")
    
    predictions = await service.detect_mules_from_transactions(
        case_id=case_id,
        transactions=transactions,
        threshold=0.5
    )
    
    mule_count = sum(1 for p in predictions.values() if p.get("is_mule", False))
    print(f"   ✅ Detected {mule_count} mule accounts out of {len(predictions)} accounts")
    
    for acc_id, pred in list(predictions.items())[:3]:
        status = "🔴 MULE" if pred.get("is_mule") else "🟢 Legitimate"
        print(f"      {status}: {acc_id[:8]}... (confidence: {pred.get('mule_probability', 0):.2%})")
    
    # 4. Create graph in Neo4j
    print("\n4️⃣  Creating graph in Neo4j...")
    try:
        Neo4jGraphService.create_case_graph(
            case_id=case_id,
            transactions=transactions,
            mule_predictions=predictions
        )
        print("   ✅ Graph created in Neo4j")
    except Exception as e:
        print(f"   ⚠️  Neo4j error (may not be running): {e}")
        print("   💡 Start Neo4j to enable graph visualization")
    
    # 5. Get graph data
    print("\n5️⃣  Retrieving graph data...")
    try:
        graph = Neo4jGraphService.get_case_graph(case_id)
        nodes = graph.get("nodes", [])
        edges = graph.get("edges", [])
        print(f"   ✅ Graph retrieved: {len(nodes)} nodes, {len(edges)} edges")
        
        # Show mule accounts
        mule_nodes = [n for n in nodes if n.get("is_mule", 0) == 1]
        if mule_nodes:
            print(f"   🔴 Mule accounts in graph: {len(mule_nodes)}")
            for node in mule_nodes[:3]:
                print(f"      - {node.get('holder_name', 'Unknown')} ({node.get('bank', 'Unknown')}) - {node.get('mule_probability', 0):.2%}")
    except Exception as e:
        print(f"   ⚠️  Error retrieving graph: {e}")
    
    # Summary
    print("\n" + "="*60)
    print("✅ FULL FLOW TEST COMPLETE!")
    print("="*60)
    print(f"📊 Summary:")
    print(f"   - Transactions traced: {len(transactions)}")
    print(f"   - Accounts analyzed: {len(predictions)}")
    print(f"   - Mule accounts detected: {mule_count}")
    print(f"   - Graph nodes: {len(nodes) if 'nodes' in locals() else 0}")
    print(f"   - Graph edges: {len(edges) if 'edges' in locals() else 0}")
    print("\n🎯 Next Steps:")
    print("   1. Test API endpoints in Swagger")
    print("   2. View graph in Neo4j Browser")
    print("   3. Test with real case data")
    print("   4. Prepare for judges demo")


if __name__ == "__main__":
    asyncio.run(test_full_flow())

