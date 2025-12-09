"""
Kaggle Dataset Downloader - Fetches datasets for AEGIS ML model training.
Uses KAGGLE_USERNAME and KAGGLE_KEY from .env file.
"""

import os
import logging
from pathlib import Path
from typing import Dict

import pandas as pd
import numpy as np
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent.parent
DATA_RAW_DIR = PROJECT_ROOT / "data" / "raw"
DATA_PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"

# Load environment variables from .env file
load_dotenv(PROJECT_ROOT / ".env")


# === DATASETS FOR AEGIS MODELS ===
KAGGLE_DATASETS = {
    # ============================================
    # FOR CST TRANSFORMER (Location Prediction)
    # ============================================
    
    # Chicago Crime Data - 7M+ crimes with lat/lon and timestamps
    # Perfect for learning spatio-temporal patterns
    "chicago_crimes": {
        "dataset": "currie32/crimes-in-chicago",
        "description": "Chicago crimes 2001-2017 with location & time. For CST Transformer training.",
    },
    
    # LA Crime Data - Modern crime data with precise locations
    "la_crimes": {
        "dataset": "chaitanyakck/crime-data-from-2020-to-present",
        "description": "LA crimes 2020-present with lat/lon. For location prediction.",
    },
    
    # ============================================
    # FOR GNN (Mule Account Detection)
    # ============================================
    
    # PaySim - Simulated mobile money transactions
    # TRANSFER → CASH_OUT patterns = mule behavior
    "paysim": {
        "dataset": "ealaxi/paysim1",
        "description": "6M+ mobile money transactions. TRANSFER->CASH_OUT = mule patterns.",
    },
    
    # ============================================
    # FOR ANOMALY DETECTION (Baseline)
    # ============================================
    
    # Credit Card Fraud - Classic fraud detection dataset
    "credit_card_fraud": {
        "dataset": "mlg-ulb/creditcardfraud",
        "description": "284K transactions, 492 frauds. For anomaly detection baseline.",
    },
    
    # IEEE Fraud Detection - Rich features
    "ieee_fraud": {
        "dataset": "ieee-computational-intelligence-society/ieee-fraud-detection",
        "description": "590K transactions with device/card features.",
    },
}


def check_kaggle_setup() -> bool:
    """Verifies Kaggle API credentials from environment variables."""
    username = os.environ.get("KAGGLE_USERNAME")
    key = os.environ.get("KAGGLE_KEY")
    
    if not username or not key:
        logger.error("KAGGLE_USERNAME or KAGGLE_KEY not found in .env file")
        return False
    
    logger.info(f"✓ Kaggle credentials loaded for user: {username}")
    
    try:
        import kaggle
        kaggle.api.authenticate()
        logger.info("✓ Kaggle API authenticated successfully")
        return True
    except Exception as e:
        logger.error(f"Kaggle authentication failed: {e}")
        return False


def download_dataset(name: str, info: dict) -> bool:
    """Downloads a single dataset from Kaggle."""
    import kaggle
    
    output_path = DATA_RAW_DIR / name
    output_path.mkdir(parents=True, exist_ok=True)
    
    logger.info(f"Downloading {name}...")
    logger.info(f"  Source: kaggle.com/datasets/{info['dataset']}")
    
    try:
        kaggle.api.dataset_download_files(
            info["dataset"],
            path=str(output_path),
            unzip=True
        )
        logger.info(f"  ✓ Downloaded to {output_path}")
        return True
    except Exception as e:
        logger.error(f"  ✗ Failed: {e}")
        return False


def download_all() -> Dict[str, bool]:
    """Downloads all configured datasets."""
    if not check_kaggle_setup():
        return {}
    
    DATA_RAW_DIR.mkdir(parents=True, exist_ok=True)
    
    results = {}
    total = len(KAGGLE_DATASETS)
    
    for idx, (name, info) in enumerate(KAGGLE_DATASETS.items(), 1):
        logger.info(f"\n[{idx}/{total}] {info['description'][:60]}...")
        results[name] = download_dataset(name, info)
    
    return results


def process_chicago_crimes() -> pd.DataFrame:
    """Processes Chicago crime data for CST Transformer training."""
    raw_dir = DATA_RAW_DIR / "chicago_crimes"
    
    # Chicago dataset has multiple CSV files
    csv_files = list(raw_dir.glob("*.csv"))
    if not csv_files:
        logger.warning("Chicago crimes data not found")
        return pd.DataFrame()
    
    logger.info("Processing Chicago crimes data...")
    
    dfs = []
    for f in csv_files:
        try:
            df = pd.read_csv(f, low_memory=False)
            dfs.append(df)
        except Exception as e:
            logger.warning(f"Could not read {f}: {e}")
    
    if not dfs:
        return pd.DataFrame()
    
    df = pd.concat(dfs, ignore_index=True)
    
    # Keep only rows with valid coordinates
    df = df.dropna(subset=["Latitude", "Longitude"])
    
    # Rename columns for consistency
    df = df.rename(columns={
        "Latitude": "latitude",
        "Longitude": "longitude",
        "Date": "timestamp",
        "Primary Type": "crime_type",
        "Location Description": "location_type",
    })
    
    # Parse timestamp
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df = df.dropna(subset=["timestamp"])
    
    # Extract time features
    df["hour"] = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.dayofweek
    df["month"] = df["timestamp"].dt.month
    
    # Keep relevant columns
    columns = ["latitude", "longitude", "timestamp", "hour", "day_of_week", 
               "month", "crime_type", "location_type"]
    df = df[[c for c in columns if c in df.columns]]
    
    logger.info(f"  Processed {len(df):,} crime records")
    return df


