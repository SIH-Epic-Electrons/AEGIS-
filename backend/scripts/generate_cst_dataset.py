"""
Comprehensive CST Dataset Generator.

Creates detailed training data for dual-mode CST Transformer:
1. ATM Mode: Victim location → Withdrawal ATM prediction
2. Area Mode: No victim location → General area prediction

Features:
- 150,000 records for robust training
- 100+ victim locations across 15 Indian states
- 9 fraud types with realistic withdrawal patterns
- Time-based patterns (hour/day/month affects behavior)
- Amount-based distance patterns
"""

import sys
from pathlib import Path
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
from typing import Dict, List, Any, Tuple
from tqdm import tqdm

# ============================================================================
# FRAUD TYPES WITH DETAILED PATTERNS
# ============================================================================
# Each fraud type has: (min_km, max_km, peak_hours, weekend_multiplier)
# - Distance range where fraudsters typically withdraw
# - Peak hours when this fraud type is most active
# - Weekend behavior (1.0 = same, >1 = more on weekends)

FRAUD_PATTERNS = {
    "OTP_PHISHING": {
        "distance": (1, 12),           # Very nearby - quick withdrawal
        "peak_hours": [10, 11, 14, 15, 19, 20],  # Office hours + evening
        "weekend_mult": 0.7,           # Less on weekends
        "amount_range": (5000, 100000),
    },
    "INVESTMENT_SCAM": {
        "distance": (5, 35),           # Medium - planned withdrawal
        "peak_hours": [9, 10, 11, 14, 15, 16],  # Business hours
        "weekend_mult": 0.5,           # Much less on weekends
        "amount_range": (50000, 500000),
    },
    "JOB_SCAM": {
        "distance": (8, 45),           # Far - different city area
        "peak_hours": [10, 11, 12, 14, 15],  # Morning/afternoon
        "weekend_mult": 0.6,
        "amount_range": (10000, 200000),
    },
    "KYC_UPDATE_FRAUD": {
        "distance": (1, 8),            # Very close - immediate withdrawal
        "peak_hours": [10, 11, 12, 15, 16, 17],  # Bank hours
        "weekend_mult": 0.3,           # Very less on weekends
        "amount_range": (10000, 150000),
    },
    "LOAN_APP_FRAUD": {
        "distance": (3, 25),           # Medium
        "peak_hours": [9, 10, 18, 19, 20, 21],  # Morning + evening
        "weekend_mult": 1.2,           # More on weekends
        "amount_range": (5000, 100000),
    },
    "LOTTERY_SCAM": {
        "distance": (15, 70),          # Far - often interstate
        "peak_hours": [11, 12, 14, 15, 16, 17],
        "weekend_mult": 1.0,
        "amount_range": (20000, 300000),
    },
    "ROMANCE_SCAM": {
        "distance": (25, 120),         # Very far - different city/state
        "peak_hours": [20, 21, 22, 23, 10, 11],  # Late night + morning
        "weekend_mult": 1.5,           # More on weekends
        "amount_range": (50000, 1000000),
    },
    "TECH_SUPPORT_SCAM": {
        "distance": (5, 30),           # Medium
        "peak_hours": [9, 10, 11, 14, 15, 16],  # Office hours
        "weekend_mult": 0.4,           # Less on weekends
        "amount_range": (10000, 200000),
    },
    "CUSTOMS_FRAUD": {
        "distance": (20, 90),          # Far - often near ports/borders
        "peak_hours": [10, 11, 14, 15, 16],
        "weekend_mult": 0.5,
        "amount_range": (100000, 500000),
    },
}

# ============================================================================
# COMPREHENSIVE INDIAN VICTIM LOCATIONS (100+)
# ============================================================================
# Format: (area_name, lat, lon, pincode, state, city_type)
# city_type: metro, tier1, tier2, tier3

