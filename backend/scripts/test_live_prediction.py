"""
Interactive Live Prediction Tester for AEGIS.

This script provides an interactive interface to test the CST model
with custom inputs - simulating how an LEA officer would use the system.

Features:
1. Enter custom fraud details
2. Get instant predictions
3. See top ATMs with confidence
4. Compare predictions for different scenarios

Run: python scripts/test_live_prediction.py
"""

import sys
from pathlib import Path
from datetime import datetime
import pickle

import pandas as pd
import torch
import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.ml.models.cst_transformer import CSTTransformer


class AEGISPredictor:
    """Interactive AEGIS prediction interface."""
    
    def __init__(self):
        self.model = None
        self.fraud_encoder = None
        self.state_encoder = None
        self.coord_scaler = None
        self.atm_df = None
        self.loaded = False
    
    def load(self):
        """Load the trained model."""
        checkpoint_dir = Path("checkpoints/cst_unified")
        checkpoint_path = checkpoint_dir / "best_model.pt"
        encoders_path = checkpoint_dir / "encoders.pkl"
        atm_path = Path("data/processed/atm_reference.parquet")
        
        if not checkpoint_path.exists():
            print("❌ Model not found! Train first:")
            print("   python scripts/train_cst_transformer.py --epochs 60")
            return False
        
        # Load encoders
        with open(encoders_path, "rb") as f:
            encoders = pickle.load(f)
        
        self.fraud_encoder = encoders["fraud_encoder"]
        self.state_encoder = encoders["state_encoder"]
        self.coord_scaler = encoders["coord_scaler"]
        num_atms = encoders["num_atms"]
        
        # Load ATM data
        self.atm_df = pd.read_parquet(atm_path) if atm_path.exists() else None
        
        # Load model
        checkpoint = torch.load(checkpoint_path, map_location="cpu")
        model_config = checkpoint.get("model_config", {})
        
        self.model = CSTTransformer(
            d_model=model_config.get("d_model", 256),
            num_fraud_types=len(self.fraud_encoder.classes_),
            num_states=len(self.state_encoder.classes_),
            num_atms=num_atms,
        )
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.model.eval()
        
        self.loaded = True
        print("✓ AEGIS AI Model loaded successfully!")
        print(f"  Fraud types: {list(self.fraud_encoder.classes_)}")
        print(f"  States: {list(self.state_encoder.classes_)}")
        print(f"  ATMs: {num_atms}")
        
        return True
    
    def predict(self, victim_lat=None, victim_lon=None, victim_state=None,
                fraud_type=None, hour=None, day=None, month=None, top_k=5):
        """
        Get prediction for a fraud case.
        
        Args:
            victim_lat: Victim latitude (None for anonymous)
            victim_lon: Victim longitude (None for anonymous)
            victim_state: State name
            fraud_type: Fraud type (from available types)
            hour: Hour of day (0-23)
            day: Day of week (0=Mon, 6=Sun)
            month: Month (1-12)
            top_k: Number of top ATMs to return
        
        Returns:
            dict with predictions
        """
        if not self.loaded:
            return {"error": "Model not loaded"}
        
        # Use current time if not specified
        now = datetime.now()
        hour = hour if hour is not None else now.hour
        day = day if day is not None else now.weekday()
        month = month if month is not None else now.month
        
        # Encode inputs
        try:
            fraud_idx = self.fraud_encoder.transform([fraud_type])[0]
        except:
            fraud_idx = 0
            print(f"  ⚠️ Unknown fraud type '{fraud_type}', using default")
        
        try:
            state_idx = self.state_encoder.transform([victim_state])[0]
        except:
            state_idx = 0
            print(f"  ⚠️ Unknown state '{victim_state}', using default")
        
        # Determine mode
        if victim_lat is not None and victim_lon is not None:
            # ATM Mode
            coords_scaled = self.coord_scaler.transform([[victim_lat, victim_lon]])
            coords_t = torch.tensor(coords_scaled, dtype=torch.float32)
            mode = "atm"
        else:
            # Area Mode
            coords_t = torch.zeros(1, 2, dtype=torch.float32)
            mode = "area"
        
        fraud_t = torch.tensor([fraud_idx], dtype=torch.long)
        state_t = torch.tensor([state_idx], dtype=torch.long)
        hour_t = torch.tensor([hour], dtype=torch.long)
        day_t = torch.tensor([day], dtype=torch.long)
        month_t = torch.tensor([month - 1], dtype=torch.long)
        
        # Get prediction
        with torch.no_grad():
            if mode == "atm":
                top_indices, top_probs = self.model.predict_atms(
                    coords_t, hour_t, day_t, month_t, fraud_t, state_t, top_k=top_k
                )
                
                # Get ATM details
                atms = []
                for i in range(top_k):
                    atm_idx = top_indices[0, i].item()
                    prob = top_probs[0, i].item()
                    
                    if self.atm_df is not None and 0 <= atm_idx < len(self.atm_df):
                        atm = self.atm_df.iloc[atm_idx]
                        dist = self._distance(victim_lat, victim_lon, 
                                             atm["latitude"], atm["longitude"])
                        atms.append({
                            "rank": i + 1,
                            "name": atm.get("name", f"ATM #{atm_idx}"),
                            "bank": atm.get("bank_name", "Unknown"),
                            "city": atm.get("city", "Unknown"),
                            "lat": atm["latitude"],
                            "lon": atm["longitude"],
                            "distance_km": round(dist, 1),
                            "confidence": round(prob * 100, 1),
                        })
                
                return {
                    "mode": "ATM",
                    "predictions": atms,
                    "input": {
                        "victim_location": (victim_lat, victim_lon),
                        "state": victim_state,
                        "fraud_type": fraud_type,
                        "time": f"{hour:02d}:00, Day {day}, Month {month}"
                    }
                }
            else:
                output = self.model.predict_area(hour_t, day_t, month_t, fraud_t, state_t)
                pred_coords = self.coord_scaler.inverse_transform(
                    output["pred_coords"].numpy()
                )[0]
                confidence = output["confidence"].item()
                
                return {
                    "mode": "AREA",
                    "predictions": {
                        "lat": round(pred_coords[0], 4),
                        "lon": round(pred_coords[1], 4),
                        "confidence": round(confidence * 100, 1),
                    },
                    "input": {
                        "state": victim_state,
                        "fraud_type": fraud_type,
                        "time": f"{hour:02d}:00, Day {day}, Month {month}"
                    }
                }
    
    def _distance(self, lat1, lon1, lat2, lon2):
        """Approximate distance in km."""
        return np.sqrt((lat1 - lat2)**2 + (lon1 - lon2)**2) * 111
    
    def get_fraud_types(self):
        """Get available fraud types."""
        if self.loaded:
            return list(self.fraud_encoder.classes_)
        return []
    
    def get_states(self):
        """Get available states."""
        if self.loaded:
            return list(self.state_encoder.classes_)
        return []


