"""
AEGIS Real-World Scenario Testing.

This script simulates the complete AEGIS flow as shown in the MVP design:
1. Complaint received from NCRP
2. AI analyzes and predicts ATM location
3. Shows confidence and alternative predictions
4. Simulates what LEA officers would see

Based on the MVP flow: 00-FLOWCHART.html → 04-new-complaint-alert.html → 20-ai-analysis.html
"""

import sys
from pathlib import Path
from datetime import datetime, timedelta
import random
import pickle

import pandas as pd
import torch
import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.ml.models.cst_transformer import CSTTransformer


# ============================================================================
# REAL-WORLD COMPLAINT SCENARIOS (Based on common fraud patterns in India)
# ============================================================================

REALISTIC_COMPLAINTS = [
    {
        "ncrp_id": "MH-2025-84721",
        "victim": {
            "name": "Ramesh Kumar",
            "phone": "+91-98765XXXXX",
            "area": "Andheri West",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pincode": "400058",
            "lat": 19.1355,
            "lon": 72.8275,
        },
        "fraud": {
            "type": "OTP_PHISHING",
            "amount": 350000,
            "description": "Victim received call from fake bank executive. Shared OTP. Money transferred.",
            "time_since_fraud_mins": 23,
        },
        "reported_at": datetime.now() - timedelta(minutes=23),
    },
    {
        "ncrp_id": "KA-2025-12456",
        "victim": {
            "name": "Lakshmi Devi",
            "phone": "+91-87654XXXXX",
            "area": "HSR Layout",
            "city": "Bangalore",
            "state": "Karnataka",
            "pincode": "560102",
            "lat": 12.9121,
            "lon": 77.6446,
        },
        "fraud": {
            "type": "INVESTMENT_SCAM",
            "amount": 1500000,
            "description": "Victim lured into fake stock trading app. Invested multiple times. Cannot withdraw.",
            "time_since_fraud_mins": 45,
        },
        "reported_at": datetime.now() - timedelta(minutes=45),
    },
    {
        "ncrp_id": "DL-2025-98765",
        "victim": {
            "name": "Suresh Sharma",
            "phone": "+91-99887XXXXX",
            "area": "Dwarka Sector 21",
            "city": "Delhi",
            "state": "Delhi",
            "pincode": "110077",
            "lat": 28.5562,
            "lon": 77.0520,
        },
        "fraud": {
            "type": "JOB_SCAM",
            "amount": 85000,
            "description": "Victim paid registration fee for fake Amazon job offer. Multiple payments made.",
            "time_since_fraud_mins": 15,
        },
        "reported_at": datetime.now() - timedelta(minutes=15),
    },
    {
        "ncrp_id": "TN-2025-45678",
        "victim": {
            "name": "Priya Natarajan",
            "phone": "+91-94567XXXXX",
            "area": "T. Nagar",
            "city": "Chennai",
            "state": "Tamil Nadu",
            "pincode": "600017",
            "lat": 13.0418,
            "lon": 80.2341,
        },
        "fraud": {
            "type": "KYC_UPDATE_FRAUD",
            "amount": 250000,
            "description": "Victim received SMS about KYC expiry. Clicked link. Money debited.",
            "time_since_fraud_mins": 8,
        },
        "reported_at": datetime.now() - timedelta(minutes=8),
    },
    {
        "ncrp_id": "WB-2025-33221",
        "victim": {
            "name": "Anonymous",
            "phone": "Withheld",
            "area": "Unknown",
            "city": "Unknown",
            "state": "West Bengal",
            "pincode": "Unknown",
            "lat": None,  # Anonymous - no location
            "lon": None,
        },
        "fraud": {
            "type": "ROMANCE_SCAM",
            "amount": 500000,
            "description": "Victim met scammer on dating app. Sent money for fake emergency. Anonymous report.",
            "time_since_fraud_mins": 60,
        },
        "reported_at": datetime.now() - timedelta(minutes=60),
    },
    {
        "ncrp_id": "GJ-2025-77889",
        "victim": {
            "name": "Hitesh Patel",
            "phone": "+91-98123XXXXX",
            "area": "SG Highway",
            "city": "Ahmedabad",
            "state": "Gujarat",
            "pincode": "380054",
            "lat": 23.0225,
            "lon": 72.5714,
        },
        "fraud": {
            "type": "LOTTERY_SCAM",
            "amount": 120000,
            "description": "Victim received WhatsApp message about winning lottery. Paid processing fees.",
            "time_since_fraud_mins": 35,
        },
        "reported_at": datetime.now() - timedelta(minutes=35),
    },
]