VICTIM_LOCATIONS = [
    # KARNATAKA (15 locations)
    ("Laggere, Bangalore", 13.0358, 77.5194, "560058", "Karnataka", "metro"),
    ("HSR Layout, Bangalore", 12.9081, 77.6476, "560102", "Karnataka", "metro"),
    ("Whitefield, Bangalore", 12.9698, 77.7500, "560066", "Karnataka", "metro"),
    ("Jayanagar, Bangalore", 12.9250, 77.5938, "560041", "Karnataka", "metro"),
    ("Koramangala, Bangalore", 12.9352, 77.6245, "560034", "Karnataka", "metro"),
    ("Electronic City, Bangalore", 12.8399, 77.6770, "560100", "Karnataka", "metro"),
    ("Marathahalli, Bangalore", 12.9591, 77.6974, "560037", "Karnataka", "metro"),
    ("Indiranagar, Bangalore", 12.9784, 77.6408, "560038", "Karnataka", "metro"),
    ("BTM Layout, Bangalore", 12.9166, 77.6101, "560076", "Karnataka", "metro"),
    ("Hebbal, Bangalore", 13.0358, 77.5970, "560024", "Karnataka", "metro"),
    ("Yelahanka, Bangalore", 13.1007, 77.5963, "560064", "Karnataka", "metro"),
    ("Banashankari, Bangalore", 12.9255, 77.5468, "560070", "Karnataka", "metro"),
    ("Mysore City", 12.2958, 76.6394, "570001", "Karnataka", "tier1"),
    ("Hubli", 15.3647, 75.1240, "580020", "Karnataka", "tier2"),
    ("Mangalore", 12.9141, 74.8560, "575001", "Karnataka", "tier2"),
    
    # MAHARASHTRA (18 locations)
    ("Andheri, Mumbai", 19.1136, 72.8697, "400058", "Maharashtra", "metro"),
    ("Bandra, Mumbai", 19.0596, 72.8295, "400050", "Maharashtra", "metro"),
    ("Dadar, Mumbai", 19.0178, 72.8478, "400014", "Maharashtra", "metro"),
    ("Borivali, Mumbai", 19.2307, 72.8567, "400092", "Maharashtra", "metro"),
    ("Thane, Mumbai", 19.2183, 72.9781, "400601", "Maharashtra", "metro"),
    ("Navi Mumbai", 19.0330, 73.0297, "400703", "Maharashtra", "metro"),
    ("Powai, Mumbai", 19.1176, 72.9060, "400076", "Maharashtra", "metro"),
    ("Malad, Mumbai", 19.1874, 72.8484, "400064", "Maharashtra", "metro"),
    ("Goregaon, Mumbai", 19.1663, 72.8526, "400063", "Maharashtra", "metro"),
    ("Kurla, Mumbai", 19.0726, 72.8845, "400070", "Maharashtra", "metro"),
    ("Kothrud, Pune", 18.5074, 73.8077, "411038", "Maharashtra", "tier1"),
    ("Hinjewadi, Pune", 18.5912, 73.7380, "411057", "Maharashtra", "tier1"),
    ("Hadapsar, Pune", 18.5089, 73.9260, "411028", "Maharashtra", "tier1"),
    ("Viman Nagar, Pune", 18.5679, 73.9143, "411014", "Maharashtra", "tier1"),
    ("Wakad, Pune", 18.5989, 73.7603, "411057", "Maharashtra", "tier1"),
    ("Nagpur", 21.1458, 79.0882, "440001", "Maharashtra", "tier1"),
    ("Nashik", 19.9975, 73.7898, "422001", "Maharashtra", "tier2"),
    ("Aurangabad", 19.8762, 75.3433, "431001", "Maharashtra", "tier2"),
    
    # DELHI NCR (15 locations)
    ("Connaught Place, Delhi", 28.6315, 77.2167, "110001", "Delhi", "metro"),
    ("Dwarka, Delhi", 28.5921, 77.0460, "110075", "Delhi", "metro"),
    ("Rohini, Delhi", 28.7495, 77.0565, "110085", "Delhi", "metro"),
    ("Saket, Delhi", 28.5244, 77.2066, "110017", "Delhi", "metro"),
    ("Janakpuri, Delhi", 28.6219, 77.0878, "110058", "Delhi", "metro"),
    ("Pitampura, Delhi", 28.7041, 77.1025, "110034", "Delhi", "metro"),
    ("Lajpat Nagar, Delhi", 28.5700, 77.2400, "110024", "Delhi", "metro"),
    ("Karol Bagh, Delhi", 28.6514, 77.1907, "110005", "Delhi", "metro"),
    ("Noida Sector 62", 28.6270, 77.3634, "201301", "Delhi", "metro"),
    ("Noida Sector 18", 28.5700, 77.3200, "201301", "Delhi", "metro"),
    ("Greater Noida", 28.4744, 77.5030, "201310", "Delhi", "metro"),
    ("Gurgaon Cyber City", 28.4595, 77.0266, "122001", "Delhi", "metro"),
    ("Gurgaon Sohna Road", 28.4089, 77.0437, "122018", "Delhi", "metro"),
    ("Faridabad", 28.4089, 77.3178, "121001", "Delhi", "tier1"),
    ("Ghaziabad", 28.6692, 77.4538, "201001", "Delhi", "tier1"),
    
    # TAMIL NADU (12 locations)
    ("T Nagar, Chennai", 13.0418, 80.2341, "600017", "Tamil Nadu", "metro"),
    ("Anna Nagar, Chennai", 13.0850, 80.2101, "600040", "Tamil Nadu", "metro"),
    ("Velachery, Chennai", 12.9815, 80.2180, "600042", "Tamil Nadu", "metro"),
    ("OMR, Chennai", 12.9081, 80.2270, "600119", "Tamil Nadu", "metro"),
    ("Adyar, Chennai", 13.0067, 80.2572, "600020", "Tamil Nadu", "metro"),
    ("Tambaram, Chennai", 12.9249, 80.1000, "600045", "Tamil Nadu", "metro"),
    ("Porur, Chennai", 13.0382, 80.1565, "600116", "Tamil Nadu", "metro"),
    ("Guindy, Chennai", 13.0108, 80.2137, "600032", "Tamil Nadu", "metro"),
    ("Coimbatore", 11.0168, 76.9558, "641001", "Tamil Nadu", "tier1"),
    ("Madurai", 9.9252, 78.1198, "625001", "Tamil Nadu", "tier1"),
    ("Trichy", 10.7905, 78.7047, "620001", "Tamil Nadu", "tier2"),
    ("Salem", 11.6643, 78.1460, "636001", "Tamil Nadu", "tier2"),
    
    # TELANGANA (10 locations)
    ("Hitech City, Hyderabad", 17.4435, 78.3772, "500081", "Telangana", "metro"),
    ("Gachibowli, Hyderabad", 17.4401, 78.3489, "500032", "Telangana", "metro"),
    ("Banjara Hills, Hyderabad", 17.4156, 78.4347, "500034", "Telangana", "metro"),
    ("Kukatpally, Hyderabad", 17.4947, 78.3996, "500072", "Telangana", "metro"),
    ("Secunderabad", 17.4399, 78.4983, "500003", "Telangana", "metro"),
    ("Ameerpet, Hyderabad", 17.4375, 78.4483, "500016", "Telangana", "metro"),
    ("Madhapur, Hyderabad", 17.4483, 78.3915, "500081", "Telangana", "metro"),
    ("LB Nagar, Hyderabad", 17.3457, 78.5522, "500074", "Telangana", "metro"),
    ("Uppal, Hyderabad", 17.4065, 78.5593, "500039", "Telangana", "metro"),
    ("Warangal", 17.9784, 79.5941, "506001", "Telangana", "tier2"),
    
    # GUJARAT (10 locations)
    ("SG Highway, Ahmedabad", 23.0469, 72.5170, "380054", "Gujarat", "metro"),
    ("CG Road, Ahmedabad", 23.0225, 72.5714, "380006", "Gujarat", "metro"),
    ("Satellite, Ahmedabad", 23.0145, 72.5182, "380015", "Gujarat", "metro"),
    ("Prahlad Nagar, Ahmedabad", 23.0120, 72.5089, "380015", "Gujarat", "metro"),
    ("Vastrapur, Ahmedabad", 23.0401, 72.5297, "380015", "Gujarat", "metro"),
    ("Surat Ring Road", 21.1702, 72.8311, "395002", "Gujarat", "tier1"),
    ("Surat Adajan", 21.1959, 72.7933, "395009", "Gujarat", "tier1"),
    ("Vadodara Alkapuri", 22.3072, 73.1812, "390007", "Gujarat", "tier1"),
    ("Rajkot", 22.3039, 70.8022, "360001", "Gujarat", "tier2"),
    ("Gandhinagar", 23.2156, 72.6369, "382010", "Gujarat", "tier1"),
    
    # WEST BENGAL (8 locations)
    ("Salt Lake, Kolkata", 22.5800, 88.4200, "700091", "West Bengal", "metro"),
    ("Park Street, Kolkata", 22.5544, 88.3515, "700016", "West Bengal", "metro"),
    ("New Town, Kolkata", 22.5937, 88.4847, "700135", "West Bengal", "metro"),
    ("Howrah", 22.5958, 88.2636, "711101", "West Bengal", "metro"),
    ("Dum Dum, Kolkata", 22.6227, 88.4227, "700028", "West Bengal", "metro"),
    ("Behala, Kolkata", 22.4990, 88.3060, "700034", "West Bengal", "metro"),
    ("Rajarhat, Kolkata", 22.5876, 88.4823, "700135", "West Bengal", "metro"),
    ("Durgapur", 23.5204, 87.3119, "713201", "West Bengal", "tier2"),
    
    # UTTAR PRADESH (10 locations)
    ("Gomti Nagar, Lucknow", 26.8568, 81.0169, "226010", "Uttar Pradesh", "tier1"),
    ("Hazratganj, Lucknow", 26.8520, 80.9470, "226001", "Uttar Pradesh", "tier1"),
    ("Indira Nagar, Lucknow", 26.8800, 80.9900, "226016", "Uttar Pradesh", "tier1"),
    ("Varanasi Cantt", 25.3176, 82.9739, "221002", "Uttar Pradesh", "tier1"),
    ("Sigra, Varanasi", 25.3109, 83.0107, "221010", "Uttar Pradesh", "tier1"),
    ("Kanpur Civil Lines", 26.4499, 80.3319, "208001", "Uttar Pradesh", "tier1"),
    ("Agra Cantonment", 27.1767, 78.0081, "282001", "Uttar Pradesh", "tier1"),
    ("Prayagraj Civil Lines", 25.4358, 81.8463, "211001", "Uttar Pradesh", "tier2"),
    ("Meerut Cantt", 28.9845, 77.7064, "250001", "Uttar Pradesh", "tier2"),
    ("Bareilly", 28.3670, 79.4304, "243001", "Uttar Pradesh", "tier2"),
    
    # RAJASTHAN (8 locations)
    ("MI Road, Jaipur", 26.9157, 75.8000, "302001", "Rajasthan", "tier1"),
    ("Malviya Nagar, Jaipur", 26.8557, 75.8139, "302017", "Rajasthan", "tier1"),
    ("Vaishali Nagar, Jaipur", 26.9124, 75.7270, "302021", "Rajasthan", "tier1"),
    ("C Scheme, Jaipur", 26.9027, 75.8012, "302001", "Rajasthan", "tier1"),
    ("Mansarovar, Jaipur", 26.8685, 75.7596, "302020", "Rajasthan", "tier1"),
    ("Udaipur", 24.5854, 73.7125, "313001", "Rajasthan", "tier2"),
    ("Jodhpur", 26.2389, 73.0243, "342001", "Rajasthan", "tier2"),
    ("Kota", 25.2138, 75.8648, "324001", "Rajasthan", "tier2"),
    
    # KERALA (6 locations)
    ("MG Road, Kochi", 9.9816, 76.2999, "682035", "Kerala", "tier1"),
    ("Edappally, Kochi", 10.0261, 76.3125, "682024", "Kerala", "tier1"),
    ("Thiruvananthapuram", 8.5241, 76.9366, "695001", "Kerala", "tier1"),
    ("Kozhikode", 11.2588, 75.7804, "673001", "Kerala", "tier2"),
    ("Thrissur", 10.5276, 76.2144, "680001", "Kerala", "tier2"),
    ("Kottayam", 9.5916, 76.5222, "686001", "Kerala", "tier3"),
    
    # ANDHRA PRADESH (6 locations)
    ("Vijayawada", 16.5062, 80.6480, "520001", "Andhra Pradesh", "tier1"),
    ("Visakhapatnam", 17.6868, 83.2185, "530001", "Andhra Pradesh", "tier1"),
    ("Guntur", 16.3067, 80.4365, "522001", "Andhra Pradesh", "tier2"),
    ("Tirupati", 13.6288, 79.4192, "517501", "Andhra Pradesh", "tier2"),
    ("Nellore", 14.4426, 79.9865, "524001", "Andhra Pradesh", "tier3"),
    ("Rajahmundry", 16.9891, 81.7840, "533101", "Andhra Pradesh", "tier2"),
    
    # PUNJAB (5 locations)
    ("Chandigarh Sector 17", 30.7410, 76.7841, "160017", "Punjab", "tier1"),
    ("Ludhiana", 30.9010, 75.8573, "141001", "Punjab", "tier1"),
    ("Amritsar", 31.6340, 74.8723, "143001", "Punjab", "tier2"),
    ("Jalandhar", 31.3260, 75.5762, "144001", "Punjab", "tier2"),
    ("Patiala", 30.3398, 76.3869, "147001", "Punjab", "tier2"),
    
    # MADHYA PRADESH (5 locations)
    ("Indore Vijay Nagar", 22.7533, 75.8937, "452010", "Madhya Pradesh", "tier1"),
    ("Bhopal New Market", 23.2599, 77.4126, "462001", "Madhya Pradesh", "tier1"),
    ("Gwalior", 26.2183, 78.1828, "474001", "Madhya Pradesh", "tier2"),
    ("Jabalpur", 23.1815, 79.9864, "482001", "Madhya Pradesh", "tier2"),
    ("Ujjain", 23.1765, 75.7885, "456001", "Madhya Pradesh", "tier3"),
    
    # BIHAR (4 locations)
    ("Patna Boring Road", 25.6093, 85.1376, "800001", "Bihar", "tier1"),
    ("Patna Kankarbagh", 25.5941, 85.1376, "800020", "Bihar", "tier1"),
    ("Gaya", 24.7914, 84.9994, "823001", "Bihar", "tier2"),
    ("Muzaffarpur", 26.1225, 85.3906, "842001", "Bihar", "tier2"),
    
    # ODISHA (3 locations)
    ("Bhubaneswar", 20.2961, 85.8245, "751001", "Odisha", "tier1"),
    ("Cuttack", 20.4625, 85.8830, "753001", "Odisha", "tier2"),
    ("Rourkela", 22.2604, 84.8536, "769001", "Odisha", "tier2"),
]

