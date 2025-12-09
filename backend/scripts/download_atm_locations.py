"""
ATM Location Downloader - Fetches real ATM coordinates from OpenStreetMap.
Used for: ML training (location prediction) and database seeding (real ATM data).
"""

import time
import logging
import json
from pathlib import Path
from typing import List, Dict, Optional
from dataclasses import dataclass
from datetime import datetime

import requests
import pandas as pd

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# OpenStreetMap Overpass API - free, no API key needed
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
REQUEST_TIMEOUT = 120  # seconds
RATE_LIMIT_DELAY = 2   # seconds between requests to avoid API ban


@dataclass
class Region:
    """Geographic bounding box for a city/area. Format: (south, west, north, east)"""
    name: str
    state: str
    bbox: tuple


# All major Indian cities + fraud hotspots for comprehensive ATM coverage
INDIAN_REGIONS: List[Region] = [
    # === METRO CITIES (highest ATM density) ===
    Region("Mumbai", "Maharashtra", (18.87, 72.77, 19.27, 72.98)),
    Region("Delhi", "Delhi", (28.40, 76.84, 28.88, 77.35)),
    Region("Bangalore", "Karnataka", (12.83, 77.46, 13.14, 77.78)),
    Region("Hyderabad", "Telangana", (17.28, 78.27, 17.55, 78.62)),
    Region("Chennai", "Tamil Nadu", (12.90, 80.15, 13.25, 80.32)),
    Region("Kolkata", "West Bengal", (22.45, 88.25, 22.70, 88.50)),
    
    # === MAHARASHTRA ===
    Region("Pune", "Maharashtra", (18.43, 73.75, 18.62, 73.95)),
    Region("Nagpur", "Maharashtra", (21.08, 79.00, 21.20, 79.15)),
    Region("Thane", "Maharashtra", (19.15, 72.95, 19.30, 73.10)),
    Region("Nashik", "Maharashtra", (19.95, 73.75, 20.05, 73.85)),
    Region("Navi Mumbai", "Maharashtra", (19.00, 73.00, 19.12, 73.12)),
    
    # === GUJARAT ===
    Region("Ahmedabad", "Gujarat", (22.95, 72.50, 23.10, 72.68)),
    Region("Surat", "Gujarat", (21.15, 72.78, 21.25, 72.88)),
    Region("Vadodara", "Gujarat", (22.28, 73.15, 22.35, 73.22)),
    Region("Rajkot", "Gujarat", (22.28, 70.75, 22.35, 70.85)),
    
    # === RAJASTHAN ===
    Region("Jaipur", "Rajasthan", (26.82, 75.72, 26.98, 75.88)),
    Region("Jodhpur", "Rajasthan", (26.25, 73.00, 26.35, 73.10)),
    Region("Udaipur", "Rajasthan", (24.55, 73.68, 24.62, 73.75)),
    Region("Bharatpur", "Rajasthan", (27.20, 77.48, 27.25, 77.53)),
    Region("Alwar", "Rajasthan", (27.53, 76.60, 27.58, 76.65)),
    
    # === UTTAR PRADESH ===
    Region("Lucknow", "Uttar Pradesh", (26.78, 80.88, 26.95, 81.05)),
    Region("Kanpur", "Uttar Pradesh", (26.42, 80.30, 26.52, 80.40)),
    Region("Varanasi", "Uttar Pradesh", (25.28, 82.95, 25.38, 83.05)),
    Region("Agra", "Uttar Pradesh", (27.15, 77.95, 27.22, 78.05)),
    Region("Noida", "Uttar Pradesh", (28.52, 77.32, 28.62, 77.42)),
    Region("Ghaziabad", "Uttar Pradesh", (28.65, 77.40, 28.72, 77.48)),
    Region("Mathura", "Uttar Pradesh", (27.48, 77.67, 27.52, 77.70)),
    Region("Meerut", "Uttar Pradesh", (28.98, 77.70, 29.02, 77.74)),
    
    # === MADHYA PRADESH ===
    Region("Indore", "Madhya Pradesh", (22.68, 75.82, 22.78, 75.92)),
    Region("Bhopal", "Madhya Pradesh", (23.22, 77.38, 23.30, 77.46)),
    Region("Gwalior", "Madhya Pradesh", (26.20, 78.15, 26.25, 78.22)),
    
    # === TAMIL NADU ===
    Region("Coimbatore", "Tamil Nadu", (11.00, 76.92, 11.08, 77.02)),
    Region("Madurai", "Tamil Nadu", (9.90, 78.10, 9.98, 78.18)),
    Region("Salem", "Tamil Nadu", (11.65, 78.12, 11.70, 78.18)),
    
    # === KARNATAKA ===
    Region("Mysore", "Karnataka", (12.28, 76.62, 12.35, 76.70)),
    Region("Mangalore", "Karnataka", (12.85, 74.82, 12.92, 74.90)),
    Region("Hubli-Dharwad", "Karnataka", (15.32, 75.08, 15.40, 75.15)),
    
    # === KERALA ===
    Region("Kochi", "Kerala", (9.95, 76.25, 10.02, 76.32)),
    Region("Thiruvananthapuram", "Kerala", (8.48, 76.92, 8.55, 77.00)),
    Region("Kozhikode", "Kerala", (11.23, 75.75, 11.28, 75.82)),
    
    # === WEST BENGAL ===
    Region("Howrah", "West Bengal", (22.55, 88.28, 22.62, 88.35)),
    Region("Durgapur", "West Bengal", (23.48, 87.28, 23.55, 87.35)),
    Region("Siliguri", "West Bengal", (26.70, 88.40, 26.75, 88.45)),
    
    # === ANDHRA PRADESH ===
    Region("Visakhapatnam", "Andhra Pradesh", (17.68, 83.20, 17.75, 83.30)),
    Region("Vijayawada", "Andhra Pradesh", (16.50, 80.62, 16.55, 80.68)),
    Region("Tirupati", "Andhra Pradesh", (13.62, 79.40, 13.68, 79.45)),
    
    # === TELANGANA ===
    Region("Warangal", "Telangana", (17.95, 79.58, 18.02, 79.65)),
    Region("Karimnagar", "Telangana", (18.42, 79.12, 18.48, 79.18)),
    
    # === ODISHA ===
    Region("Bhubaneswar", "Odisha", (20.25, 85.80, 20.32, 85.88)),
    Region("Cuttack", "Odisha", (20.45, 85.88, 20.50, 85.92)),
    
    # === PUNJAB ===
    Region("Ludhiana", "Punjab", (30.88, 75.82, 30.95, 75.90)),
    Region("Amritsar", "Punjab", (31.62, 74.85, 31.68, 74.92)),
    Region("Jalandhar", "Punjab", (31.32, 75.55, 31.38, 75.62)),
    
    # === HARYANA ===
    Region("Gurgaon", "Haryana", (28.42, 77.00, 28.52, 77.10)),
    Region("Faridabad", "Haryana", (28.38, 77.28, 28.45, 77.35)),
    Region("Mewat", "Haryana", (28.00, 76.90, 28.10, 77.00)),
    
    # === BIHAR ===
    Region("Patna", "Bihar", (25.58, 85.08, 25.65, 85.18)),
    Region("Gaya", "Bihar", (24.78, 84.98, 24.82, 85.02)),
    
    # === JHARKHAND (CRITICAL: Known fraud hotspots) ===
    Region("Ranchi", "Jharkhand", (23.35, 85.30, 23.42, 85.38)),
    Region("Jamshedpur", "Jharkhand", (22.78, 86.18, 22.85, 86.25)),
    Region("Dhanbad", "Jharkhand", (23.78, 86.42, 23.82, 86.48)),
    Region("Jamtara", "Jharkhand", (23.95, 86.78, 24.00, 86.85)),  # Famous fraud hub
    Region("Deoghar", "Jharkhand", (24.48, 86.68, 24.52, 86.72)),
    Region("Giridih", "Jharkhand", (24.18, 86.28, 24.22, 86.32)),
    Region("Dumka", "Jharkhand", (24.26, 87.24, 24.30, 87.28)),
    
    # === OTHER STATES ===
    Region("Guwahati", "Assam", (26.15, 91.70, 26.22, 91.80)),
    Region("Raipur", "Chhattisgarh", (21.22, 81.62, 21.28, 81.68)),
    Region("Dehradun", "Uttarakhand", (30.30, 78.00, 30.38, 78.08)),
    Region("Shimla", "Himachal Pradesh", (31.08, 77.15, 31.12, 77.20)),
    Region("Panaji", "Goa", (15.48, 73.80, 15.52, 73.85)),
    Region("Chandigarh", "Chandigarh", (30.70, 76.75, 30.78, 76.82)),
    Region("Srinagar", "Jammu & Kashmir", (34.08, 74.78, 34.12, 74.82)),
    Region("Jammu", "Jammu & Kashmir", (32.72, 74.85, 32.78, 74.90)),
]