def process_la_crimes() -> pd.DataFrame:
    """Processes LA crime data for CST Transformer training."""
    raw_dir = DATA_RAW_DIR / "la_crimes"
    
    csv_files = list(raw_dir.glob("*.csv"))
    if not csv_files:
        logger.warning("LA crimes data not found")
        return pd.DataFrame()
    
    logger.info("Processing LA crimes data...")
    
    df = pd.read_csv(csv_files[0], low_memory=False)
    
    # LA data has LAT and LON columns
    lat_col = [c for c in df.columns if "lat" in c.lower()]
    lon_col = [c for c in df.columns if "lon" in c.lower()]
    
    if lat_col and lon_col:
        df = df.rename(columns={lat_col[0]: "latitude", lon_col[0]: "longitude"})
    
    df = df.dropna(subset=["latitude", "longitude"])
    
    # Find date column
    date_cols = [c for c in df.columns if "date" in c.lower() or "occ" in c.lower()]
    if date_cols:
        df["timestamp"] = pd.to_datetime(df[date_cols[0]], errors="coerce")
        df = df.dropna(subset=["timestamp"])
        df["hour"] = df["timestamp"].dt.hour
        df["day_of_week"] = df["timestamp"].dt.dayofweek
    
    logger.info(f"  Processed {len(df):,} crime records")
    return df


def process_paysim() -> pd.DataFrame:
    """Processes PaySim data for GNN mule detection training."""
    raw_dir = DATA_RAW_DIR / "paysim"
    
    csv_files = list(raw_dir.glob("*.csv"))
    if not csv_files:
        logger.warning("PaySim data not found")
        return pd.DataFrame()
    
    logger.info("Processing PaySim data...")
    
    df = pd.read_csv(csv_files[0])
    
    # Focus on TRANSFER and CASH_OUT (mule patterns)
    df = df[df["type"].isin(["TRANSFER", "CASH_OUT"])]
    
    # Create features for GNN
    df["amount_log"] = np.log1p(df["amount"])
    df["balance_diff_orig"] = df["oldbalanceOrg"] - df["newbalanceOrig"]
    df["balance_diff_dest"] = df["newbalanceDest"] - df["oldbalanceDest"]
    
    logger.info(f"  Processed {len(df):,} transfer/cashout transactions")
    logger.info(f"  Fraud cases: {df['isFraud'].sum():,}")
    return df


def process_credit_card_fraud() -> pd.DataFrame:
    """Processes credit card fraud data for anomaly detection."""
    raw_dir = DATA_RAW_DIR / "credit_card_fraud"
    
    csv_file = raw_dir / "creditcard.csv"
    if not csv_file.exists():
        logger.warning("Credit card fraud data not found")
        return pd.DataFrame()
    
    logger.info("Processing credit card fraud data...")
    
    df = pd.read_csv(csv_file)
    
    # Add derived features
    df["hour"] = (df["Time"] / 3600) % 24
    df["amount_log"] = np.log1p(df["Amount"])
    
    logger.info(f"  Processed {len(df):,} transactions")
    logger.info(f"  Fraud cases: {df['Class'].sum():,}")
    return df


def prepare_all_datasets():
    """Processes all downloaded datasets and saves to processed folder."""
    DATA_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    
    logger.info("\n" + "=" * 60)
    logger.info("Processing downloaded datasets...")
    logger.info("=" * 60)
    
    # Process each dataset
    datasets = {}
    
    # Chicago crimes (for CST)
    df = process_chicago_crimes()
    if not df.empty:
        path = DATA_PROCESSED_DIR / "chicago_crimes_processed.parquet"
        df.to_parquet(path, index=False)
        datasets["chicago_crimes"] = len(df)
        logger.info(f"  Saved: {path}")
    
    # LA crimes (for CST)
    df = process_la_crimes()
    if not df.empty:
        path = DATA_PROCESSED_DIR / "la_crimes_processed.parquet"
        df.to_parquet(path, index=False)
        datasets["la_crimes"] = len(df)
        logger.info(f"  Saved: {path}")
    
    # PaySim (for GNN)
    df = process_paysim()
    if not df.empty:
        path = DATA_PROCESSED_DIR / "paysim_processed.parquet"
        df.to_parquet(path, index=False)
        datasets["paysim"] = len(df)
        logger.info(f"  Saved: {path}")
    
    # Credit card fraud (for anomaly detection)
    df = process_credit_card_fraud()
    if not df.empty:
        path = DATA_PROCESSED_DIR / "credit_card_fraud_processed.parquet"
        df.to_parquet(path, index=False)
        datasets["credit_card_fraud"] = len(df)
        logger.info(f"  Saved: {path}")
    
    return datasets


def main():
    """Main entry point - downloads and processes all datasets."""
    print("=" * 70)
    print("AEGIS Kaggle Dataset Downloader")
    print("=" * 70)
    
    print("\nDatasets to download:")
    print("-" * 70)
    for name, info in KAGGLE_DATASETS.items():
        print(f"  • {name}: {info['description']}")
    print("-" * 70)
    
    print("\nStep 1: Downloading from Kaggle...")
    results = download_all()
    
    if not results:
        print("\n❌ Download failed - check Kaggle credentials")
        return
    
    success = sum(1 for v in results.values() if v)
    print(f"\n✓ Downloaded {success}/{len(results)} datasets")
    
    print("\nStep 2: Processing datasets...")
    processed = prepare_all_datasets()
    
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print("\nProcessed datasets:")
    for name, count in processed.items():
        print(f"  • {name}: {count:,} records")
    
    print(f"\nFiles saved to: {DATA_PROCESSED_DIR}")
    print("\n" + "=" * 70)
    print("✅ Dataset download and processing complete!")
    print("=" * 70)
    print("\nNext: Train CST Transformer using chicago_crimes_processed.parquet")


if __name__ == "__main__":
    main()