# ============================================================================
# TIME PATTERNS
# ============================================================================

# Hourly weights - fraud reporting peaks in evening
HOURLY_WEIGHTS = np.array([
    0.3, 0.2, 0.1, 0.1, 0.2, 0.4,   # 00-05 (late night/early morning)
    0.8, 1.5, 2.5, 3.5, 4.0, 3.8,   # 06-11 (morning peak)
    3.5, 3.8, 4.0, 4.2, 4.5, 5.0,   # 12-17 (afternoon)
    5.5, 5.0, 4.5, 3.5, 2.0, 1.0,   # 18-23 (evening decline)
])
HOURLY_WEIGHTS = HOURLY_WEIGHTS / HOURLY_WEIGHTS.sum()

# Day weights (Mon=0, Sun=6) - slightly higher on weekdays
DAY_WEIGHTS = np.array([1.2, 1.1, 1.1, 1.0, 1.2, 0.9, 0.8])
DAY_WEIGHTS = DAY_WEIGHTS / DAY_WEIGHTS.sum()

# Month weights - higher in festival months
MONTH_WEIGHTS = np.array([
    1.0, 0.9, 1.0, 1.0, 0.9, 0.8,   # Jan-Jun
    0.8, 0.9, 1.0, 1.3, 1.4, 1.2,   # Jul-Dec (festivals)
])
MONTH_WEIGHTS = MONTH_WEIGHTS / MONTH_WEIGHTS.sum()


