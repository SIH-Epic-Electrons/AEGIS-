"""
CFCFRMS (Central Fraud Communication and Fraud Reporting Management System) Simulator
Simulates the real CFCFRMS system for prototype/demo purposes
"""

import logging
import hashlib
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from uuid import UUID, uuid4
import random

logger = logging.getLogger(__name__)


class CFCFRMSSimulator:
    """
    Simulates CFCFRMS system for tracing money flow across banks.
    
    In real system:
    - CFCFRMS is NPCI's system for fraud investigation
    - Banks share transaction details when fraud is reported
    - System traces money flow across all banks
    
    For prototype:
    - Simulates transaction chain based on case data
    - Creates realistic transaction hops
    - Returns transaction details as CFCFRMS would
    """
    
    BANKS = ["SBI", "HDFC", "ICICI", "Axis", "PNB", "BOI", "Canara", "Union", "Kotak", "IndusInd"]
    TRANSACTION_TYPES = ["IMPS", "NEFT", "UPI", "RTGS"]
    
    # Major Indian cities with coordinates (for location generation)
    CITIES = [
        {"name": "Mumbai", "lat": 19.0760, "lon": 72.8777, "state": "Maharashtra"},
        {"name": "Delhi", "lat": 28.6139, "lon": 77.2090, "state": "Delhi"},
        {"name": "Bangalore", "lat": 12.9716, "lon": 77.5946, "state": "Karnataka"},
        {"name": "Hyderabad", "lat": 17.3850, "lon": 78.4867, "state": "Telangana"},
        {"name": "Chennai", "lat": 13.0827, "lon": 80.2707, "state": "Tamil Nadu"},
        {"name": "Kolkata", "lat": 22.5726, "lon": 88.3639, "state": "West Bengal"},
        {"name": "Pune", "lat": 18.5204, "lon": 73.8567, "state": "Maharashtra"},
        {"name": "Ahmedabad", "lat": 23.0225, "lon": 72.5714, "state": "Gujarat"},
        {"name": "Jaipur", "lat": 26.9124, "lon": 75.7873, "state": "Rajasthan"},
        {"name": "Surat", "lat": 21.1702, "lon": 72.8311, "state": "Gujarat"},
    ]
    
    @staticmethod
    def _generate_location(case_id: UUID, hop: int, account_idx: int) -> Dict:
        """Generate location for an account based on case_id"""
        seed = CFCFRMSSimulator._get_case_seed(case_id, hop * 1000 + account_idx)
        rng = random.Random(seed)
        city = rng.choice(CFCFRMSSimulator.CITIES)
        # Add small random offset within city (0.01-0.05 degrees ~1-5km)
        lat_offset = rng.uniform(-0.05, 0.05)
        lon_offset = rng.uniform(-0.05, 0.05)
        return {
            "city": city["name"],
            "state": city["state"],
            "latitude": round(city["lat"] + lat_offset, 6),
            "longitude": round(city["lon"] + lon_offset, 6),
        }
    
    @staticmethod
    def _get_case_seed(case_id: UUID, hop: int = 0) -> int:
        """Generate a deterministic seed from case_id for reproducible randomness"""
        seed_str = f"{case_id}_{hop}"
        seed_hash = int(hashlib.md5(seed_str.encode()).hexdigest(), 16)
        return seed_hash % (2**31)  # Keep within int32 range
    
    @staticmethod
    def _generate_account_number(case_id: UUID, hop: int) -> str:
        """Generate unique account number based on case_id and hop"""
        seed = CFCFRMSSimulator._get_case_seed(case_id, hop)
        rng = random.Random(seed)
        # Generate 10-digit account number
        account_num = rng.randint(1000000000, 9999999999)
        return str(account_num)
    
    @staticmethod
    def _generate_holder_name(case_id: UUID, hop: int) -> str:
        """Generate realistic Indian name based on case_id"""
        first_names = ["Rajesh", "Priya", "Amit", "Sunita", "Vikram", "Kavita", "Rohit", "Anjali", 
                      "Suresh", "Meera", "Deepak", "Pooja", "Nikhil", "Shreya", "Arjun", "Divya"]
        last_names = ["Kumar", "Sharma", "Patel", "Singh", "Gupta", "Verma", "Yadav", "Shah",
                     "Reddy", "Nair", "Desai", "Joshi", "Malhotra", "Agarwal", "Mehta", "Rao"]
        
        seed = CFCFRMSSimulator._get_case_seed(case_id, hop * 100)  # Different seed for names
        rng = random.Random(seed)
        first = rng.choice(first_names)
        last = rng.choice(last_names)
        return f"{first} {last}"
    
    @staticmethod
    def trace_money_flow(
        case_id: UUID,
        victim_account: str,
        victim_bank: str,
        fraud_amount: float,
        complaint_timestamp: datetime,
        num_hops: Optional[int] = None
    ) -> List[Dict]:
        """
        Trace money flow from victim account through transaction chain.
        
        Realistic fraud pattern:
        1. Victim -> First mule account (usually split into 2-3 accounts immediately)
        2. Mule accounts -> More mule accounts (layering)
        3. Final mule accounts -> Cash out locations
        
        Uses case_id as seed to ensure each case gets unique, reproducible data.
        
        Args:
            case_id: Case identifier (used for seeding randomness)
            victim_account: Victim's account number
            victim_bank: Victim's bank
            fraud_amount: Amount fraudulently transferred (TOTAL amount lost by victim)
            complaint_timestamp: When complaint was filed
            num_hops: Number of transaction hops (default: deterministic based on case_id)
        
        Returns:
            List of transactions in the chain
        """
        # Use case_id to determine number of hops (deterministic but varied)
        # Realistic: 3-6 hops (fraudsters typically use 3-4 layers)
        if num_hops is None:
            seed = CFCFRMSSimulator._get_case_seed(case_id, 0)
            rng = random.Random(seed)
            num_hops = rng.randint(3, 6)  # 3-6 hops for realistic patterns
        
        # Create case-specific random generator
        case_seed = CFCFRMSSimulator._get_case_seed(case_id, 0)
        rng = random.Random(case_seed)
        
        transactions = []
        
        # Start time (before complaint) - fraudsters move money quickly (within 1-4 hours)
        hours_offset = rng.randint(1, 4)  # Changed from 1-48 to 1-4 hours (more realistic)
        minutes_offset = rng.randint(0, 59)
        transaction_time = complaint_timestamp - timedelta(
            hours=hours_offset,
            minutes=minutes_offset
        )
        
        # CRITICAL: Track total to ensure it matches original fraud_amount
        original_fraud_amount = fraud_amount
        total_allocated = 0.0
        
        # Track account balances: account_id -> balance
        # This tracks the current balance in each account
        account_balances: Dict[str, float] = {}
        account_details: Dict[str, Dict] = {}  # Store account metadata (bank, holder, location)
        
        # Initialize victim account with full fraud amount
        # The victim has the money initially, then sends it to fraudster
        account_balances[victim_account] = fraud_amount
        account_details[victim_account] = {
            "bank": victim_bank,
            "holder_name": "Victim",
            "location": CFCFRMSSimulator._generate_location(case_id, 0, 0),
            "is_victim": True
        }
        
        # LOGICAL FLOW: Victim → Fraudster → Multiple accounts
        # Hop 1: Victim sends money to fraudster (first receiving account)
        # Hop 2+: Fraudster distributes to multiple accounts
        
        # Track accounts that need to be processed (for splitting scenarios)
        # Format: {account, bank, balance, hop, is_fraudster}
        accounts_to_process = [{
            "account": victim_account,
            "bank": victim_bank,
            "balance": fraud_amount,  # Current balance in account
            "hop": 0,
            "is_fraudster": False  # Victim is not fraudster
        }]
        
        for hop in range(1, num_hops + 1):
            # LOGICAL FLOW EXPLANATION:
            # Hop 1: Victim → Fraudster (single account that receives from victim)
            #        This is the fraudster's main account
            # Hop 2+: Fraudster → Multiple accounts (distribution/layering)
            #        Fraudster splits money to avoid detection
            # Last hop: Final accounts (preparing for cash out)
            
            # Determine if this hop should split
            # Hop 1: NEVER split - victim sends to single fraudster account
            # Hop 2: Usually splits (fraudster distributes to multiple accounts)
            # Middle hops: May split again or consolidate
            # Last hop: Never split (consolidating for cash out)
            if hop == 1:
                should_split = False  # Hop 1: Victim → Single Fraudster account
            elif hop == 2:
                should_split = (CFCFRMSSimulator._get_case_seed(case_id, hop * 1000) % 10) < 8  # 80% chance to split
            elif hop < num_hops:
                should_split = (CFCFRMSSimulator._get_case_seed(case_id, hop * 1000) % 10) < 4  # 40% chance
            else:
                should_split = False  # Last hop: no split
            
            if should_split:
                # SPLIT SCENARIO: Money splits into 2-4 accounts (realistic: fraudsters split to avoid detection)
                split_seed = CFCFRMSSimulator._get_case_seed(case_id, hop * 2000)
                split_rng = random.Random(split_seed)
                num_splits = split_rng.randint(2, 4)  # Split into 2-4 accounts
                
                # Process each account that needs to split
                new_accounts = []
                for acc_info in accounts_to_process:
                    source_account = acc_info["account"]
                    source_bank = acc_info["bank"]
                    source_balance = acc_info["balance"]  # Current balance in source account
                    
                    # Get balance before transaction
                    balance_before = account_balances.get(source_account, 0.0)
                    
                    # Fraudsters take small commission (0.5-2%) for their network
                    commission_rate = split_rng.uniform(0.005, 0.02)  # 0.5-2% commission
                    total_to_transfer = source_balance * (1 - commission_rate)
                    commission = source_balance - total_to_transfer
                    
                    # Split amount into multiple accounts (unequal splits are more realistic)
                    split_group_id = f"{case_id}_{hop}_{source_account}"
                    split_amounts = []
                    
                    # Generate split amounts (not equal, but realistic)
                    # Fraudsters often split unevenly to make it look less suspicious
                    remaining_split = total_to_transfer
                    for i in range(num_splits - 1):
                        # Each split gets 20-45% of remaining (uneven splits)
                        split_pct = split_rng.uniform(0.20, 0.45)
                        split_amt = remaining_split * split_pct
                        split_amounts.append(split_amt)
                        remaining_split -= split_amt
                    # Last split gets remaining
                    split_amounts.append(remaining_split)
                    
                    # Create transactions for each split
                    for split_idx, split_amount in enumerate(split_amounts):
                        # Generate unique account for this split
                        split_account_seed = CFCFRMSSimulator._get_case_seed(case_id, hop * 10000 + split_idx)
                        split_account_rng = random.Random(split_account_seed)
                        
                        available_banks = [b for b in CFCFRMSSimulator.BANKS if b != source_bank]
                        next_bank = split_account_rng.choice(available_banks)
                        next_account = CFCFRMSSimulator._generate_account_number(case_id, hop * 100 + split_idx)
                        next_ifsc = f"{next_bank[:4]}0{split_account_rng.randint(1000, 9999)}"
                        next_holder = CFCFRMSSimulator._generate_holder_name(case_id, hop * 100 + split_idx)
                        next_location = CFCFRMSSimulator._generate_location(case_id, hop, split_idx)
                        
                        # Initialize destination account if it doesn't exist
                        if next_account not in account_balances:
                            account_balances[next_account] = 0.0
                            account_details[next_account] = {
                                "bank": next_bank,
                                "holder_name": next_holder,
                                "location": next_location,
                                "is_victim": False
                            }
                        
                        # Get destination account balance before transaction
                        dest_balance_before = account_balances.get(next_account, 0.0)
                        
                        # Update balances
                        # Source account: deduct split amount + commission
                        account_balances[source_account] = balance_before - split_amount
                        balance_after_source = account_balances[source_account]
                        
                        # Destination account: add split amount
                        account_balances[next_account] = dest_balance_before + split_amount
                        balance_after_dest = account_balances[next_account]
                        
                        # Transaction details
                        transaction_type = split_account_rng.choice(CFCFRMSSimulator.TRANSACTION_TYPES)
                        transaction_id = f"{transaction_type}{split_account_rng.randint(100000000000, 999999999999)}"
                        utr_number = f"UTR{split_account_rng.randint(100000000000, 999999999999)}"
                        
                        # Timestamp (slightly offset for each split)
                        split_transaction_time = transaction_time + timedelta(minutes=split_account_rng.randint(1, 5))
                        
                        # Generate holder name for from_account
                        if hop == 1:
                            from_holder = "Victim"  # Victim sends to fraudster
                        elif hop == 2:
                            # Hop 2: Fraudster is sending (use fraudster name)
                            from_holder = "Fraudster"  # Clear label for fraudster account
                        else:
                            from_holder = CFCFRMSSimulator._generate_holder_name(case_id, hop - 1)
                        
                        # Generate IFSC for from_account
                        from_ifsc_seed = CFCFRMSSimulator._get_case_seed(case_id, hop * 10 + split_idx)
                        from_ifsc_rng = random.Random(from_ifsc_seed)
                        from_ifsc = f"{source_bank[:4]}0{from_ifsc_rng.randint(1000, 9999)}"
                        
                        transaction = {
                            "transaction_id": transaction_id,
                            "utr_number": utr_number,
                            "case_id": str(case_id),
                            "hop_number": hop,
                            
                            # From account
                            "from_account": source_account,
                            "from_bank": source_bank,
                            "from_ifsc": from_ifsc,
                            "from_holder_name": from_holder,
                            "from_balance_before": round(balance_before, 2),
                            "from_balance_after": round(balance_after_source, 2),
                            "from_location": account_details[source_account]["location"],
                            
                            # To account
                            "to_account": next_account,
                            "to_bank": next_bank,
                            "to_ifsc": next_ifsc,
                            "to_holder_name": next_holder,
                            "to_balance_before": round(dest_balance_before, 2),
                            "to_balance_after": round(balance_after_dest, 2),
                            "to_location": next_location,
                            
                            # Amount (split amount)
                            "amount": round(split_amount, 2),
                            "commission": round(commission / num_splits if split_idx == 0 else 0, 2),  # Commission only on first
                            
                            # Split information
                            "split_group_id": split_group_id,
                            "split_index": split_idx,
                            "split_total": num_splits,
                            
                            # Transaction details
                            "transaction_type": transaction_type,
                            "transaction_timestamp": split_transaction_time.isoformat(),
                            "status": "COMPLETED",
                            
                            # Metadata
                            "trace_timestamp": datetime.utcnow().isoformat(),
                            "source": "CFCFRMS_SIMULATOR",
                        }
                        
                        transactions.append(transaction)
                        total_allocated += split_amount
                        
                        # Add to next hop processing (with current balance)
                        # Mark as fraudster if this is hop 1 (first receiving account)
                        new_accounts.append({
                            "account": next_account,
                            "bank": next_bank,
                            "balance": balance_after_dest,  # Current balance after receiving money
                            "hop": hop,
                            "is_fraudster": (hop == 1)  # First receiving account is fraudster
                        })
                
                # Update accounts to process for next hop
                accounts_to_process = new_accounts
                
                # Update transaction time for next hop (fraudsters move quickly: 2-15 minutes between splits)
                transaction_time = transaction_time + timedelta(minutes=split_rng.randint(2, 15))
                
            else:
                # NORMAL SCENARIO: Single transaction per account
                new_accounts = []
                for acc_info in accounts_to_process:
                    source_account = acc_info["account"]
                    source_bank = acc_info["bank"]
                    source_balance = acc_info["balance"]  # Current balance in source account
                    
                    # Get balance before transaction
                    balance_before = account_balances.get(source_account, 0.0)
                    
                    # Use hop-specific seed for this hop's randomness
                    hop_seed = CFCFRMSSimulator._get_case_seed(case_id, hop * 1000 + len(new_accounts))
                    hop_rng = random.Random(hop_seed)
                    
                    # Next account (different bank) - deterministic for this case+hop
                    available_banks = [b for b in CFCFRMSSimulator.BANKS if b != source_bank]
                    next_bank = hop_rng.choice(available_banks)
                    
                    # Generate unique account number for this case+hop
                    next_account = CFCFRMSSimulator._generate_account_number(case_id, hop * 100 + len(new_accounts))
                    next_ifsc = f"{next_bank[:4]}0{hop_rng.randint(1000, 9999)}"
                    
                    # Generate realistic holder name and location
                    # Hop 1: This is the fraudster account (first receiving account from victim)
                    if hop == 1:
                        next_holder = "Fraudster"  # Clear label for fraudster
                    else:
                        next_holder = CFCFRMSSimulator._generate_holder_name(case_id, hop * 100 + len(new_accounts))
                    next_location = CFCFRMSSimulator._generate_location(case_id, hop, len(new_accounts))
                    
                    # Initialize destination account if it doesn't exist
                    if next_account not in account_balances:
                        account_balances[next_account] = 0.0
                        account_details[next_account] = {
                            "bank": next_bank,
                            "holder_name": next_holder,
                            "location": next_location,
                            "is_victim": False,
                            "is_fraudster": (hop == 1)  # First receiving account is fraudster
                        }
                    
                    # Get destination account balance before transaction
                    dest_balance_before = account_balances.get(next_account, 0.0)
                    
                    # Transaction amount (with commission)
                    # For last hop, transfer all remaining amount (minimal commission)
                    if hop == num_hops:
                        # Last hop: transfer all remaining amount (small commission for cash out)
                        commission_rate = hop_rng.uniform(0.005, 0.01)  # 0.5-1% for final hop
                        transfer_amount = source_balance * (1 - commission_rate)
                        commission = source_balance - transfer_amount
                    else:
                        # Intermediate hops: small commission (0.5-2%)
                        commission_rate = hop_rng.uniform(0.005, 0.02)  # 0.5-2% commission
                        transfer_amount = source_balance * (1 - commission_rate)
                        commission = source_balance - transfer_amount
                    
                    # CRITICAL: Ensure we don't exceed original fraud_amount
                    # Calculate remaining unallocated amount
                    remaining_unallocated = original_fraud_amount - total_allocated
                    if remaining_unallocated <= 0:
                        logger.warning(f"All fraud amount allocated at hop {hop}, stopping")
                        break
                    
                    # Ensure transfer doesn't exceed what's left or source balance
                    transfer_amount = min(transfer_amount, source_balance, remaining_unallocated)
                    if transfer_amount <= 0:
                        logger.warning(f"Transfer amount would be <= 0 for hop {hop}, skipping")
                        continue
                    
                    # Recalculate commission based on actual transfer
                    commission = source_balance - transfer_amount
                    
                    # Update balances
                    # Source account: deduct transfer amount
                    account_balances[source_account] = balance_before - transfer_amount
                    balance_after_source = account_balances[source_account]
                    
                    # Destination account: add transfer amount
                    account_balances[next_account] = dest_balance_before + transfer_amount
                    balance_after_dest = account_balances[next_account]
                    
                    # Update totals
                    total_allocated += transfer_amount
                    
                    # Generate holder name for from_account
                    if hop == 1:
                        from_holder = "Victim"  # Victim sends to fraudster
                    elif hop == 2:
                        from_holder = "Fraudster"  # Fraudster distributes
                    else:
                        from_holder = CFCFRMSSimulator._generate_holder_name(case_id, hop - 1)
                    
                    # Transaction details - deterministic for this case+hop
                    transaction_type = hop_rng.choice(CFCFRMSSimulator.TRANSACTION_TYPES)
                    transaction_id = f"{transaction_type}{hop_rng.randint(100000000000, 999999999999)}"
                    utr_number = f"UTR{hop_rng.randint(100000000000, 999999999999)}"
                    
                    # Transaction timestamp (sequential)
                    # Fraudsters move money quickly: 3-20 minutes between hops
                    minutes_between = hop_rng.randint(3, 20)
                    transaction_time = transaction_time + timedelta(minutes=minutes_between)
                    
                    # Generate holder name for from_account (if not victim)
                    if hop == 1:
                        from_holder = "Victim"
                    else:
                        from_holder = CFCFRMSSimulator._generate_holder_name(case_id, hop - 1)
                    
                    # Generate IFSC for from_account
                    from_ifsc_seed = CFCFRMSSimulator._get_case_seed(case_id, hop * 10 + len(new_accounts))
                    from_ifsc_rng = random.Random(from_ifsc_seed)
                    from_ifsc = f"{source_bank[:4]}0{from_ifsc_rng.randint(1000, 9999)}"
                    
                    # Generate IFSC for from_account
                    from_ifsc_seed = CFCFRMSSimulator._get_case_seed(case_id, hop * 10)
                    from_ifsc_rng = random.Random(from_ifsc_seed)
                    from_ifsc = f"{source_bank[:4]}0{from_ifsc_rng.randint(1000, 9999)}"
                    
                    transaction = {
                        "transaction_id": transaction_id,
                        "utr_number": utr_number,
                        "case_id": str(case_id),
                        "hop_number": hop,
                        
                        # From account
                        "from_account": source_account,
                        "from_bank": source_bank,
                        "from_ifsc": from_ifsc,
                        "from_holder_name": from_holder,
                        "from_balance_before": round(balance_before, 2),
                        "from_balance_after": round(balance_after_source, 2),
                        "from_location": account_details[source_account]["location"],
                        
                        # To account
                        "to_account": next_account,
                        "to_bank": next_bank,
                        "to_ifsc": next_ifsc,
                        "to_holder_name": next_holder,
                        "to_balance_before": round(dest_balance_before, 2),
                        "to_balance_after": round(balance_after_dest, 2),
                        "to_location": next_location,
                        
                        # Amount (properly distributed based on case fraud_amount)
                        "amount": round(transfer_amount, 2),
                        "commission": round(commission, 2),
                        
                        # Split information (None for non-split transactions)
                        "split_group_id": None,
                        "split_index": None,
                        "split_total": None,
                        
                        # Transaction details
                        "transaction_type": transaction_type,
                        "transaction_timestamp": transaction_time.isoformat(),
                        "status": "COMPLETED",
                        
                        # Metadata
                        "trace_timestamp": datetime.utcnow().isoformat(),
                        "source": "CFCFRMS_SIMULATOR",
                    }
                    
                    transactions.append(transaction)
                    
                    # Add to next hop processing (with current balance)
                    new_accounts.append({
                        "account": next_account,
                        "bank": next_bank,
                        "balance": balance_after_dest,  # Current balance after receiving money
                        "hop": hop,
                        "is_fraudster": (hop == 1)  # First receiving account is fraudster
                    })
                
                # Update accounts to process for next hop
                accounts_to_process = new_accounts
            
            # Safety check: If no accounts to process, stop
            if not accounts_to_process:
                logger.debug(f"No accounts to process at hop {hop}, stopping")
                break
            
            # Check if we've allocated all fraud amount (with small tolerance for rounding)
            if total_allocated >= original_fraud_amount * 0.995:
                logger.debug(f"All fraud amount allocated at hop {hop}: total={total_allocated:.2f}, original={original_fraud_amount:.2f}")
                break
        
        # CRITICAL VALIDATION: Ensure total matches original fraud_amount exactly
        total_in_chain = sum(t["amount"] for t in transactions)
        difference = original_fraud_amount - total_in_chain
        
        if abs(difference) > 0.01:  # More than 1 paisa difference
            logger.warning(f"Total transaction amount ({total_in_chain:.2f}) doesn't match fraud amount ({original_fraud_amount:.2f}) for case {case_id}. Difference: {difference:.2f}")
            
            # Adjust: If we're short, add to last transaction(s)
            # If we're over, scale down proportionally
            if difference > 0:
                # We're short - add difference to last transaction
                if transactions:
                    transactions[-1]["amount"] = round(transactions[-1]["amount"] + difference, 2)
                    logger.info(f"Adjusted last transaction by +{difference:.2f} to match fraud amount")
            else:
                # We're over - scale down proportionally
                scale_factor = original_fraud_amount / total_in_chain
                for txn in transactions:
                    txn["amount"] = round(txn["amount"] * scale_factor, 2)
                    if "commission" in txn:
                        txn["commission"] = round(txn["commission"] * scale_factor, 2)
                logger.info(f"Scaled down all transactions by factor {scale_factor:.4f} to match fraud amount")
        
        final_total = sum(t["amount"] for t in transactions)
        logger.info(f"CFCFRMS traced {len(transactions)} transactions for case {case_id}. Total: ₹{final_total:.2f} (matches original: ₹{original_fraud_amount:.2f})")
        return transactions
    
    @staticmethod
    def get_account_details(account_number: str, bank: str) -> Dict:
        """
        Get account details (simulated).
        
        In real CFCFRMS:
        - Queries bank's system for account details
        - Returns KYC information, account status, etc.
        
        For prototype:
        - Returns simulated account details
        """
        return {
            "account_number": account_number,
            "bank": bank,
            "ifsc_code": f"{bank[:4]}0{random.randint(1000, 9999)}",
            "account_holder_name": f"Account Holder {account_number[-4:]}",
            "account_type": random.choice(["Savings", "Current"]),
            "account_status": "Active",
            "kyc_status": random.choice(["Verified", "Pending", "Incomplete"]),
            "account_opened": (datetime.now() - timedelta(days=random.randint(1, 3650))).isoformat(),
            "source": "CFCFRMS_SIMULATOR",
        }
    
    @staticmethod
    def freeze_account(account_number: str, bank: str, case_id: UUID) -> Dict:
        """
        Simulate account freeze request.
        
        In real CFCFRMS:
        - Sends freeze request to bank via NPCI
        - Bank freezes account
        - Returns confirmation
        
        For prototype:
        - Simulates freeze process
        """
        return {
            "account_number": account_number,
            "bank": bank,
            "case_id": str(case_id),
            "freeze_status": "FROZEN",
            "freeze_timestamp": datetime.utcnow().isoformat(),
            "freeze_reason": "Fraud investigation",
            "source": "CFCFRMS_SIMULATOR",
        }