def build_overpass_query(bbox: tuple) -> str:
    """
    Builds Overpass QL query to fetch ATMs within bounding box.
    Searches both standalone ATMs and bank branches with ATMs.
    """
    south, west, north, east = bbox
    return f"""
[out:json][timeout:{REQUEST_TIMEOUT}];
(
    node["amenity"="atm"]({south},{west},{north},{east});
    node["amenity"="bank"]["atm"="yes"]({south},{west},{north},{east});
    way["amenity"="atm"]({south},{west},{north},{east});
    way["amenity"="bank"]["atm"="yes"]({south},{west},{north},{east});
);
out center body;
"""


def parse_osm_element(element: Dict, city: str, state: str) -> Optional[Dict]:
    """
    Converts OSM JSON element to ATM record.
    Handles both 'node' (point) and 'way' (polygon) elements.
    """
    tags = element.get("tags", {})
    
    # Get coordinates - nodes have lat/lon directly, ways have center point
    if element["type"] == "node":
        lat, lon = element.get("lat"), element.get("lon")
    else:
        center = element.get("center", {})
        lat, lon = center.get("lat"), center.get("lon")
    
    if not lat or not lon:
        return None
    
    # Extract bank name from multiple possible tags
    bank_name = tags.get("operator") or tags.get("brand") or tags.get("name") or "Unknown"
    
    return {
        "osm_id": element.get("id"),
        "osm_type": element.get("type"),
        "latitude": round(lat, 7),
        "longitude": round(lon, 7),
        "name": tags.get("name", f"{bank_name} ATM")[:255],
        "bank_name": bank_name[:100],
        "brand": tags.get("brand"),
        "operator": tags.get("operator"),
        "network": tags.get("network"),
        "city": city,
        "state": state,
        "address": (tags.get("addr:full") or tags.get("addr:street") or "")[:500],
        "postcode": tags.get("addr:postcode"),
        "amenity_type": tags.get("amenity"),
    }


