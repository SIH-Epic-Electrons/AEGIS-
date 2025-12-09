"""
Test API Integration with CST Transformer.

This script tests:
1. Creating a case via API
2. Checking if AI analysis runs
3. Getting predictions
4. Verifying predictions are from real CST model
"""

import requests
import json
import time
from datetime import datetime

# API Base URL
BASE_URL = "http://localhost:8000/api/v1"

# Test credentials (you'll need to create a test officer first)
TEST_BADGE_ID = "TEST-001"
TEST_PASSWORD = "test123"

# Get auth token
def get_auth_token():
    """Get authentication token."""
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={
            "badge_id": TEST_BADGE_ID,
            "password": TEST_PASSWORD
        }
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    else:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        return None


def create_test_case(token):
    """Create a test case with victim location."""
    headers = {"Authorization": f"Bearer {token}"}
    
    case_data = {
        "ncrp_complaint_id": f"TEST-{int(time.time())}",
        "fraud_type": "OTP_FRAUD",
        "fraud_amount": 350000,
        "fraud_description": "Test OTP fraud case for API integration",
        "fraud_timestamp": datetime.utcnow().isoformat(),
        
        "destination_account": {
            "account_number": "1234567890",
            "bank_name": "HDFC",
            "ifsc_code": "HDFC0001234",
            "upi_id": None
        },
        
        "victim": {
            "name": "Test Victim",
            "phone": "+91-9876543210",
            "email": "test@example.com",
            "city": "Mumbai",
            "state": "Maharashtra",
            "lat": 19.0760,  # Mumbai coordinates
            "lon": 72.8777
        }
    }
    
    response = requests.post(
        f"{BASE_URL}/cases",
        headers=headers,
        json=case_data
    )
    
    if response.status_code == 201:
        return response.json()
    else:
        print(f"❌ Case creation failed: {response.status_code}")
        print(f"   Response: {response.text}")
        return None


def get_case_prediction(token, case_id):
    """Get AI prediction for a case."""
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(
        f"{BASE_URL}/predictions/case/{case_id}",
        headers=headers
    )
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"❌ Prediction fetch failed: {response.status_code}")
        print(f"   Response: {response.text}")
        return None


def get_case_details(token, case_id):
    """Get case details."""
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(
        f"{BASE_URL}/cases/{case_id}",
        headers=headers
    )
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"❌ Case fetch failed: {response.status_code}")
        return None


def main():
    print("\n" + "="*70)
    print("   AEGIS API INTEGRATION TEST")
    print("   Testing CST Transformer Integration")
    print("="*70)
    
    # Step 1: Get auth token
    print("\n📝 Step 1: Authenticating...")
    token = get_auth_token()
    if not token:
        print("\n⚠️  Could not authenticate. Make sure:")
        print("   1. Server is running: uvicorn app.main:app --reload")
        print("   2. Test officer exists in database")
        print("   3. Badge ID and password are correct")
        return
    print("   ✓ Authenticated")
    
    # Step 2: Create test case
    print("\n📝 Step 2: Creating test case...")
    case_result = create_test_case(token)
    if not case_result:
        return
    
    case_id = case_result["data"]["case_id"]
    case_number = case_result["data"]["case_number"]
    print(f"   ✓ Case created: {case_number}")
    print(f"   Case ID: {case_id}")
    
    # Step 3: Wait for AI analysis (background task)
    print("\n⏳ Step 3: Waiting for AI analysis (5 seconds)...")
    time.sleep(5)
    
    # Step 4: Get case details
    print("\n📝 Step 4: Getting case details...")
    case_details = get_case_details(token, case_id)
    if case_details:
        status = case_details["data"]["status"]
        print(f"   Case Status: {status}")
        
        prediction = case_details["data"].get("prediction", {})
        if prediction:
            print(f"   ✓ Prediction available!")
            if prediction.get("predicted_atm"):
                atm = prediction["predicted_atm"]
                print(f"   Predicted ATM: {atm.get('name')}")
                print(f"   Bank: {atm.get('bank')}")
                print(f"   Confidence: {prediction.get('confidence', 0)*100:.1f}%")
    
    # Step 5: Get detailed prediction
    print("\n📝 Step 5: Getting detailed AI prediction...")
    prediction_result = get_case_prediction(token, case_id)
    
    if prediction_result:
        print("\n   ✅ PREDICTION RECEIVED FROM CST MODEL!")
        print("   " + "-"*60)
        
        data = prediction_result.get("data", {})
        location = data.get("location_prediction", {})
        primary = location.get("primary", {})
        
        print(f"\n   🎯 PRIMARY PREDICTION:")
        print(f"      ATM Name: {primary.get('name', 'N/A')}")
        print(f"      Bank: {primary.get('bank', 'N/A')}")
        print(f"      City: {primary.get('city', 'N/A')}")
        print(f"      Distance: {primary.get('distance_km', 'N/A')} km")
        print(f"      Confidence: {primary.get('confidence', 0)*100:.1f}%")
        
        alternatives = location.get("alternatives", [])
        if alternatives:
            print(f"\n   📍 ALTERNATIVE PREDICTIONS ({len(alternatives)}):")
            for i, alt in enumerate(alternatives[:3], 1):
                print(f"      #{i}: {alt.get('name')} ({alt.get('bank')}) - {alt.get('confidence', 0)*100:.1f}%")
        
        model_info = data.get("model_info", {})
        print(f"\n   🤖 MODEL INFO:")
        print(f"      Model: {model_info.get('model_name', 'N/A')}")
        print(f"      Version: {model_info.get('version', 'N/A')}")
        print(f"      Mode: {model_info.get('mode', 'N/A')}")
        
        print("\n   ✅ API INTEGRATION SUCCESSFUL!")
        print("   CST Transformer is working correctly!")
    else:
        print("\n   ⚠️  Could not get prediction")
        print("   Check if:")
        print("   1. AI analysis completed (check case status)")
        print("   2. CST model is loaded (check server logs)")
        print("   3. Database has prediction records")
    
    print("\n" + "="*70)
    print("   TEST COMPLETE")
    print("="*70)


if __name__ == "__main__":
    try:
        main()
    except requests.exceptions.ConnectionError:
        print("\n❌ Could not connect to API server!")
        print("   Make sure the server is running:")
        print("   cd backend")
        print("   uvicorn app.main:app --reload")
    except KeyboardInterrupt:
        print("\n\n👋 Test cancelled")

