"""
Test Script: Verify Legitimate Accounts are Correctly Identified as Non-Mules

This script tests that:
1. Victim accounts are NEVER marked as mules (0% probability)
2. Legitimate accounts are correctly identified as non-mules (low probability)
3. Mule accounts are correctly identified as mules (high probability)
"""

import asyncio
import sys
from pathlib import Path
from uuid import uuid4
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.services.mule_detector_service import MuleDetectorService
from app.services.cfcfrms_simulator import CFCFRMSSimulator


async def test_legitimate_accounts():
    """Test that legitimate accounts are correctly identified"""
    print("🧪 Testing Legitimate Account Detection\n")
    print("=" * 60)
    
    # Initialize service
    service = MuleDetectorService()
    service.load_model()
    
    if not service.loaded:
        print("⚠️  Model not loaded, using heuristics")
    else:
        print("✅ Model loaded successfully\n")
    
    # Test Case 1: Mixed scenario (Victim + Legitimate + Mule)
    print("📋 Test Case 1: Mixed Scenario")
    print("-" * 60)
    
    case_id = uuid4()
    
    # Create transaction chain with:
    # 1. Victim account (should be 0% mule)
    # 2. Legitimate account (should be low mule probability)
    # 3. Mule account (should be high mule probability)
    
    transactions = [
        {
            "transaction_id": "TXN001",
            "case_id": str(case_id),
            "hop_number": 1,
            "from_account": "VICTIM_ACCOUNT_001",
            "from_account_number": "XXXX XXXX 4521",
            "from_bank": "ICICI",
            "from_holder_name": "Rajesh Gupta (Victim)",
            "to_account": "LEGITIMATE_ACCOUNT_001",
            "to_account_number": "1234567890",
            "to_bank": "SBI",
            "to_holder_name": "Priya Sharma (Legitimate)",
            "amount": 100000,
            "transaction_type": "IMPS",
            "transaction_timestamp": datetime.now()
        },
        {
            "transaction_id": "TXN002",
            "case_id": str(case_id),
            "hop_number": 2,
            "from_account": "LEGITIMATE_ACCOUNT_001",
            "from_account_number": "1234567890",
            "from_bank": "SBI",
            "from_holder_name": "Priya Sharma (Legitimate)",
            "to_account": "MULE_ACCOUNT_001",
            "to_account_number": "9876543210",
            "to_bank": "HDFC",
            "to_holder_name": "Amit Kumar (Mule)",
            "amount": 95000,
            "transaction_type": "NEFT",
            "transaction_timestamp": datetime.now()
        }
    ]
    
    # Run mule detection
    victim_account = "VICTIM_ACCOUNT_001"
    predictions = await service.detect_mules_from_transactions(
        case_id=case_id,
        transactions=transactions,
        victim_account=victim_account,
        threshold=0.5
    )
    
    # Analyze results
    print(f"\n📊 Results:")
    print(f"   Total accounts analyzed: {len(predictions)}")
    print()
    
    for acc_id, pred in predictions.items():
        is_mule = pred.get("is_mule", False)
        mule_prob = pred.get("mule_probability", 0.0)
        risk_score = pred.get("risk_score", 0.0)
        
        # Determine account type
        if acc_id == victim_account:
            account_type = "VICTIM"
            expected_mule = False
            expected_prob = 0.0
            status = "✅" if not is_mule and mule_prob == 0.0 else "❌"
        elif "LEGITIMATE" in acc_id:
            account_type = "LEGITIMATE"
            expected_mule = False
            expected_prob = "< 0.5"
            status = "✅" if not is_mule and mule_prob < 0.5 else "❌"
        elif "MULE" in acc_id:
            account_type = "MULE"
            expected_mule = True
            expected_prob = "> 0.5"
            status = "✅" if is_mule and mule_prob >= 0.5 else "❌"
        else:
            account_type = "UNKNOWN"
            expected_mule = "?"
            expected_prob = "?"
            status = "⚠️"
        
        print(f"   {status} {account_type}: {acc_id[:20]}...")
        print(f"      - Is Mule: {is_mule} (Expected: {expected_mule})")
        print(f"      - Mule Probability: {mule_prob:.2%} (Expected: {expected_prob})")
        print(f"      - Risk Score: {risk_score:.1f}")
        print()
    
    # Test Case 2: All legitimate accounts
    print("\n" + "=" * 60)
    print("📋 Test Case 2: All Legitimate Accounts")
    print("-" * 60)
    
    case_id_2 = uuid4()
    
    transactions_2 = [
        {
            "transaction_id": "TXN003",
            "case_id": str(case_id_2),
            "hop_number": 1,
            "from_account": "VICTIM_ACCOUNT_002",
            "from_account_number": "XXXX XXXX 1234",
            "from_bank": "Axis",
            "from_holder_name": "Suresh Patel (Victim)",
            "to_account": "LEGITIMATE_ACCOUNT_002",
            "to_account_number": "5555555555",
            "to_bank": "PNB",
            "to_holder_name": "Ravi Singh (Legitimate Business)",
            "amount": 50000,
            "transaction_type": "RTGS",
            "transaction_timestamp": datetime.now()
        },
        {
            "transaction_id": "TXN004",
            "case_id": str(case_id_2),
            "hop_number": 2,
            "from_account": "LEGITIMATE_ACCOUNT_002",
            "from_account_number": "5555555555",
            "from_bank": "PNB",
            "from_holder_name": "Ravi Singh (Legitimate Business)",
            "to_account": "LEGITIMATE_ACCOUNT_003",
            "to_account_number": "6666666666",
            "to_bank": "BOI",
            "to_holder_name": "Meera Desai (Legitimate)",
            "amount": 48000,
            "transaction_type": "IMPS",
            "transaction_timestamp": datetime.now()
        }
    ]
    
    victim_account_2 = "VICTIM_ACCOUNT_002"
    predictions_2 = await service.detect_mules_from_transactions(
        case_id=case_id_2,
        transactions=transactions_2,
        victim_account=victim_account_2,
        threshold=0.5
    )
    
    print(f"\n📊 Results:")
    print(f"   Total accounts analyzed: {len(predictions_2)}")
    print()
    
    all_legitimate = True
    for acc_id, pred in predictions_2.items():
        is_mule = pred.get("is_mule", False)
        mule_prob = pred.get("mule_probability", 0.0)
        
        if acc_id == victim_account_2:
            account_type = "VICTIM"
            status = "✅" if not is_mule and mule_prob == 0.0 else "❌"
        else:
            account_type = "LEGITIMATE"
            status = "✅" if not is_mule and mule_prob < 0.5 else "❌"
            if is_mule or mule_prob >= 0.5:
                all_legitimate = False
        
        print(f"   {status} {account_type}: {acc_id[:20]}...")
        print(f"      - Is Mule: {is_mule}")
        print(f"      - Mule Probability: {mule_prob:.2%}")
        print()
    
    if all_legitimate:
        print("   ✅ All legitimate accounts correctly identified!")
    else:
        print("   ❌ Some legitimate accounts incorrectly flagged as mules!")
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 Summary")
    print("=" * 60)
    print("\n✅ Expected Behavior:")
    print("   1. Victim accounts: is_mule = False, mule_probability = 0.0%")
    print("   2. Legitimate accounts: is_mule = False, mule_probability < 50%")
    print("   3. Mule accounts: is_mule = True, mule_probability >= 50%")
    print("\n💡 Note:")
    print("   - If model is not loaded, heuristics are used")
    print("   - Heuristics may not be as accurate as trained model")
    print("   - For accurate results, ensure model is trained and loaded")
    print()


if __name__ == "__main__":
    asyncio.run(test_legitimate_accounts())