class ComprehensiveCSTDatasetGenerator:
    """
    Generates comprehensive dataset for CST Transformer with:
    - 150,000 records
    - 110+ victim locations
    - 15 states
    - Realistic fraud patterns
    - Time-based behaviors
    """
    
    def __init__(self, atm_data_path: str):
        """Load ATM data and build spatial index."""
        self.atms = pd.read_parquet(atm_data_path)
        print(f"Loaded {len(self.atms)} ATMs from {atm_data_path}")
        
        self.atm_coords = self.atms[["latitude", "longitude"]].values
        self.fraud_types = list(FRAUD_PATTERNS.keys())
        self.states = list(set(loc[4] for loc in VICTIM_LOCATIONS))
        self.locations_by_state = self._group_locations_by_state()
        
        print(f"States: {len(self.states)}")
        print(f"Victim locations: {len(VICTIM_LOCATIONS)}")
        print(f"Fraud types: {len(self.fraud_types)}")
    
    def _group_locations_by_state(self) -> Dict[str, List]:
        """Group victim locations by state for efficient lookup."""
        grouped = {}
        for loc in VICTIM_LOCATIONS:
            state = loc[4]
            if state not in grouped:
                grouped[state] = []
            grouped[state].append(loc)
        return grouped
    
    def find_nearby_atms(self, lat: float, lon: float, 
                         min_dist: float, max_dist: float,
                         max_results: int = 30) -> List[int]:
        """Find ATMs within distance range, sorted by distance."""
        distances_km = np.sqrt(
            (self.atm_coords[:, 0] - lat)**2 + 
            (self.atm_coords[:, 1] - lon)**2
        ) * 111  # Approximate km conversion
        
        mask = (distances_km >= min_dist) & (distances_km <= max_dist)
        valid = np.where(mask)[0]
        
        if len(valid) == 0:
            # Fallback: get nearest ATMs
            return list(np.argsort(distances_km)[:max_results])
        
        sorted_order = np.argsort(distances_km[valid])[:max_results]
        return list(valid[sorted_order])
    
    def generate_atm_record(self, record_id: int) -> Dict[str, Any]:
        """
        Generate ATM mode record with realistic patterns.
        
        The fraud type affects:
        - Distance to withdrawal ATM
        - Time of day preferences
        - Weekend behavior
        """
        # Select victim location
        loc = random.choice(VICTIM_LOCATIONS)
        area, base_lat, base_lon, pincode, state, city_type = loc
        
        # Add variation to victim location (within ~500m)
        victim_lat = base_lat + random.uniform(-0.005, 0.005)
        victim_lon = base_lon + random.uniform(-0.005, 0.005)
        
        # Select fraud type
        fraud_type = random.choice(self.fraud_types)
        pattern = FRAUD_PATTERNS[fraud_type]
        min_dist, max_dist = pattern["distance"]
        
        # Adjust distance based on city type
        if city_type == "tier3":
            min_dist *= 0.7
            max_dist *= 0.8
        elif city_type == "tier2":
            min_dist *= 0.85
            max_dist *= 0.9
        
        # Generate time with fraud-specific patterns
        peak_hours = pattern["peak_hours"]
        
        # Weighted hour selection (favor peak hours)
        hour_weights = HOURLY_WEIGHTS.copy()
        for h in peak_hours:
            hour_weights[h] *= 1.5
        hour_weights = hour_weights / hour_weights.sum()
        hour = int(np.random.choice(24, p=hour_weights))
        
        # Day with weekend adjustment
        day_weights = DAY_WEIGHTS.copy()
        if pattern["weekend_mult"] != 1.0:
            day_weights[5] *= pattern["weekend_mult"]  # Saturday
            day_weights[6] *= pattern["weekend_mult"]  # Sunday
        day_weights = day_weights / day_weights.sum()
        day = int(np.random.choice(7, p=day_weights))
        
        # Month
        month = int(np.random.choice(12, p=MONTH_WEIGHTS)) + 1
        
        # Generate fraud amount
        min_amt, max_amt = pattern["amount_range"]
        amount = random.randint(min_amt, max_amt)
        
        # Larger amounts → farther withdrawal (fraudsters go farther to avoid detection)
        amount_factor = (amount - min_amt) / (max_amt - min_amt)
        adjusted_min = min_dist + (max_dist - min_dist) * 0.2 * amount_factor
        adjusted_max = min_dist + (max_dist - min_dist) * (0.5 + 0.5 * amount_factor)
        
        # Find target ATM
        nearby = self.find_nearby_atms(victim_lat, victim_lon, adjusted_min, adjusted_max)
        if not nearby:
            return None
        
        # Select ATM (weighted by position - closer ATMs more likely)
        weights = np.array([1.0 / (i + 1)**0.7 for i in range(len(nearby))])
        weights = weights / weights.sum()
        target_idx = int(np.random.choice(nearby, p=weights))
        
        target_atm = self.atms.iloc[target_idx]
        target_dist = np.sqrt(
            (target_atm["latitude"] - victim_lat)**2 +
            (target_atm["longitude"] - victim_lon)**2
        ) * 111
        
        return {
            "record_id": record_id,
            "mode": "atm",
            
            # Victim info
            "victim_lat": round(victim_lat, 6),
            "victim_lon": round(victim_lon, 6),
            "victim_area": area,
            "victim_pincode": pincode,
            "victim_state": state,
            "victim_city_type": city_type,
            "has_victim_location": True,
            
            # Fraud info
            "fraud_type": fraud_type,
            "fraud_amount": amount,
            "hour": hour,
            "day_of_week": day,
            "month": month,
            
            # Target ATM
            "target_atm_idx": target_idx,
            "target_lat": round(target_atm["latitude"], 6),
            "target_lon": round(target_atm["longitude"], 6),
            "target_atm_name": target_atm.get("name", "ATM"),
            "target_atm_bank": target_atm.get("bank_name", "Unknown"),
            "target_distance_km": round(target_dist, 2),
        }
    
    def generate_area_record(self, record_id: int) -> Dict[str, Any]:
        """
        Generate Area mode record (anonymous complaint).
        Model predicts general area from fraud type + time + state.
        """
        # Select state
        state = random.choice(self.states)
        state_locations = self.locations_by_state.get(state, VICTIM_LOCATIONS[:5])
        
        # Target area
        target_loc = random.choice(state_locations)
        target_area, target_lat, target_lon, _, _, city_type = target_loc
        
        # Add noise to target (model predicts general area)
        target_lat += random.uniform(-0.08, 0.08)
        target_lon += random.uniform(-0.08, 0.08)
        
        # Fraud type and time
        fraud_type = random.choice(self.fraud_types)
        pattern = FRAUD_PATTERNS[fraud_type]
        
        hour = int(np.random.choice(24, p=HOURLY_WEIGHTS))
        day = int(np.random.choice(7, p=DAY_WEIGHTS))
        month = int(np.random.choice(12, p=MONTH_WEIGHTS)) + 1
        
        min_amt, max_amt = pattern["amount_range"]
        amount = random.randint(min_amt, max_amt)
        
        return {
            "record_id": record_id,
            "mode": "area",
            
            # No specific victim location
            "victim_lat": 0.0,
            "victim_lon": 0.0,
            "victim_area": "Anonymous",
            "victim_pincode": "000000",
            "victim_state": state,
            "victim_city_type": "unknown",
            "has_victim_location": False,
            
            # Fraud info
            "fraud_type": fraud_type,
            "fraud_amount": amount,
            "hour": hour,
            "day_of_week": day,
            "month": month,
            
            # Target area (general prediction)
            "target_atm_idx": -1,
            "target_lat": round(target_lat, 6),
            "target_lon": round(target_lon, 6),
            "target_atm_name": target_area,
            "target_atm_bank": "Area",
            "target_distance_km": 0.0,
        }
    
    def generate_dataset(self, num_records: int = 150000, 
                        atm_ratio: float = 0.75) -> pd.DataFrame:
        """
        Generate comprehensive dataset.
        
        Args:
            num_records: Total records (default 150k for robust training)
            atm_ratio: Proportion of ATM mode records (75%)
        """
        print(f"\n{'='*60}")
        print(f"Generating {num_records:,} comprehensive records...")
        print(f"  ATM mode: {int(num_records * atm_ratio):,} ({atm_ratio*100:.0f}%)")
        print(f"  Area mode: {int(num_records * (1-atm_ratio)):,} ({(1-atm_ratio)*100:.0f}%)")
        print(f"{'='*60}")
        
        records = []
        atm_count = int(num_records * atm_ratio)
        
        for i in tqdm(range(num_records), desc="Generating"):
            if i < atm_count:
                record = self.generate_atm_record(i)
            else:
                record = self.generate_area_record(i)
            
            if record:
                records.append(record)
        
        df = pd.DataFrame(records)
        df = df.sample(frac=1, random_state=42).reset_index(drop=True)
        
        # Statistics
        print(f"\n{'='*60}")
        print("DATASET STATISTICS")
        print(f"{'='*60}")
        print(f"Total records: {len(df):,}")
        print(f"\nMode distribution:")
        print(df["mode"].value_counts())
        print(f"\nFraud types (balanced):")
        print(df["fraud_type"].value_counts())
        print(f"\nStates coverage ({len(df['victim_state'].unique())} states):")
        print(df["victim_state"].value_counts())
        print(f"\nUnique ATMs used: {df[df['target_atm_idx'] >= 0]['target_atm_idx'].nunique()}")
        print(f"\nTarget distance stats (ATM mode):")
        atm_df = df[df["mode"] == "atm"]
        print(f"  Min: {atm_df['target_distance_km'].min():.1f} km")
        print(f"  Mean: {atm_df['target_distance_km'].mean():.1f} km")
        print(f"  Max: {atm_df['target_distance_km'].max():.1f} km")
        
        return df
    
    def save_dataset(self, df: pd.DataFrame, output_dir: str) -> Path:
        """Save dataset to parquet and CSV."""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        parquet_path = output_path / "cst_unified_dataset.parquet"
        df.to_parquet(parquet_path, index=False)
        print(f"\n✓ Saved to {parquet_path}")
        
        csv_path = output_path / "cst_unified_dataset.csv"
        df.to_csv(csv_path, index=False)
        print(f"✓ Saved to {csv_path}")
        
        # Update ATM reference
        atm_path = output_path / "atm_reference.parquet"
        self.atms.to_parquet(atm_path, index=True)
        print(f"✓ Updated ATM reference at {atm_path}")
        
        return parquet_path


