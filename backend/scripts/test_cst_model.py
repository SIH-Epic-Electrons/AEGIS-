"""
Test Unified CST Transformer.

Tests both modes:
1. ATM Mode (with victim location): Shows Top 3 ATMs with confidence
2. Area Mode (anonymous): Shows predicted area coordinates

This is the single test script for AEGIS location prediction.
"""

import sys
from pathlib import Path
import pickle
import pandas as pd
import torch
import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.ml.models.cst_transformer import CSTTransformer


def load_model(checkpoint_dir: str = "checkpoints/cst_unified"):
    """Load trained model, encoders, and ATM data."""
    checkpoint_path = Path(checkpoint_dir) / "best_model.pt"
    encoders_path = Path(checkpoint_dir) / "encoders.pkl"
    atm_path = Path("data/processed/atm_reference.parquet")
    
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
    
    print(f"✓ Model loaded from {checkpoint_path}")
    print(f"  ATM Accuracy: {checkpoint.get('val_atm_accuracy', 0)*100:.1f}%")
    print(f"  Top-5 Accuracy: {checkpoint.get('val_top5_accuracy', 0)*100:.1f}%")
    print(f"  Fraud types: {list(fraud_encoder.classes_)}")
    print(f"  States: {list(state_encoder.classes_)}")
    print(f"  ATMs: {num_atms}")
    
    return model, fraud_encoder, state_encoder, coord_scaler, atm_df


def distance_km(lat1, lon1, lat2, lon2):
    """Approximate distance in km."""
    return np.sqrt((lat1 - lat2)**2 + (lon1 - lon2)**2) * 111


def predict_with_location(model, fraud_encoder, state_encoder, coord_scaler, atm_df,
                          victim_lat: float, victim_lon: float, victim_state: str,
                          fraud_type: str, hour: int, day: int, month: int,
                          top_k: int = 3):
    """
    ATM Mode: Predict top K ATMs when victim location is provided.
    """
    # Encode inputs
    try:
        fraud_idx = fraud_encoder.transform([fraud_type])[0]
    except:
        fraud_idx = 0
    
    try:
        state_idx = state_encoder.transform([victim_state])[0]
    except:
        state_idx = 0
    
    # Scale coordinates
    coords_scaled = coord_scaler.transform([[victim_lat, victim_lon]])
    
    # Create tensors
    coords_t = torch.tensor(coords_scaled, dtype=torch.float32)
    fraud_t = torch.tensor([fraud_idx], dtype=torch.long)
    state_t = torch.tensor([state_idx], dtype=torch.long)
    hour_t = torch.tensor([hour], dtype=torch.long)
    day_t = torch.tensor([day], dtype=torch.long)
    month_t = torch.tensor([month - 1], dtype=torch.long)
    
    # Predict
    with torch.no_grad():
        top_indices, top_probs = model.predict_atms(
            coords_t, hour_t, day_t, month_t, fraud_t, state_t, top_k=top_k
        )
    
    # Format results
    results = []
    for i in range(top_k):
        atm_idx = top_indices[0, i].item()
        prob = top_probs[0, i].item()
        
        if atm_df is not None and atm_idx >= 0:
            atm = atm_df.iloc[atm_idx]
            dist = distance_km(victim_lat, victim_lon, atm["latitude"], atm["longitude"])
            results.append({
                "rank": i + 1,
                "atm_name": atm.get("name", "ATM"),
                "bank": atm.get("bank_name", "Unknown"),
                "city": atm.get("city", "Unknown"),
                "lat": atm["latitude"],
                "lon": atm["longitude"],
                "distance_km": round(dist, 1),
                "confidence": round(prob * 100, 1),
            })
        else:
            results.append({
                "rank": i + 1,
                "atm_name": f"ATM #{atm_idx}",
                "bank": "Unknown",
                "city": "Unknown",
                "distance_km": 0,
                "confidence": round(prob * 100, 1),
            })
    
    return results


