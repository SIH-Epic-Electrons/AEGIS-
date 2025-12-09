"""
Generate Synthetic Mule Account Dataset
Creates realistic transaction chains with mule and legitimate accounts
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
from pathlib import Path
import uuid

# Set random seed for reproducibility
np.random.seed(42)
random.seed(42)

# Output directory
OUTPUT_DIR = Path(__file__).parent.parent / "data" / "processed"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Indian banks
BANKS = ["SBI", "HDFC", "ICICI", "Axis", "PNB", "BOI", "Canara", "Union", "Kotak", "IndusInd"]

# Indian cities
CITIES = ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", 
          "Pune", "Ahmedabad", "Jaipur", "Surat", "Lucknow", "Kanpur"]

# Mule account characteristics
MULE_INDICATORS = {
    "account_age_days": (1, 180),  # New accounts (1-6 months)
    "transaction_velocity": (5, 50),  # High transaction frequency
    "unique_counterparties": (10, 100),  # Many different accounts
    "avg_balance": (1000, 50000),  # Low average balance
    "max_single_transaction": (50000, 1000000),  # Large transactions
    "night_transaction_ratio": (0.3, 0.7),  # Many night transactions
    "weekend_transaction_ratio": (0.4, 0.8),  # Many weekend transactions
    "incoming_outgoing_ratio": (0.8, 1.2),  # Money in and out quickly
    "geographic_spread": (0.1, 0.5),  # Limited geographic spread
    "account_holder_age": (18, 35),  # Younger account holders
}

# Legitimate account characteristics
LEGIT_INDICATORS = {
    "account_age_days": (365, 3650),  # Older accounts (1-10 years)
    "transaction_velocity": (1, 10),  # Normal transaction frequency
    "unique_counterparties": (5, 30),  # Fewer different accounts
    "avg_balance": (50000, 500000),  # Higher average balance
    "max_single_transaction": (10000, 200000),  # Normal transaction sizes
    "night_transaction_ratio": (0.05, 0.2),  # Few night transactions
    "weekend_transaction_ratio": (0.1, 0.3),  # Few weekend transactions
    "incoming_outgoing_ratio": (0.5, 2.0),  # More stable balance
    "geographic_spread": (0.3, 0.9),  # Wider geographic spread
    "account_holder_age": (25, 65),  # Wider age range
}


def generate_account_features(is_mule: bool, account_id: str) -> dict:
    """Generate features for a single account"""
    indicators = MULE_INDICATORS if is_mule else LEGIT_INDICATORS
    
    # Base features
    account_age = random.randint(*indicators["account_age_days"])
    account_opened = datetime.now() - timedelta(days=account_age)
    
    # Transaction features
    transaction_velocity = random.uniform(*indicators["transaction_velocity"])
    unique_counterparties = random.randint(*indicators["unique_counterparties"])
    avg_balance = random.uniform(*indicators["avg_balance"])
    max_single_transaction = random.uniform(*indicators["max_single_transaction"])
    
    # Temporal features
    night_transaction_ratio = random.uniform(*indicators["night_transaction_ratio"])
    weekend_transaction_ratio = random.uniform(*indicators["weekend_transaction_ratio"])
    
    # Flow features
    incoming_outgoing_ratio = random.uniform(*indicators["incoming_outgoing_ratio"])
    geographic_spread = random.uniform(*indicators["geographic_spread"])
    
    # Account holder
    account_holder_age = random.randint(*indicators["account_holder_age"])
    bank = random.choice(BANKS)
    city = random.choice(CITIES)
    
    # Additional mule-specific features
    if is_mule:
        # Mules often have suspicious patterns
        rapid_transfer_count = random.randint(5, 20)  # Many rapid transfers
        account_balance_volatility = random.uniform(0.7, 1.0)  # High volatility
        kyc_verification_score = random.uniform(0.3, 0.7)  # Lower KYC score
        linked_cases_count = random.randint(1, 5)  # Linked to multiple cases
    else:
        rapid_transfer_count = random.randint(0, 3)
        account_balance_volatility = random.uniform(0.1, 0.4)
        kyc_verification_score = random.uniform(0.7, 1.0)
        linked_cases_count = 0
    
    return {
        "account_id": account_id,
        "account_number": f"{random.randint(1000000000, 9999999999)}",
        "bank": bank,
        "ifsc_code": f"{bank[:4]}0{random.randint(1000, 9999)}",
        "account_holder_name": f"Account_{account_id[:8]}",
        "account_holder_age": account_holder_age,
        "city": city,
        "state": "Maharashtra",  # Most cases in Maharashtra
        "account_opened": account_opened,
        "account_age_days": account_age,
        "is_mule": 1 if is_mule else 0,
        
        # Transaction features
        "transaction_velocity": round(transaction_velocity, 2),
        "unique_counterparties": unique_counterparties,
        "avg_balance_30d": round(avg_balance, 2),
        "max_single_transaction": round(max_single_transaction, 2),
        "total_transactions_30d": int(transaction_velocity * 30),
        "rapid_transfer_count": rapid_transfer_count,
        
        # Temporal features
        "night_transaction_ratio": round(night_transaction_ratio, 3),
        "weekend_transaction_ratio": round(weekend_transaction_ratio, 3),
        "avg_transaction_time_hour": random.randint(10, 20) if is_mule else random.randint(9, 17),
        
        # Flow features
        "incoming_outgoing_ratio": round(incoming_outgoing_ratio, 3),
        "geographic_spread": round(geographic_spread, 3),
        "account_balance_volatility": round(account_balance_volatility, 3),
        
        # Risk features
        "kyc_verification_score": round(kyc_verification_score, 3),
        "linked_cases_count": linked_cases_count,
        "suspicious_pattern_score": round(random.uniform(0.7, 1.0) if is_mule else random.uniform(0.0, 0.3), 3),
    }


def generate_transaction_chain(case_id: str, victim_account: dict, num_hops: int = 3, return_accounts: bool = False) -> tuple:
    """
    Generate a transaction chain for a fraud case.
    
    Returns:
        transactions: List of transactions
        accounts: List of accounts created (if return_accounts=True)
    """
    transactions = []
    accounts_created = []
    current_account = victim_account
    remaining_amount = random.uniform(100000, 1000000)  # Initial fraud amount
    
    for hop in range(1, num_hops + 1):
        # Determine if next account is mule (higher probability in early hops)
        is_mule = random.random() < (0.8 if hop <= 2 else 0.4)
        
        # Generate next account
        next_account_id = str(uuid.uuid4())
        next_account = generate_account_features(is_mule, next_account_id)
        accounts_created.append(next_account)
        
        # Transaction amount (with commission)
        commission_rate = random.uniform(0.01, 0.05) if is_mule else random.uniform(0.0, 0.02)
        transfer_amount = remaining_amount * (1 - commission_rate)
        commission = remaining_amount - transfer_amount
        
        # Transaction timestamp
        transaction_time = datetime.now() - timedelta(
            hours=random.randint(0, 48),
            minutes=random.randint(0, 59)
        )
        
        transaction = {
            "case_id": case_id,
            "transaction_id": f"TXN{random.randint(100000000, 999999999)}",
            "hop_number": hop,
            "from_account": current_account["account_id"],
            "from_account_number": current_account["account_number"],
            "from_bank": current_account["bank"],
            "from_ifsc": current_account["ifsc_code"],
            "from_holder_name": current_account["account_holder_name"],
            "to_account": next_account["account_id"],
            "to_account_number": next_account["account_number"],
            "to_bank": next_account["bank"],
            "to_ifsc": next_account["ifsc_code"],
            "to_holder_name": next_account["account_holder_name"],
            "amount": round(transfer_amount, 2),
            "commission": round(commission, 2),
            "transaction_type": random.choice(["IMPS", "NEFT", "UPI"]),
            "transaction_timestamp": transaction_time,
            "status": "COMPLETED",
        }
        
        transactions.append(transaction)
        current_account = next_account
        remaining_amount = transfer_amount
    
    if return_accounts:
        return transactions, accounts_created
    return transactions


def generate_dataset(num_cases: int = 15000, num_accounts: int = 80000):
    """
    Generate complete dataset for mule detection.
    
    Args:
        num_cases: Number of fraud cases to generate (default: 15000)
        num_accounts: Number of accounts to generate (default: 80000)
    
    Returns:
        Tuple of (accounts_df, transactions_df, cases_df)
    """
    print(f"Generating {num_cases:,} fraud cases with {num_accounts:,} accounts...")
    
    accounts = []
    transactions = []
    cases = []
    
    # Generate accounts (mix of mule and legitimate)
    mule_count = int(num_accounts * 0.3)  # 30% mules
    legit_count = num_accounts - mule_count
    
    print(f"Generating {mule_count} mule accounts and {legit_count} legitimate accounts...")
    
    for i in range(num_accounts):
        is_mule = i < mule_count
        account_id = str(uuid.uuid4())
        account = generate_account_features(is_mule, account_id)
        accounts.append(account)
    
    # Generate fraud cases with transaction chains
    print(f"Generating {num_cases} fraud cases...")
    
    # Track all accounts from transaction chains
    chain_accounts = {}  # account_id -> account_data
    
    for i in range(num_cases):
        case_id = str(uuid.uuid4())
        case_number = f"MH-2025-{random.randint(10000, 99999)}"
        
        # Create victim account (or use existing)
        victim_id = str(uuid.uuid4())
        victim_account = generate_account_features(False, victim_id)
        chain_accounts[victim_id] = victim_account
        
        # Generate transaction chain (this creates new accounts)
        chain, chain_accs = generate_transaction_chain(
            case_id, 
            victim_account, 
            num_hops=random.randint(2, 5),
            return_accounts=True
        )
        transactions.extend(chain)
        
        # Add all accounts from chain to chain_accounts
        for acc in chain_accs:
            chain_accounts[acc["account_id"]] = acc
        
        # Case metadata
        case = {
            "case_id": case_id,
            "case_number": case_number,
            "fraud_amount": chain[0]["amount"] if chain else 0,
            "num_hops": len(chain),
            "created_at": datetime.now() - timedelta(days=random.randint(0, 30)),
        }
        cases.append(case)
    
    # Add chain accounts to main accounts list (avoid duplicates)
    print(f"Adding accounts from transaction chains...")
    existing_account_ids = set(acc["account_id"] for acc in accounts)
    new_accounts = []
    for acc_id, acc_data in chain_accounts.items():
        if acc_id not in existing_account_ids:
            new_accounts.append(acc_data)
    
    if new_accounts:
        accounts.extend(new_accounts)
        print(f"Added {len(new_accounts)} new accounts from transaction chains")
    
    # Add chain accounts to main accounts list (avoid duplicates)
    print(f"Adding accounts from transaction chains...")
    existing_account_ids = set(acc["account_id"] for acc in accounts)
    new_accounts = []
    for acc_id, acc_data in chain_accounts.items():
        if acc_id not in existing_account_ids:
            new_accounts.append(acc_data)
    
    if new_accounts:
        accounts.extend(new_accounts)
        print(f"Added {len(new_accounts)} new accounts from transaction chains")
    
    # Create DataFrames
    accounts_df = pd.DataFrame(accounts)
    transactions_df = pd.DataFrame(transactions)
    cases_df = pd.DataFrame(cases)
    
    # Save to files
    accounts_path = OUTPUT_DIR / "mule_accounts_dataset.csv"
    transactions_path = OUTPUT_DIR / "mule_transactions_dataset.csv"
    cases_path = OUTPUT_DIR / "mule_cases_dataset.csv"
    
    accounts_df.to_csv(accounts_path, index=False)
    transactions_df.to_csv(transactions_path, index=False)
    cases_df.to_csv(cases_path, index=False)
    
    print(f"\n✅ Dataset generated successfully!")
    print(f"📁 Accounts: {accounts_path} ({len(accounts_df)} accounts)")
    print(f"📁 Transactions: {transactions_path} ({len(transactions_df)} transactions)")
    print(f"📁 Cases: {cases_path} ({len(cases_df)} cases)")
    print(f"\n📊 Statistics:")
    print(f"   - Mule accounts: {accounts_df['is_mule'].sum()} ({accounts_df['is_mule'].mean()*100:.1f}%)")
    print(f"   - Legitimate accounts: {(accounts_df['is_mule']==0).sum()} ({(1-accounts_df['is_mule'].mean())*100:.1f}%)")
    print(f"   - Average transactions per case: {len(transactions_df) / len(cases_df):.1f}")
    
    return accounts_df, transactions_df, cases_df


if __name__ == "__main__":
    # Generate large dataset for better model performance
    # 70k-100k accounts with proportional cases
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate mule account dataset")
    parser.add_argument("--accounts", type=int, default=80000, help="Number of accounts to generate (default: 80000)")
    parser.add_argument("--cases", type=int, default=15000, help="Number of fraud cases to generate (default: 15000)")
    args = parser.parse_args()
    
    print(f"🚀 Generating large dataset:")
    print(f"   - Accounts: {args.accounts:,}")
    print(f"   - Cases: {args.cases:,}")
    print(f"   - Estimated transactions: ~{args.cases * 3:,}")
    print(f"   This may take several minutes...\n")
    
    # Generate dataset
    accounts_df, transactions_df, cases_df = generate_dataset(
        num_cases=args.cases,
        num_accounts=args.accounts
    )
    
    print("\n✅ Dataset generation complete!")
    print(f"📊 Final Statistics:")
    print(f"   - Total accounts: {len(accounts_df):,}")
    print(f"   - Mule accounts: {accounts_df['is_mule'].sum():,} ({accounts_df['is_mule'].mean()*100:.1f}%)")
    print(f"   - Legitimate accounts: {(accounts_df['is_mule']==0).sum():,} ({(1-accounts_df['is_mule'].mean())*100:.1f}%)")
    print(f"   - Total transactions: {len(transactions_df):,}")
    print(f"   - Total cases: {len(cases_df):,}")

