"""
Benchmark CST Transformer Model.

Evaluates the trained model on test data with comprehensive metrics:
- ATM Prediction Accuracy (Top-1, Top-3, Top-5, Top-10)
- Coordinate Prediction Error (MAE, RMSE)
- Confidence Calibration
- Per-State Performance
- Per-Fraud-Type Performance

Run: python scripts/benchmark_cst_model.py
"""

import sys
from pathlib import Path
import pickle
from collections import defaultdict
import time

import pandas as pd
import torch
import numpy as np
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader, TensorDataset

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.ml.models.cst_transformer import CSTTransformer


def load_model_and_data():
    """Load model, encoders, and test data."""
    checkpoint_dir = Path("checkpoints/cst_unified")
    checkpoint_path = checkpoint_dir / "best_model.pt"
    encoders_path = checkpoint_dir / "encoders.pkl"
    data_path = Path("data/processed/cst_unified_dataset.parquet")
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
    
    # Load data
    df = pd.read_parquet(data_path)
    atm_df = pd.read_parquet(atm_path) if atm_path.exists() else None
    
    return model, fraud_encoder, state_encoder, coord_scaler, df, atm_df, checkpoint


def prepare_test_data(df, fraud_encoder, state_encoder, coord_scaler, test_size=0.15):
    """Prepare test data tensors."""
    # Use only ATM mode data (with victim location)
    atm_df = df[df["has_victim_location"] == True].copy()
    
    # Encode fraud types
    atm_df["fraud_idx"] = fraud_encoder.transform(atm_df["fraud_type"])
    
    # Encode states (handle unknown states)
    def safe_state_encode(state):
        try:
            return state_encoder.transform([state])[0]
        except:
            return 0
    atm_df["state_idx"] = atm_df["victim_state"].apply(safe_state_encode)
    
    # Split into train/test
    _, test_df = train_test_split(atm_df, test_size=test_size, random_state=42)
    print(f"  Test samples: {len(test_df)}")
    
    # Scale coordinates
    coords = test_df[["victim_lat", "victim_lon"]].values
    coords_scaled = coord_scaler.transform(coords)
    
    target_coords = test_df[["target_lat", "target_lon"]].values
    target_coords_scaled = coord_scaler.transform(target_coords)
    
    # Create tensors
    coords_t = torch.tensor(coords_scaled, dtype=torch.float32)
    hour_t = torch.tensor(test_df["hour"].values, dtype=torch.long)
    day_t = torch.tensor(test_df["day_of_week"].values, dtype=torch.long)
    month_t = torch.tensor((test_df["month"].values - 1).clip(0, 11), dtype=torch.long)
    fraud_t = torch.tensor(test_df["fraud_idx"].values, dtype=torch.long)
    state_t = torch.tensor(test_df["state_idx"].values, dtype=torch.long)
    target_atm_t = torch.tensor(test_df["target_atm_idx"].values, dtype=torch.long)
    target_coords_t = torch.tensor(target_coords_scaled, dtype=torch.float32)
    
    return (coords_t, hour_t, day_t, month_t, fraud_t, state_t, 
            target_atm_t, target_coords_t, test_df)


def compute_topk_accuracy(probs, targets, k):
    """Compute top-k accuracy."""
    topk = torch.topk(probs, k=min(k, probs.size(-1)), dim=-1).indices
    correct = (topk == targets.unsqueeze(1)).any(dim=-1).float()
    return correct.mean().item()


