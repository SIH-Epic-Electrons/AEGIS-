"""
Generate Test Case for Mule Network Detection

Creates a test case with:
- Attacker account (victim's money goes here first)
- Legitimate accounts (should NOT be flagged as mules)
- Mule accounts (should be flagged as mules)

This helps test whether the GNN model correctly distinguishes between
legitimate and mule accounts in a transaction chain.
"""

import asyncio
import sys
from pathlib import Path
from uuid import uuid4
from datetime import datetime, timedelta
import random

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.services.cfcfrms_simulator import CFCFRMSSimulator
from app.services.mule_detector_service import MuleDetectorService
from app.services.neo4j_graph_service import Neo4jGraphService


def generate_test_transaction_chain():
    """
    Generate a test transaction chain:
    Attacker -> Legitimate Account 1 -> Mule Account 1 -> Legitimate Account 2 -> Mule Account 2
    """
    
    case_id = uuid4()
    base_time = datetime.now() - timedelta(hours=2)
    
    # Account IDs
    attacker_account = f"ATTACKER_{uuid4().hex[:8].upper()}"
    legitimate_1 = f"LEGITIMATE_BUSINESS_{uuid4().hex[:8].upper()}"
    mule_1 = f"MULE_ACCOUNT_{uuid4().hex[:8].upper()}"
    legitimate_2 = f"LEGITIMATE_PERSON_{uuid4().hex[:8].upper()}"
    mule_2 = f"MULE_ACCOUNT_{uuid4().hex[:8].upper()}"
    
    transactions = [
        {
            "transaction_id": f"TXN_{uuid4().hex[:8].upper()}",
            "case_id": str(case_id),
            "hop_number": 1,
            "from_account": attacker_account,
            "from_account_number": "XXXX XXXX 1234",
            "from_bank": "ICICI Bank",
            "from_holder_name": "Attacker Account (Fraud Source)",
            "to_account": legitimate_1,
            "to_account_number": "1234567890",
            "to_bank": "State Bank of India",
            "to_holder_name": "Priya Sharma (Legitimate Business Owner)",
            "amount": 500000,  # ₹5 lakh
            "transaction_type": "IMPS",
            "transaction_timestamp": base_time + timedelta(minutes=5)
        },
        {
            "transaction_id": f"TXN_{uuid4().hex[:8].upper()}",
            "case_id": str(case_id),
            "hop_number": 2,
            "from_account": legitimate_1,
            "from_account_number": "1234567890",
            "from_bank": "State Bank of India",
            "from_holder_name": "Priya Sharma (Legitimate Business Owner)",
            "to_account": mule_1,
            "to_account_number": "9876543210",
            "to_bank": "HDFC Bank",
            "to_holder_name": "Amit Kumar (Mule Account)",
            "amount": 450000,  # ₹4.5 lakh
            "transaction_type": "NEFT",
            "transaction_timestamp": base_time + timedelta(minutes=15)
        },
        {
            "transaction_id": f"TXN_{uuid4().hex[:8].upper()}",
            "case_id": str(case_id),
            "hop_number": 3,
            "from_account": mule_1,
            "from_account_number": "9876543210",
            "from_bank": "HDFC Bank",
            "from_holder_name": "Amit Kumar (Mule Account)",
            "to_account": legitimate_2,
            "to_account_number": "5555555555",
            "to_bank": "Axis Bank",
            "to_holder_name": "Ravi Singh (Legitimate Person)",
            "amount": 400000,  # ₹4 lakh
            "transaction_type": "RTGS",
            "transaction_timestamp": base_time + timedelta(minutes=30)
        },
        {
            "transaction_id": f"TXN_{uuid4().hex[:8].upper()}",
            "case_id": str(case_id),
            "hop_number": 4,
            "from_account": legitimate_2,
            "from_account_number": "5555555555",
            "from_bank": "Axis Bank",
            "from_holder_name": "Ravi Singh (Legitimate Person)",
            "to_account": mule_2,
            "to_account_number": "6666666666",
            "to_bank": "Kotak Mahindra Bank",
            "to_holder_name": "Suresh Patel (Mule Account)",
            "amount": 350000,  # ₹3.5 lakh
            "transaction_type": "UPI",
            "transaction_timestamp": base_time + timedelta(minutes=45)
        }
    ]
    
    return {
        "case_id": case_id,
        "victim_account": attacker_account,  # First account in chain
        "transactions": transactions,
        "expected_results": {
            "victim": attacker_account,
            "legitimate_accounts": [legitimate_1, legitimate_2],
            "mule_accounts": [mule_1, mule_2]
        }
    }