def load_model():
    """Load the trained CST model."""
    checkpoint_dir = Path("checkpoints/cst_unified")
    checkpoint_path = checkpoint_dir / "best_model.pt"
    encoders_path = checkpoint_dir / "encoders.pkl"
    atm_path = Path("data/processed/atm_reference.parquet")
    
    if not checkpoint_path.exists():
        raise FileNotFoundError(f"Model not found at {checkpoint_path}")
    
    # Load encoders
    with open(encoders_path, "rb") as f:
        encoders = pickle.load(f)
    
    fraud_encoder = encoders["fraud_encoder"]
    state_encoder = encoders["state_encoder"]
    coord_scaler = encoders["coord_scaler"]
    num_atms = encoders["num_atms"]
    
    # Load ATM data
    atm_df = pd.read_parquet(atm_path) if atm_path.exists() else None
    
    # Load model
    checkpoint = torch.load(checkpoint_path, map_location="cpu")
    model_config = checkpoint.get("model_config", {})
    
    model = CSTTransformer(
        d_model=model_config.get("d_model", 256),
        num_fraud_types=len(fraud_encoder.classes_),
        num_states=len(state_encoder.classes_),
        num_atms=num_atms,
    )
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()
    
    return model, fraud_encoder, state_encoder, coord_scaler, atm_df, checkpoint


def distance_km(lat1, lon1, lat2, lon2):
    """Calculate approximate distance in km."""
    return np.sqrt((lat1 - lat2)**2 + (lon1 - lon2)**2) * 111


def predict_atm_mode(model, fraud_encoder, state_encoder, coord_scaler, atm_df,
                     victim_lat, victim_lon, victim_state, fraud_type, hour, day, month):
    """Predict top ATMs when victim location is known."""
    try:
        fraud_idx = fraud_encoder.transform([fraud_type])[0]
    except:
        fraud_idx = 0
    
    try:
        state_idx = state_encoder.transform([victim_state])[0]
    except:
        state_idx = 0
    
    coords_scaled = coord_scaler.transform([[victim_lat, victim_lon]])
    
    coords_t = torch.tensor(coords_scaled, dtype=torch.float32)
    fraud_t = torch.tensor([fraud_idx], dtype=torch.long)
    state_t = torch.tensor([state_idx], dtype=torch.long)
    hour_t = torch.tensor([hour], dtype=torch.long)
    day_t = torch.tensor([day], dtype=torch.long)
    month_t = torch.tensor([month - 1], dtype=torch.long)
    
    with torch.no_grad():
        top_indices, top_probs = model.predict_atms(
            coords_t, hour_t, day_t, month_t, fraud_t, state_t, top_k=5
        )
    
    results = []
    for i in range(5):
        atm_idx = top_indices[0, i].item()
        prob = top_probs[0, i].item()
        
        if atm_df is not None and 0 <= atm_idx < len(atm_df):
            atm = atm_df.iloc[atm_idx]
            dist = distance_km(victim_lat, victim_lon, atm["latitude"], atm["longitude"])
            results.append({
                "rank": i + 1,
                "atm_name": atm.get("name", f"ATM #{atm_idx}"),
                "bank": atm.get("bank_name", "Unknown"),
                "city": atm.get("city", "Unknown"),
                "lat": atm["latitude"],
                "lon": atm["longitude"],
                "distance_km": round(dist, 1),
                "confidence": round(prob * 100, 1),
            })
    
    return results