def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate great-circle distance in km."""
    R = 6371  # Earth's radius in km
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2)**2
    c = 2 * np.arcsin(np.sqrt(a))
    return R * c


def benchmark_model(model, data, coord_scaler, test_df):
    """Run comprehensive benchmark."""
    (coords_t, hour_t, day_t, month_t, fraud_t, state_t, 
     target_atm_t, target_coords_t, _) = data
    
    results = {}
    
    print("\n  Running inference...")
    start_time = time.time()
    
    # Batch inference
    batch_size = 256
    all_atm_probs = []
    all_pred_coords = []
    all_confidence = []
    
    n_samples = len(coords_t)
    for i in range(0, n_samples, batch_size):
        end_idx = min(i + batch_size, n_samples)
        
        with torch.no_grad():
            output = model(
                coords_t[i:end_idx],
                hour_t[i:end_idx],
                day_t[i:end_idx],
                month_t[i:end_idx],
                fraud_t[i:end_idx],
                state_t[i:end_idx],
                mode="atm"
            )
        
        all_atm_probs.append(output["atm_probs"])
        all_pred_coords.append(output["pred_coords"])
        all_confidence.append(output["confidence"])
    
    atm_probs = torch.cat(all_atm_probs, dim=0)
    pred_coords = torch.cat(all_pred_coords, dim=0)
    confidence = torch.cat(all_confidence, dim=0)
    
    inference_time = time.time() - start_time
    results["inference_time_ms"] = (inference_time / n_samples) * 1000
    
    print(f"  Inference time: {results['inference_time_ms']:.2f} ms/sample")
    
    # ==================
    # ATM Accuracy
    # ==================
    print("\n  Computing ATM accuracy metrics...")
    
    for k in [1, 3, 5, 10]:
        acc = compute_topk_accuracy(atm_probs, target_atm_t, k)
        results[f"top{k}_accuracy"] = acc
        print(f"    Top-{k} Accuracy: {acc*100:.2f}%")
    
    # ==================
    # Coordinate Error
    # ==================
    print("\n  Computing coordinate error metrics...")
    
    # Denormalize coordinates
    pred_coords_np = pred_coords.numpy()
    target_coords_np = target_coords_t.numpy()
    
    pred_denorm = coord_scaler.inverse_transform(pred_coords_np)
    target_denorm = coord_scaler.inverse_transform(target_coords_np)
    
    # Euclidean error in degrees
    euclidean_error = np.sqrt(np.sum((pred_denorm - target_denorm)**2, axis=1))
    results["coord_mae_deg"] = euclidean_error.mean()
    results["coord_rmse_deg"] = np.sqrt((euclidean_error**2).mean())
    
    print(f"    MAE (degrees): {results['coord_mae_deg']:.4f}")
    print(f"    RMSE (degrees): {results['coord_rmse_deg']:.4f}")
    
    # Haversine distance in km
    distances = []
    for i in range(len(pred_denorm)):
        d = haversine_distance(
            pred_denorm[i, 0], pred_denorm[i, 1],
            target_denorm[i, 0], target_denorm[i, 1]
        )
        distances.append(d)
    
    distances = np.array(distances)
    results["distance_mae_km"] = distances.mean()
    results["distance_rmse_km"] = np.sqrt((distances**2).mean())
    results["distance_median_km"] = np.median(distances)
    
    print(f"    Distance MAE: {results['distance_mae_km']:.2f} km")
    print(f"    Distance Median: {results['distance_median_km']:.2f} km")
    
    # Percentage within X km
    for threshold in [1, 5, 10, 25, 50]:
        pct = (distances <= threshold).mean() * 100
        results[f"within_{threshold}km"] = pct
        print(f"    Within {threshold}km: {pct:.1f}%")
    
    # ==================
    # Confidence Calibration
    # ==================
    print("\n  Computing confidence calibration...")
    
    confidence_np = confidence.squeeze().numpy()
    results["mean_confidence"] = confidence_np.mean()
    results["std_confidence"] = confidence_np.std()
    
    # Calibration: bin by confidence, check accuracy in each bin
    pred_atm = atm_probs.argmax(dim=-1)
    correct = (pred_atm == target_atm_t).numpy()
    
    n_bins = 10
    bin_edges = np.linspace(0, 1, n_bins + 1)
    calibration_data = []
    
    for i in range(n_bins):
        mask = (confidence_np >= bin_edges[i]) & (confidence_np < bin_edges[i+1])
        if mask.sum() > 0:
            bin_acc = correct[mask].mean()
            bin_conf = confidence_np[mask].mean()
            calibration_data.append((bin_conf, bin_acc, mask.sum()))
    
    # Expected Calibration Error
    ece = 0
    total_samples = len(confidence_np)
    for conf, acc, count in calibration_data:
        ece += (count / total_samples) * abs(conf - acc)
    
    results["ece"] = ece
    print(f"    Mean Confidence: {results['mean_confidence']*100:.1f}%")
    print(f"    Expected Calibration Error: {ece:.4f}")
    
    return results


def benchmark_by_category(model, data, test_df, fraud_encoder, state_encoder):
    """Benchmark by fraud type and state."""
    (coords_t, hour_t, day_t, month_t, fraud_t, state_t, 
     target_atm_t, target_coords_t, _) = data
    
    # ==================
    # By Fraud Type
    # ==================
    print("\n" + "="*60)
    print("ACCURACY BY FRAUD TYPE")
    print("="*60)
    
    fraud_results = defaultdict(list)
    
    for i in range(len(fraud_t)):
        with torch.no_grad():
            output = model(
                coords_t[i:i+1], hour_t[i:i+1], day_t[i:i+1],
                month_t[i:i+1], fraud_t[i:i+1], state_t[i:i+1],
                mode="atm"
            )
        
        pred = output["atm_probs"].argmax(dim=-1).item()
        target = target_atm_t[i].item()
        fraud_idx = fraud_t[i].item()
        
        fraud_results[fraud_idx].append(pred == target)
    
    print(f"\n  {'Fraud Type':<25} {'Accuracy':>10} {'Samples':>10}")
    print("  " + "-"*47)
    
    fraud_types = fraud_encoder.classes_
    for idx, fraud_type in enumerate(fraud_types):
        if idx in fraud_results:
            acc = np.mean(fraud_results[idx]) * 100
            count = len(fraud_results[idx])
            print(f"  {fraud_type:<25} {acc:>9.1f}% {count:>10}")
    
    # ==================
    # By State
    # ==================
    print("\n" + "="*60)
    print("ACCURACY BY STATE")
    print("="*60)
    
    state_results = defaultdict(list)
    
    for i in range(len(state_t)):
        with torch.no_grad():
            output = model(
                coords_t[i:i+1], hour_t[i:i+1], day_t[i:i+1],
                month_t[i:i+1], fraud_t[i:i+1], state_t[i:i+1],
                mode="atm"
            )
        
        pred = output["atm_probs"].argmax(dim=-1).item()
        target = target_atm_t[i].item()
        state_idx = state_t[i].item()
        
        state_results[state_idx].append(pred == target)
    
    print(f"\n  {'State':<25} {'Accuracy':>10} {'Samples':>10}")
    print("  " + "-"*47)
    
    states = state_encoder.classes_
    for idx, state in enumerate(states):
        if idx in state_results:
            acc = np.mean(state_results[idx]) * 100
            count = len(state_results[idx])
            print(f"  {state:<25} {acc:>9.1f}% {count:>10}")


def print_summary(results, checkpoint):
    """Print final benchmark summary."""
    print("\n" + "="*60)
    print("BENCHMARK SUMMARY")
    print("="*60)
    
    print(f"""
  ┌────────────────────────────────────────────────────────┐
  │  CST TRANSFORMER MODEL PERFORMANCE                     │
  └────────────────────────────────────────────────────────┘
  
  📊 ATM PREDICTION ACCURACY
  ─────────────────────────────────────────────────────────
    Top-1 Accuracy:  {results.get('top1_accuracy', 0)*100:>6.2f}%  (Exact ATM match)
    Top-3 Accuracy:  {results.get('top3_accuracy', 0)*100:>6.2f}%  (Within top 3 predictions)
    Top-5 Accuracy:  {results.get('top5_accuracy', 0)*100:>6.2f}%  (Within top 5 predictions)
    Top-10 Accuracy: {results.get('top10_accuracy', 0)*100:>6.2f}%  (Within top 10 predictions)
  
  📍 COORDINATE PREDICTION (Backup)
  ─────────────────────────────────────────────────────────
    Mean Distance Error:    {results.get('distance_mae_km', 0):>6.2f} km
    Median Distance Error:  {results.get('distance_median_km', 0):>6.2f} km
    Within 5 km:            {results.get('within_5km', 0):>6.1f}%
    Within 10 km:           {results.get('within_10km', 0):>6.1f}%
    Within 25 km:           {results.get('within_25km', 0):>6.1f}%
  
  ⚡ PERFORMANCE
  ─────────────────────────────────────────────────────────
    Inference Time:     {results.get('inference_time_ms', 0):>6.2f} ms/sample
    Mean Confidence:    {results.get('mean_confidence', 0)*100:>6.1f}%
    Calibration Error:  {results.get('ece', 0):>6.4f}
  
  📈 TRAINING INFO
  ─────────────────────────────────────────────────────────
    Epoch:              {checkpoint.get('epoch', 'N/A')}
    Validation Accuracy:{checkpoint.get('val_atm_accuracy', 0)*100:>6.1f}%
    """)
    
    # Interpretation
    top1 = results.get('top1_accuracy', 0)
    top3 = results.get('top3_accuracy', 0)
    
    print("  📝 INTERPRETATION")
    print("  ─────────────────────────────────────────────────────────")
    
    if top1 > 0.5:
        print("    ✅ Excellent! Model predicts exact ATM correctly >50% of time")
    elif top1 > 0.3:
        print("    ✅ Good! Model shows meaningful ATM prediction capability")
    elif top1 > 0.1:
        print("    ⚠️  Moderate. Better than random (1/7000 = 0.01%)")
    else:
        print("    ⚠️  Model needs more training or data")
    
    if top3 > 0.7:
        print("    ✅ Excellent Top-3! Correct ATM usually in top 3 predictions")
    elif top3 > 0.5:
        print("    ✅ Good Top-3! Consider deploying teams to top 3 locations")
    
    print("""
  ─────────────────────────────────────────────────────────
  Note: This is trained on synthetic data. Production accuracy
  depends on real fraud→withdrawal data from NCRP.
  ─────────────────────────────────────────────────────────
    """)


def main():
    print("\n" + "="*60)
    print("CST TRANSFORMER - MODEL BENCHMARK")
    print("="*60)
    
    # Load model and data
    print("\n📂 Loading model and data...")
    try:
        model, fraud_encoder, state_encoder, coord_scaler, df, atm_df, checkpoint = load_model_and_data()
        print(f"  ✓ Model loaded")
        print(f"  ✓ Dataset: {len(df)} samples")
        print(f"  ✓ ATMs: {len(atm_df) if atm_df is not None else 'N/A'}")
    except FileNotFoundError as e:
        print(f"  ❌ {e}")
        print("  Train first: python scripts/train_cst_transformer.py --epochs 60")
        return
    
    # Prepare test data
    print("\n📊 Preparing test data...")
    data = prepare_test_data(df, fraud_encoder, state_encoder, coord_scaler)
    
    # Run main benchmark
    print("\n" + "="*60)
    print("RUNNING MAIN BENCHMARK")
    print("="*60)
    
    results = benchmark_model(model, data, coord_scaler, data[-1])
    
    # Benchmark by category (sample for speed)
    sample_size = min(2000, len(data[0]))
    sample_indices = np.random.choice(len(data[0]), sample_size, replace=False)
    
    sample_data = tuple(
        d[sample_indices] if isinstance(d, (torch.Tensor, np.ndarray)) else d
        for d in data[:-1]
    ) + (data[-1].iloc[sample_indices],)
    
    benchmark_by_category(model, sample_data, sample_data[-1], fraud_encoder, state_encoder)
    
    # Print summary
    print_summary(results, checkpoint)


if __name__ == "__main__":
    main()