async def test_mule_network_detection():
    """Test mule network detection with mixed legitimate and mule accounts"""
    
    print("=" * 70)
    print("🧪 MULE NETWORK DETECTION TEST")
    print("=" * 70)
    print()
    
    # Generate test case
    test_data = generate_test_transaction_chain()
    case_id = test_data["case_id"]
    transactions = test_data["transactions"]
    victim_account = test_data["victim_account"]
    
    print(f"📋 Test Case ID: {case_id}")
    print(f"📋 Victim Account: {victim_account}")
    print()
    
    print("💰 Transaction Chain:")
    print("-" * 70)
    for i, txn in enumerate(transactions, 1):
        print(f"  {i}. {txn['from_account'][:20]}... → {txn['to_account'][:20]}...")
        print(f"     Amount: ₹{txn['amount']:,} | Type: {txn['transaction_type']}")
        print(f"     From: {txn.get('from_holder_name', 'Unknown')}")
        print(f"     To: {txn.get('to_holder_name', 'Unknown')}")
        print()
    
    # Initialize services
    print("🔧 Initializing Services...")
    mule_service = MuleDetectorService()
    mule_service.load_model()
    
    cfcfrms = CFCFRMSSimulator()
    neo4j_service = Neo4jGraphService()
    
    print("✅ Services initialized\n")
    
    # Run mule detection
    print("🤖 Running Mule Detection...")
    print("-" * 70)
    
    predictions = await mule_service.detect_mules_from_transactions(
        case_id=case_id,
        transactions=transactions,
        victim_account=victim_account,
        threshold=0.5
    )
    
    print(f"\n📊 Detection Results:")
    print("-" * 70)
    
    # Analyze results
    all_accounts = set()
    for txn in transactions:
        all_accounts.add(txn["from_account"])
        all_accounts.add(txn["to_account"])
    
    correct_predictions = 0
    total_predictions = 0
    
    for acc_id in sorted(all_accounts):
        pred = predictions.get(acc_id, {})
        is_mule = pred.get("is_mule", False)
        mule_prob = pred.get("mule_probability", 0.0)
        risk_score = pred.get("risk_score", 0.0)
        
        # Determine expected result
        if acc_id == victim_account:
            expected = "VICTIM (0% mule)"
            is_correct = not is_mule and mule_prob == 0.0
            status = "✅" if is_correct else "❌"
        elif acc_id in test_data["expected_results"]["legitimate_accounts"]:
            expected = "LEGITIMATE (< 50% mule)"
            is_correct = not is_mule and mule_prob < 0.5
            status = "✅" if is_correct else "❌"
        elif acc_id in test_data["expected_results"]["mule_accounts"]:
            expected = "MULE (>= 50% mule)"
            is_correct = is_mule and mule_prob >= 0.5
            status = "✅" if is_correct else "❌"
        else:
            expected = "UNKNOWN"
            is_correct = False
            status = "⚠️"
        
        if is_correct:
            correct_predictions += 1
        total_predictions += 1
        
        # Find account name
        account_name = "Unknown"
        for txn in transactions:
            if txn["from_account"] == acc_id:
                account_name = txn["from_holder_name"]
                break
            elif txn["to_account"] == acc_id:
                account_name = txn["to_holder_name"]
                break
        
        print(f"  {status} {acc_id[:25]}...")
        print(f"     Name: {account_name}")
        print(f"     Expected: {expected}")
        print(f"     Is Mule: {is_mule} | Probability: {mule_prob:.1%} | Risk: {risk_score:.1f}")
        print()
    
    # Summary
    print("=" * 70)
    print("📈 Summary")
    print("=" * 70)
    print(f"  Total Accounts: {total_predictions}")
    print(f"  Correct Predictions: {correct_predictions}")
    print(f"  Accuracy: {(correct_predictions/total_predictions)*100:.1f}%")
    print()
    
    # Expected breakdown
    print("Expected Results:")
    print(f"  ✅ Victim Account: {victim_account[:20]}... (0% mule)")
    print(f"  ✅ Legitimate Accounts: {len(test_data['expected_results']['legitimate_accounts'])} accounts (< 50% mule)")
    print(f"  ✅ Mule Accounts: {len(test_data['expected_results']['mule_accounts'])} accounts (>= 50% mule)")
    print()
    
    # Store in Neo4j for visualization
    print("💾 Storing in Neo4j for visualization...")
    try:
        neo4j_service.create_case_graph(
            case_id=case_id,
            transactions=transactions,
            mule_predictions=predictions
        )
        print("✅ Graph stored in Neo4j")
        print(f"   View at: http://localhost:7474 (if Neo4j Browser is running)")
    except Exception as e:
        print(f"⚠️  Could not store in Neo4j: {e}")
    
    print()
    print("=" * 70)
    print("✅ Test Complete!")
    print("=" * 70)
    
    return {
        "case_id": str(case_id),
        "predictions": predictions,
        "accuracy": (correct_predictions/total_predictions)*100,
        "correct": correct_predictions,
        "total": total_predictions
    }


if __name__ == "__main__":
    result = asyncio.run(test_mule_network_detection())
    print(f"\n📋 Case ID for API testing: {result['case_id']}")