def predict_area_mode(model, fraud_encoder, state_encoder, coord_scaler, 
                      victim_state, fraud_type, hour, day, month):
    """Predict general area for anonymous complaints."""
    try:
        fraud_idx = fraud_encoder.transform([fraud_type])[0]
    except:
        fraud_idx = 0
    
    try:
        state_idx = state_encoder.transform([victim_state])[0]
    except:
        state_idx = 0
    
    coords_t = torch.zeros(1, 2, dtype=torch.float32)
    fraud_t = torch.tensor([fraud_idx], dtype=torch.long)
    state_t = torch.tensor([state_idx], dtype=torch.long)
    hour_t = torch.tensor([hour], dtype=torch.long)
    day_t = torch.tensor([day], dtype=torch.long)
    month_t = torch.tensor([month - 1], dtype=torch.long)
    
    with torch.no_grad():
        output = model.predict_area(hour_t, day_t, month_t, fraud_t, state_t)
    
    pred_coords_scaled = output["pred_coords"].numpy()
    pred_coords = coord_scaler.inverse_transform(pred_coords_scaled)[0]
    confidence = output["confidence"].item()
    
    return {
        "lat": round(pred_coords[0], 4),
        "lon": round(pred_coords[1], 4),
        "confidence": round(confidence * 100, 1),
    }


def print_complaint_header(complaint):
    """Print complaint alert header (like 04-new-complaint-alert.html)."""
    v = complaint["victim"]
    f = complaint["fraud"]
    
    print("\n" + "="*80)
    print("🚨 NEW COMPLAINT ALERT - AEGIS AI ANALYSIS")
    print("="*80)
    
    print(f"\n📋 NCRP Complaint ID: {complaint['ncrp_id']}")
    print(f"⏱️  Reported: {complaint['reported_at'].strftime('%H:%M:%S')} ({f['time_since_fraud_mins']} mins ago)")
    
    print(f"\n{'─'*40}")
    print("VICTIM DETAILS")
    print(f"{'─'*40}")
    print(f"  Name      : {v['name']}")
    print(f"  Phone     : {v['phone']}")
    print(f"  Location  : {v['area']}, {v['city']}")
    print(f"  State     : {v['state']}")
    print(f"  Pincode   : {v['pincode']}")
    if v['lat'] is not None:
        print(f"  Coords    : ({v['lat']:.4f}, {v['lon']:.4f})")
    else:
        print(f"  Coords    : Not provided (Anonymous)")
    
    print(f"\n{'─'*40}")
    print("FRAUD DETAILS")
    print(f"{'─'*40}")
    print(f"  Type      : {f['type'].replace('_', ' ')}")
    print(f"  Amount    : ₹{f['amount']:,}")
    print(f"  Summary   : {f['description']}")


def print_ai_prediction(predictions, mode, complaint):
    """Print AI prediction (like 20-ai-analysis.html)."""
    print(f"\n{'─'*40}")
    print("🧠 AI PREDICTION")
    print(f"{'─'*40}")
    
    if mode == "atm":
        print("\n  Mode: ATM PREDICTION (Victim location provided)")
        print("\n  🎯 TOP 5 PREDICTED WITHDRAWAL ATMs:")
        print("  " + "─"*60)
        
        for pred in predictions:
            bar = "█" * int(pred["confidence"] / 10) + "░" * (10 - int(pred["confidence"] / 10))
            print(f"\n  #{pred['rank']}: {pred['atm_name']}")
            print(f"       Bank: {pred['bank']}")
            print(f"       Location: {pred['city']}")
            print(f"       Distance from victim: {pred['distance_km']} km")
            print(f"       Confidence: {pred['confidence']}% [{bar}]")
            
            if pred['rank'] == 1:
                print(f"\n       🔥 PRIMARY TARGET - Alert nearby teams!")
    else:
        print("\n  Mode: AREA PREDICTION (Anonymous complaint)")
        print(f"\n  🎯 PREDICTED GENERAL AREA:")
        print(f"       State: {complaint['victim']['state']}")
        print(f"       Coordinates: ({predictions['lat']}, {predictions['lon']})")
        print(f"       Confidence: {predictions['confidence']}%")
        print(f"\n       📢 General alert for {complaint['victim']['state']} region")