def print_prediction(result):
    """Pretty print prediction result."""
    print(f"\n{'─'*60}")
    print(f"🧠 AEGIS AI PREDICTION ({result['mode']} MODE)")
    print(f"{'─'*60}")
    
    print(f"\n📥 INPUT:")
    for k, v in result["input"].items():
        print(f"   {k}: {v}")
    
    if result["mode"] == "ATM":
        print(f"\n🎯 TOP {len(result['predictions'])} PREDICTED ATMs:")
        print("   " + "─"*50)
        
        for atm in result["predictions"]:
            bar = "█" * int(atm["confidence"] / 10) + "░" * (10 - int(atm["confidence"] / 10))
            print(f"\n   #{atm['rank']}: {atm['name']}")
            print(f"        Bank: {atm['bank']} | City: {atm['city']}")
            print(f"        Distance: {atm['distance_km']} km")
            print(f"        Confidence: {atm['confidence']}% [{bar}]")
    else:
        pred = result["predictions"]
        print(f"\n🎯 PREDICTED AREA:")
        print(f"   Coordinates: ({pred['lat']}, {pred['lon']})")
        print(f"   Confidence: {pred['confidence']}%")


def interactive_mode(predictor):
    """Run interactive prediction mode."""
    print("\n" + "="*60)
    print("INTERACTIVE PREDICTION MODE")
    print("="*60)
    print("\nEnter fraud details to get predictions.")
    print("Type 'quit' to exit, 'help' for available options.\n")
    
    fraud_types = predictor.get_fraud_types()
    states = predictor.get_states()
    
    while True:
        try:
            print("\n" + "─"*60)
            cmd = input("Enter command (predict/quick/help/quit): ").strip().lower()
            
            if cmd == "quit" or cmd == "q":
                print("\n👋 Goodbye!")
                break
            
            elif cmd == "help" or cmd == "h":
                print("\n📋 AVAILABLE OPTIONS:")
                print("\n  Commands:")
                print("    predict - Full prediction with custom inputs")
                print("    quick   - Quick prediction with presets")
                print("    types   - Show fraud types")
                print("    states  - Show states")
                print("    quit    - Exit")
                print("\n  Fraud Types:", fraud_types)
                print("\n  States:", states)
            
            elif cmd == "types":
                print("\n📋 FRAUD TYPES:")
                for i, ft in enumerate(fraud_types, 1):
                    print(f"   {i}. {ft}")
            
            elif cmd == "states":
                print("\n📋 STATES:")
                for i, st in enumerate(states, 1):
                    print(f"   {i}. {st}")
            
            elif cmd == "quick":
                print("\n⚡ QUICK PREDICTION (using current time)")
                print("\nSelect fraud type:")
                for i, ft in enumerate(fraud_types, 1):
                    print(f"  {i}. {ft}")
                
                ft_idx = int(input("Enter number: ")) - 1
                fraud_type = fraud_types[ft_idx]
                
                print("\nSelect state:")
                for i, st in enumerate(states, 1):
                    print(f"  {i}. {st}")
                
                st_idx = int(input("Enter number: ")) - 1
                state = states[st_idx]
                
                has_location = input("\nHas victim location? (y/n): ").strip().lower()
                
                if has_location == 'y':
                    lat = float(input("Enter victim latitude (e.g., 19.0760): "))
                    lon = float(input("Enter victim longitude (e.g., 72.8777): "))
                    result = predictor.predict(
                        victim_lat=lat, victim_lon=lon,
                        victim_state=state, fraud_type=fraud_type
                    )
                else:
                    result = predictor.predict(
                        victim_state=state, fraud_type=fraud_type
                    )
                
                print_prediction(result)
            
            elif cmd == "predict":
                print("\n🔮 FULL PREDICTION")
                
                # Fraud type
                print("\nFraud type:")
                for i, ft in enumerate(fraud_types, 1):
                    print(f"  {i}. {ft}")
                ft_idx = int(input("Enter number: ")) - 1
                fraud_type = fraud_types[ft_idx]
                
                # State
                print("\nState:")
                for i, st in enumerate(states, 1):
                    print(f"  {i}. {st}")
                st_idx = int(input("Enter number: ")) - 1
                state = states[st_idx]
                
                # Location
                has_location = input("\nVictim location known? (y/n): ").strip().lower()
                if has_location == 'y':
                    lat = float(input("Latitude: "))
                    lon = float(input("Longitude: "))
                else:
                    lat = None
                    lon = None
                
                # Time
                use_current = input("\nUse current time? (y/n): ").strip().lower()
                if use_current == 'y':
                    hour = None
                    day = None
                    month = None
                else:
                    hour = int(input("Hour (0-23): "))
                    day = int(input("Day of week (0=Mon, 6=Sun): "))
                    month = int(input("Month (1-12): "))
                
                result = predictor.predict(
                    victim_lat=lat, victim_lon=lon,
                    victim_state=state, fraud_type=fraud_type,
                    hour=hour, day=day, month=month
                )
                
                print_prediction(result)
            
            else:
                print("Unknown command. Type 'help' for options.")
        
        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")
            print("Try again or type 'help' for options.")