def predict_without_location(model, fraud_encoder, state_encoder, coord_scaler,
                             victim_state: str, fraud_type: str,
                             hour: int, day: int, month: int):
    """
    Area Mode: Predict general area when victim location is NOT provided.
    """
    # Encode inputs
    try:
        fraud_idx = fraud_encoder.transform([fraud_type])[0]
    except:
        fraud_idx = 0
    
    try:
        state_idx = state_encoder.transform([victim_state])[0]
    except:
        state_idx = 0
    
    # Create tensors (zero coordinates for area mode)
    coords_t = torch.zeros(1, 2, dtype=torch.float32)
    fraud_t = torch.tensor([fraud_idx], dtype=torch.long)
    state_t = torch.tensor([state_idx], dtype=torch.long)
    hour_t = torch.tensor([hour], dtype=torch.long)
    day_t = torch.tensor([day], dtype=torch.long)
    month_t = torch.tensor([month - 1], dtype=torch.long)
    
    # Predict
    with torch.no_grad():
        output = model.predict_area(hour_t, day_t, month_t, fraud_t, state_t)
    
    # Denormalize coordinates
    pred_coords_scaled = output["pred_coords"].numpy()
    pred_coords = coord_scaler.inverse_transform(pred_coords_scaled)[0]
    confidence = output["confidence"].item()
    
    return {
        "lat": round(pred_coords[0], 4),
        "lon": round(pred_coords[1], 4),
        "confidence": round(confidence * 100, 1),
    }


def print_atm_case(name: str, victim: dict, fraud: dict, predictions: list):
    """Print ATM mode test case."""
    print(f"\n{'='*70}")
    print(f"ATM MODE: {name}")
    print(f"{'='*70}")
    
    print(f"\n📍 VICTIM LOCATION (Provided):")
    print(f"   Area: {victim['area']}")
    print(f"   Pincode: {victim['pincode']}")
    print(f"   State: {victim['state']}")
    print(f"   Coordinates: ({victim['lat']:.4f}, {victim['lon']:.4f})")
    
    print(f"\n🔴 FRAUD DETAILS:")
    print(f"   Type: {fraud['type']}")
    days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    print(f"   Time: {fraud['hour']:02d}:00 on {days[fraud['day']]}, {months[fraud['month']-1]}")
    
    print(f"\n🎯 TOP 3 PREDICTED ATMs:")
    print(f"   " + "-"*55)
    
    for pred in predictions:
        bar = "█" * int(pred["confidence"] / 10) + "░" * (10 - int(pred["confidence"] / 10))
        print(f"\n   #{pred['rank']}: {pred['atm_name']}")
        print(f"       Bank: {pred['bank']}")
        print(f"       City: {pred['city']}")
        print(f"       Distance from victim: {pred['distance_km']} km")
        print(f"       Confidence: {pred['confidence']}% [{bar}]")


def print_area_case(name: str, fraud: dict, prediction: dict):
    """Print Area mode test case."""
    print(f"\n{'='*70}")
    print(f"AREA MODE (Anonymous): {name}")
    print(f"{'='*70}")
    
    print(f"\n📍 VICTIM LOCATION: Not provided (Anonymous complaint)")
    print(f"   Known: State = {fraud['state']}")
    
    print(f"\n🔴 FRAUD DETAILS:")
    print(f"   Type: {fraud['type']}")
    days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    print(f"   Time: {fraud['hour']:02d}:00 on {days[fraud['day']]}, {months[fraud['month']-1]}")
    
    print(f"\n🎯 PREDICTED AREA:")
    print(f"   Coordinates: ({prediction['lat']}, {prediction['lon']})")
    print(f"   Confidence: {prediction['confidence']}%")
    print(f"\n📢 ACTION: General alert for {fraud['state']} region")
    print(f"   Monitor ATMs in predicted area")