def print_action_recommendations(predictions, mode, complaint):
    """Print recommended actions."""
    print(f"\n{'─'*40}")
    print("⚡ RECOMMENDED ACTIONS")
    print(f"{'─'*40}")
    
    print("""
  ┌────────────────────────────────────────────────────────┐
  │  1. FREEZE ──► 2. ALERT ──► 3. INTERCEPT               │
  └────────────────────────────────────────────────────────┘
    """)
    
    print("  PRIORITY #1: FREEZE MULE ACCOUNTS (< 47 seconds)")
    print("  ───────────────────────────────────────────────")
    print("    • Send NPCI freeze request for identified mule accounts")
    print("    • Money moves in SECONDS, criminals travel in MINUTES")
    print("    • Freeze = Money SAFE, can be recovered")
    
    print("\n  PRIORITY #2: ALERT NEARBY TEAMS")
    print("  ───────────────────────────────────────────────")
    
    if mode == "atm" and predictions:
        top_atm = predictions[0]
        print(f"    • Deploy team to: {top_atm['atm_name']}")
        print(f"    • Bank: {top_atm['bank']}")
        print(f"    • Distance from victim: {top_atm['distance_km']} km")
        print(f"    • Estimated arrival: 35-50 minutes")
    else:
        print(f"    • General alert for {complaint['victim']['state']} region")
        print(f"    • Monitor ATMs in predicted coordinates")
    
    print("\n  PRIORITY #3: INTERCEPT")
    print("  ───────────────────────────────────────────────")
    print("    • Criminal arrives at ATM → Card BLOCKED → Team ARRESTS!")


def simulate_aegis_flow(complaint, model, fraud_encoder, state_encoder, coord_scaler, atm_df):
    """Simulate the complete AEGIS flow for a complaint."""
    v = complaint["victim"]
    f = complaint["fraud"]
    
    # Get current time info
    now = datetime.now()
    hour = now.hour
    day = now.weekday()
    month = now.month
    
    # Print complaint header
    print_complaint_header(complaint)
    
    # Determine mode and get prediction
    if v["lat"] is not None:
        # ATM Mode
        predictions = predict_atm_mode(
            model, fraud_encoder, state_encoder, coord_scaler, atm_df,
            v["lat"], v["lon"], v["state"], f["type"], hour, day, month
        )
        mode = "atm"
    else:
        # Area Mode (anonymous)
        predictions = predict_area_mode(
            model, fraud_encoder, state_encoder, coord_scaler,
            v["state"], f["type"], hour, day, month
        )
        mode = "area"
    
    # Print predictions
    print_ai_prediction(predictions, mode, complaint)
    
    # Print action recommendations
    print_action_recommendations(predictions, mode, complaint)
    
    return mode, predictions


def main():
    print("\n" + "═"*80)
    print("   AEGIS - REAL-WORLD SCENARIO TESTING")
    print("   Anticipatory Engine for Geolocated Intervention against Scams")
    print("═"*80)
    print("\nThis test simulates the complete AEGIS MVP flow:")
    print("  1. Complaint received from NCRP portal")
    print("  2. AI analyzes complaint and predicts withdrawal location")
    print("  3. Shows what LEA officers would see in the app")
    print("  4. Recommends freeze → alert → intercept actions")
    print("═"*80)
    
    # Load model
    try:
        model, fraud_encoder, state_encoder, coord_scaler, atm_df, checkpoint = load_model()
        print("\n✓ Model loaded successfully")
        print(f"  ATM Accuracy: {checkpoint.get('val_atm_accuracy', 0)*100:.1f}%")
        print(f"  Top-5 Accuracy: {checkpoint.get('val_top5_accuracy', 0)*100:.1f}%")
    except FileNotFoundError as e:
        print(f"\n❌ {e}")
        print("   Train the model first: python scripts/train_cst_transformer.py --epochs 60")
        return
    
    # Process each complaint
    for i, complaint in enumerate(REALISTIC_COMPLAINTS):
        print(f"\n\n{'▓'*80}")
        print(f"  CASE {i+1}/{len(REALISTIC_COMPLAINTS)}")
        print(f"{'▓'*80}")
        
        mode, predictions = simulate_aegis_flow(
            complaint, model, fraud_encoder, state_encoder, coord_scaler, atm_df
        )
        
        input("\n\n  Press Enter to continue to next case...")
    
    # Final summary
    print("\n\n" + "═"*80)
    print("   TESTING COMPLETE")
    print("═"*80)
    print(f"""
    ✓ Tested {len(REALISTIC_COMPLAINTS)} realistic fraud complaints
    ✓ Model provides predictions for both:
      • ATM Mode (when victim location is known)
      • Area Mode (for anonymous complaints)
    
    📱 This is exactly what LEA officers would see in the AEGIS app!
    
    Next Steps:
    1. Run benchmark to check accuracy: python scripts/benchmark_cst_model.py
    2. Try live predictions: python scripts/test_live_prediction.py
    """)


if __name__ == "__main__":
    main()