def demo_predictions(predictor):
    """Run demo predictions."""
    print("\n" + "="*60)
    print("DEMO PREDICTIONS")
    print("="*60)
    
    demos = [
        {
            "name": "OTP Fraud in Mumbai (with location)",
            "params": {
                "victim_lat": 19.0760,
                "victim_lon": 72.8777,
                "victim_state": "Maharashtra",
                "fraud_type": "OTP_PHISHING",
                "hour": 14,
                "day": 2,
                "month": 6,
            }
        },
        {
            "name": "Investment Scam in Bangalore (with location)",
            "params": {
                "victim_lat": 12.9716,
                "victim_lon": 77.5946,
                "victim_state": "Karnataka",
                "fraud_type": "INVESTMENT_SCAM",
                "hour": 10,
                "day": 0,
                "month": 9,
            }
        },
        {
            "name": "Job Scam in Delhi (with location)",
            "params": {
                "victim_lat": 28.6139,
                "victim_lon": 77.2090,
                "victim_state": "Delhi",
                "fraud_type": "JOB_SCAM",
                "hour": 16,
                "day": 4,
                "month": 3,
            }
        },
        {
            "name": "Romance Scam (anonymous - no location)",
            "params": {
                "victim_state": "Tamil Nadu",
                "fraud_type": "ROMANCE_SCAM",
                "hour": 22,
                "day": 5,
                "month": 2,
            }
        },
        {
            "name": "Lottery Scam (anonymous - no location)",
            "params": {
                "victim_state": "Gujarat",
                "fraud_type": "LOTTERY_SCAM",
                "hour": 11,
                "day": 3,
                "month": 8,
            }
        },
    ]
    
    for demo in demos:
        print(f"\n\n{'▓'*60}")
        print(f"  DEMO: {demo['name']}")
        print(f"{'▓'*60}")
        
        result = predictor.predict(**demo["params"])
        print_prediction(result)
        
        input("\n  Press Enter for next demo...")
    
    print("\n✓ Demo complete!")


def main():
    print("\n" + "="*60)
    print("   AEGIS LIVE PREDICTION TESTER")
    print("   Test the CST Transformer in real-time")
    print("="*60)
    
    # Initialize predictor
    predictor = AEGISPredictor()
    
    print("\n📂 Loading model...")
    if not predictor.load():
        return
    
    # Menu
    while True:
        print("\n" + "="*60)
        print("MAIN MENU")
        print("="*60)
        print("\n  1. Interactive Mode (enter custom inputs)")
        print("  2. Demo Mode (see sample predictions)")
        print("  3. Exit")
        
        try:
            choice = input("\nEnter choice (1/2/3): ").strip()
            
            if choice == "1":
                interactive_mode(predictor)
            elif choice == "2":
                demo_predictions(predictor)
            elif choice == "3":
                print("\n👋 Goodbye!")
                break
            else:
                print("Invalid choice. Enter 1, 2, or 3.")
        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!")
            break


if __name__ == "__main__":
    main()