def main():
    print("\n" + "="*60)
    print("COMPREHENSIVE CST DATASET GENERATOR")
    print("="*60)
    print("Creating detailed training data:")
    print("  • 150,000 records")
    print("  • 110+ victim locations")
    print("  • 15 Indian states")
    print("  • 9 fraud types with realistic patterns")
    print("  • Time-based withdrawal behaviors")
    print("="*60)
    
    atm_path = Path(__file__).parent.parent / "data" / "processed" / "india_atm_locations.parquet"
    output_dir = Path(__file__).parent.parent / "data" / "processed"
    
    generator = ComprehensiveCSTDatasetGenerator(str(atm_path))
    df = generator.generate_dataset(num_records=150000, atm_ratio=0.75)
    generator.save_dataset(df, str(output_dir))
    
    # Sample records
    print(f"\n{'='*60}")
    print("SAMPLE ATM MODE RECORD")
    print(f"{'='*60}")
    atm_sample = df[df["mode"] == "atm"].iloc[0]
    print(f"Victim: {atm_sample['victim_area']} ({atm_sample['victim_pincode']})")
    print(f"Location: ({atm_sample['victim_lat']}, {atm_sample['victim_lon']})")
    print(f"Fraud: {atm_sample['fraud_type']}, Amount: ₹{atm_sample['fraud_amount']:,}")
    print(f"Time: {atm_sample['hour']:02d}:00, Day: {atm_sample['day_of_week']}, Month: {atm_sample['month']}")
    print(f"→ Target: {atm_sample['target_atm_name']} ({atm_sample['target_atm_bank']})")
    print(f"→ Distance: {atm_sample['target_distance_km']} km")
    
    print(f"\n{'='*60}")
    print("SAMPLE AREA MODE RECORD")
    print(f"{'='*60}")
    area_sample = df[df["mode"] == "area"].iloc[0]
    print(f"Victim: Anonymous (State: {area_sample['victim_state']})")
    print(f"Fraud: {area_sample['fraud_type']}, Amount: ₹{area_sample['fraud_amount']:,}")
    print(f"→ Predicted Area: {area_sample['target_atm_name']}")
    print(f"→ Coordinates: ({area_sample['target_lat']}, {area_sample['target_lon']})")
    
    print(f"\n{'='*60}")
    print("DATASET READY FOR TRAINING!")
    print("Run: python scripts/train_cst_transformer.py --epochs 60")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
