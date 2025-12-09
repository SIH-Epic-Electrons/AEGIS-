"""
Generate Synthetic Mule Account Dataset
Creates realistic transaction chains with mule and legitimate accounts
Moved to data_generation folder for better organization
"""

import sys
from pathlib import Path

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Import from original location (we'll move it later)
from scripts.generate_mule_dataset import generate_dataset, generate_account_features, generate_transaction_chain

if __name__ == "__main__":
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