def fetch_atms_for_region(region: Region, session: requests.Session) -> List[Dict]:
    """
    Fetches ATMs for one region from Overpass API.
    Returns empty list on error (doesn't crash entire download).
    """
    query = build_overpass_query(region.bbox)
    
    try:
        response = session.post(OVERPASS_URL, data={"data": query}, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        
        data = response.json()
        elements = data.get("elements", [])
        
        # Parse each element into ATM record
        atms = []
        for elem in elements:
            atm = parse_osm_element(elem, region.name, region.state)
            if atm:
                atms.append(atm)
        
        return atms
        
    except requests.exceptions.Timeout:
        logger.warning(f"Timeout for {region.name} - skipping")
        return []
    except requests.exceptions.RequestException as e:
        logger.error(f"Request failed for {region.name}: {e}")
        return []
    except ValueError as e:
        logger.error(f"Invalid JSON from {region.name}: {e}")
        return []


def download_all_atms() -> pd.DataFrame:
    """
    Main download function - fetches ATMs from all regions.
    Takes ~5 minutes due to rate limiting (2 sec delay per request).
    """
    all_atms = []
    total = len(INDIAN_REGIONS)
    
    # Reuse session for connection pooling
    session = requests.Session()
    session.headers.update({"User-Agent": "AEGIS-DataCollector/1.0"})
    
    logger.info(f"Downloading ATMs from {total} regions...")
    
    for idx, region in enumerate(INDIAN_REGIONS, 1):
        logger.info(f"[{idx}/{total}] {region.name}, {region.state}...")
        
        atms = fetch_atms_for_region(region, session)
        
        if atms:
            all_atms.extend(atms)
            logger.info(f"    Found {len(atms)} ATMs")
        else:
            logger.warning(f"    No ATMs found")
        
        # Rate limiting - be nice to free API
        if idx < total:
            time.sleep(RATE_LIMIT_DELAY)
    
    if not all_atms:
        logger.error("No ATMs collected! Check internet connection.")
        return pd.DataFrame()
    
    # Create DataFrame and deduplicate
    df = pd.DataFrame(all_atms)
    before = len(df)
    df = df.drop_duplicates(subset=["osm_id"], keep="first")
    logger.info(f"Removed {before - len(df)} duplicates")
    
    return df


def save_data(df: pd.DataFrame, output_dir: Path) -> Dict[str, Path]:
    """
    Saves ATM data in multiple formats.
    Parquet for ML (fast loading), CSV for inspection, JSON metadata.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    
    paths = {}
    
    # CSV - human readable, can open in Excel
    csv_path = output_dir / "india_atm_locations.csv"
    df.to_csv(csv_path, index=False)
    paths["csv"] = csv_path
    
    # Parquet - efficient for Python/pandas (10x smaller, 5x faster)
    parquet_path = output_dir / "india_atm_locations.parquet"
    df.to_parquet(parquet_path, index=False)
    paths["parquet"] = parquet_path
    
    # Metadata - summary for documentation
    metadata = {
        "source": "OpenStreetMap Overpass API",
        "collected_at": datetime.utcnow().isoformat(),
        "total_atms": len(df),
        "regions_covered": len(INDIAN_REGIONS),
        "states_covered": df["state"].nunique(),
        "cities_covered": df["city"].nunique(),
        "banks_found": df["bank_name"].nunique(),
    }
    
    meta_path = output_dir / "atm_metadata.json"
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)
    paths["metadata"] = meta_path
    
    return paths


def print_statistics(df: pd.DataFrame):
    """Prints summary statistics for visual verification."""
    print("\n" + "=" * 60)
    print("ATM DATA SUMMARY")
    print("=" * 60)
    
    print(f"\nTotal: {len(df):,} ATMs")
    print(f"States: {df['state'].nunique()} | Cities: {df['city'].nunique()} | Banks: {df['bank_name'].nunique()}")
    
    print("\n--- By State (Top 10) ---")
    for state, count in df["state"].value_counts().head(10).items():
        print(f"  {state:25s} {count:5,}")
    
    print("\n--- By City (Top 10) ---")
    for city, count in df["city"].value_counts().head(10).items():
        print(f"  {city:25s} {count:5,}")
    
    print("\n--- By Bank (Top 10) ---")
    for bank, count in df["bank_name"].value_counts().head(10).items():
        print(f"  {bank:25s} {count:5,}")
    
    # Jharkhand breakdown - important for fraud hotspot analysis
    jharkhand = df[df["state"] == "Jharkhand"]
    if not jharkhand.empty:
        print("\n--- Jharkhand (Fraud Hotspots) ---")
        for city, count in jharkhand["city"].value_counts().items():
            print(f"  {city:25s} {count:5,}")


def main():
    """
    Entry point - downloads all ATMs and saves to data/processed/.
    Run time: ~5 minutes (rate limited API calls).
    """
    print("=" * 60)
    print("AEGIS ATM Location Downloader")
    print("Source: OpenStreetMap (Real Data)")
    print("=" * 60)
    
    output_dir = Path(__file__).parent.parent / "data" / "processed"
    
    print(f"\nFetching from {len(INDIAN_REGIONS)} regions...")
    print("This takes ~5 minutes due to API rate limiting.\n")
    
    df = download_all_atms()
    
    if df.empty:
        print("\n❌ Download failed - check internet connection")
        return
    
    print_statistics(df)
    
    print("\n--- Saving Files ---")
    paths = save_data(df, output_dir)
    for fmt, path in paths.items():
        print(f"  {fmt}: {path}")
    
    print("\n" + "=" * 60)
    print("✅ ATM data download complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