def main():
    print("\n" + "="*70)
    print("UNIFIED CST TRANSFORMER - TEST")
    print("="*70)
    print("Single model with dual modes:")
    print("  • ATM Mode: Victim location → Top 3 ATMs")
    print("  • Area Mode: Anonymous → General area")
    print("="*70)
    
    # Load model
    try:
        model, fraud_encoder, state_encoder, coord_scaler, atm_df = load_model()
    except FileNotFoundError:
        print("\n❌ Model not found! Train first:")
        print("   python scripts/train_cst_transformer.py --epochs 60")
        return
    
    # ===================
    # ATM MODE TEST CASES
    # ===================
    atm_cases = [
        {
            "name": "OTP Fraud in Bangalore Laggere",
            "victim": {"area": "Laggere, Bangalore", "pincode": "560058", 
                      "state": "Karnataka", "lat": 13.0358, "lon": 77.5194},
            "fraud": {"type": "OTP_PHISHING", "hour": 19, "day": 2, "month": 6}
        },
        {
            "name": "Investment Scam in Mumbai Andheri",
            "victim": {"area": "Andheri West, Mumbai", "pincode": "400058",
                      "state": "Maharashtra", "lat": 19.1136, "lon": 72.8697},
            "fraud": {"type": "INVESTMENT_SCAM", "hour": 10, "day": 0, "month": 9}
        },
        {
            "name": "Job Scam in Delhi Dwarka",
            "victim": {"area": "Dwarka, Delhi", "pincode": "110075",
                      "state": "Delhi", "lat": 28.5921, "lon": 77.0460},
            "fraud": {"type": "JOB_SCAM", "hour": 14, "day": 4, "month": 3}
        },
        {
            "name": "KYC Fraud in Hyderabad Hitech City",
            "victim": {"area": "Hitech City, Hyderabad", "pincode": "500081",
                      "state": "Telangana", "lat": 17.4435, "lon": 78.3772},
            "fraud": {"type": "KYC_UPDATE_FRAUD", "hour": 11, "day": 1, "month": 11}
        },
    ]
    
    print("\n" + "="*70)
    print("TESTING ATM MODE (With Victim Location)")
    print("="*70)
    
    for case in atm_cases:
        predictions = predict_with_location(
            model, fraud_encoder, state_encoder, coord_scaler, atm_df,
            victim_lat=case["victim"]["lat"],
            victim_lon=case["victim"]["lon"],
            victim_state=case["victim"]["state"],
            fraud_type=case["fraud"]["type"],
            hour=case["fraud"]["hour"],
            day=case["fraud"]["day"],
            month=case["fraud"]["month"],
        )
        print_atm_case(case["name"], case["victim"], case["fraud"], predictions)
    
    # ====================
    # AREA MODE TEST CASES
    # ====================
    area_cases = [
        {
            "name": "Anonymous OTP Fraud in Karnataka",
            "fraud": {"type": "OTP_PHISHING", "state": "Karnataka",
                     "hour": 20, "day": 3, "month": 5}
        },
        {
            "name": "Anonymous Romance Scam in Maharashtra",
            "fraud": {"type": "ROMANCE_SCAM", "state": "Maharashtra",
                     "hour": 22, "day": 5, "month": 2}
        },
        {
            "name": "Anonymous Lottery Scam in Delhi",
            "fraud": {"type": "LOTTERY_SCAM", "state": "Delhi",
                     "hour": 15, "day": 1, "month": 8}
        },
    ]
    
    print("\n" + "="*70)
    print("TESTING AREA MODE (Anonymous - No Victim Location)")
    print("="*70)
    
    for case in area_cases:
        prediction = predict_without_location(
            model, fraud_encoder, state_encoder, coord_scaler,
            victim_state=case["fraud"]["state"],
            fraud_type=case["fraud"]["type"],
            hour=case["fraud"]["hour"],
            day=case["fraud"]["day"],
            month=case["fraud"]["month"],
        )
        print_area_case(case["name"], case["fraud"], prediction)
    
    # Summary
    print("\n" + "="*70)
    print("HOW CST TRANSFORMER HELPS AEGIS")
    print("="*70)
    print("""
UNIFIED MODEL - Two modes in one:

┌────────────────────────────────────────────────────────────────────┐
│                        NCRP COMPLAINT                              │
└────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
    ┌──────────────────┐            ┌──────────────────┐
    │ VICTIM LOCATION  │            │ ANONYMOUS REPORT │
    │    PROVIDED      │            │ (No Location)    │
    └──────────────────┘            └──────────────────┘
              │                               │
              ▼                               ▼
    ┌──────────────────┐            ┌──────────────────┐
    │   ATM MODE       │            │   AREA MODE      │
    │                  │            │                  │
    │ Input:           │            │ Input:           │
    │ • Victim coords  │            │ • Fraud type     │
    │ • Fraud type     │            │ • Time           │
    │ • Time           │            │ • State only     │
    │ • State          │            │                  │
    └──────────────────┘            └──────────────────┘
              │                               │
              ▼                               ▼
    ┌──────────────────┐            ┌──────────────────┐
    │ OUTPUT:          │            │ OUTPUT:          │
    │ Top 3 ATMs       │            │ General area     │
    │ with names       │            │ coordinates      │
    │ and confidence   │            │                  │
    │                  │            │                  │
    │ #1 HDFC HSR 85%  │            │ (19.07, 72.87)   │
    │ #2 SBI Chand 72% │            │ Mumbai region    │
    │ #3 ICICI Ban 68% │            │                  │
    └──────────────────┘            └──────────────────┘
              │                               │
              └───────────────┬───────────────┘
                              ▼
                    ┌──────────────────┐
                    │  ALERT POLICE    │
                    │  TO SPECIFIC     │
                    │  LOCATION(S)     │
                    └──────────────────┘
""")


if __name__ == "__main__":
    main()
