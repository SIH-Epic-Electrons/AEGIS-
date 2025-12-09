"""
Money Trace Service
Integrates CFCFRMS simulator and mule detection to trace money flow and identify mule accounts
"""

import logging
from typing import List, Dict, Optional
from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from app.services.cfcfrms_simulator import CFCFRMSSimulator
from app.services.mule_detector_service import MuleDetectorService
from app.models.transaction import Transaction, TransactionType, TransactionStatus
from app.models.mule_account import MuleAccount, MuleAccountStatus
from app.models.case import Case
from app.models.frozen_account import FrozenAccount

logger = logging.getLogger(__name__)

# Initialize services
cfcfrms_simulator = CFCFRMSSimulator()
mule_detector = MuleDetectorService()


async def trace_money_flow_and_detect_mules(
    db: AsyncSession,
    case: Case,
    victim_account: Optional[str] = None
) -> Dict:
    """
    Trace money flow using CFCFRMS simulator and detect mule accounts.
    
    This function:
    1. Uses CFCFRMS simulator to trace transaction chain
    2. Stores all transactions in database
    3. Uses mule detector service to identify mule accounts
    4. Stores mule accounts in database
    
    Args:
        db: Database session
        case: Case object
        victim_account: Victim's account number (optional, will use destination_account if not provided)
    
    Returns:
        Dictionary with summary of traced transactions and detected mules
    """
    # Wrap entire function in try-catch to handle database schema issues gracefully
    try:
        # Check if transactions already exist for this case (prevent duplicate tracing)
        # Use a simple count query to avoid issues with missing columns
        # This only queries the 'id' column which definitely exists
        try:
            count_result = await db.execute(
                select(func.count(Transaction.id)).where(Transaction.case_id == case.id)
            )
            existing_count = count_result.scalar() or 0
        except Exception as count_error:
            # If even the count query fails (e.g., table doesn't exist), assume no transactions
            error_msg = str(count_error).lower()
            if "column" in error_msg or "does not exist" in error_msg or "undefinedcolumn" in error_msg:
                logger.warning(f"Database schema issue detected: {count_error}. Assuming no existing transactions.")
                existing_count = 0
            else:
                raise  # Re-raise if it's a different error
        
        if existing_count > 0:
            logger.info(f"Transactions already exist for case {case.id} ({existing_count} transactions), skipping money trace")
            
            mule_count_result = await db.execute(
                select(func.count(MuleAccount.id)).where(MuleAccount.case_id == case.id)
            )
            mule_count = mule_count_result.scalar() or 0
            
            return {
                "success": True,
                "transactions_traced": existing_count,
                "mule_accounts_detected": mule_count,
                "message": "Transactions already traced for this case"
            }
        
        # Determine victim account (destination account from case)
        if not victim_account:
            victim_account = case.destination_account
        
        if not victim_account:
            logger.warning(f"No victim account found for case {case.id}, skipping money trace")
            return {
                "success": False,
                "error": "No victim account found",
                "transactions_traced": 0,
                "mule_accounts_detected": 0
            }
        
        # Step 1: Trace money flow using CFCFRMS simulator
        # IMPORTANT: fraud_amount is the TOTAL amount lost by the victim
        logger.info(f"Tracing money flow for case {case.id} from account {victim_account}, fraud_amount: ₹{case.fraud_amount:.2f}")
        
        transactions_data = cfcfrms_simulator.trace_money_flow(
            case_id=case.id,
            victim_account=victim_account,
            victim_bank=case.destination_bank or "Unknown",
            fraud_amount=case.fraud_amount,  # This is the total amount lost by victim
            complaint_timestamp=case.complaint_timestamp or case.created_at,
            num_hops=None  # Will generate 3-6 hops for realistic patterns
        )
        
        if not transactions_data:
            logger.warning(f"No transactions traced for case {case.id}")
            return {
                "success": False,
                "error": "No transactions traced",
                "transactions_traced": 0,
                "mule_accounts_detected": 0
            }
        
        # Validate: Sum of all transaction amounts should equal fraud_amount
        total_traced = sum(t.get("amount", 0) for t in transactions_data)
        if abs(total_traced - case.fraud_amount) > 0.01:
            logger.warning(f"Transaction total ({total_traced:.2f}) doesn't match fraud_amount ({case.fraud_amount:.2f}) for case {case.id}")
            # This should not happen with the improved simulator, but log it if it does
        
        # Step 2: Store transactions in database
        logger.info(f"Storing {len(transactions_data)} transactions for case {case.id}")
        
        stored_transactions = []
        has_balance_columns = True  # Assume columns exist, will detect if they don't
        
        for txn_data in transactions_data:
            # Map transaction type
            txn_type_str = txn_data.get("transaction_type", "IMPS")
            try:
                txn_type = TransactionType(txn_type_str)
            except ValueError:
                txn_type = TransactionType.OTHER
            
            # Parse transaction timestamp
            txn_timestamp_str = txn_data.get("transaction_timestamp")
            if isinstance(txn_timestamp_str, str):
                txn_timestamp = datetime.fromisoformat(txn_timestamp_str.replace('Z', '+00:00'))
            else:
                txn_timestamp = datetime.utcnow()
            
            # Check if from_account or to_account is frozen (block transaction)
            from_account_num = txn_data.get("from_account")
            to_account_num = txn_data.get("to_account")
            
            # Check for frozen accounts (block transactions from/to frozen accounts)
            if from_account_num or to_account_num:
                from sqlalchemy import or_
                frozen_check = await db.execute(
                    select(func.count(FrozenAccount.id)).where(
                        FrozenAccount.is_active == True,
                        or_(
                            (FrozenAccount.account_number == from_account_num) if from_account_num else False,
                            (FrozenAccount.account_number == to_account_num) if to_account_num else False
                        )
                    )
                )
                frozen_count = frozen_check.scalar() or 0
                if frozen_count > 0:
                    logger.warning(f"Transaction blocked: Account frozen. From: {from_account_num}, To: {to_account_num}")
                    continue  # Skip this transaction - account is frozen
            
            # Create transaction - try with all fields first, fallback if columns missing
            try:
                transaction = Transaction(
                    case_id=case.id,
                    
                    # From account
                    from_account=from_account_num,
                    from_bank=txn_data.get("from_bank"),
                    from_ifsc=txn_data.get("from_ifsc"),
                    from_holder_name=txn_data.get("from_holder_name"),
                    # Balance fields (may not exist in DB yet)
                    from_balance_before=txn_data.get("from_balance_before"),
                    from_balance_after=txn_data.get("from_balance_after"),
                    from_location=txn_data.get("from_location"),
                    
                    # To account
                    to_account=txn_data.get("to_account"),
                    to_bank=txn_data.get("to_bank"),
                    to_ifsc=txn_data.get("to_ifsc"),
                    to_holder_name=txn_data.get("to_holder_name"),
                    # Balance fields (may not exist in DB yet)
                    to_balance_before=txn_data.get("to_balance_before"),
                    to_balance_after=txn_data.get("to_balance_after"),
                    to_location=txn_data.get("to_location"),
                    
                    # Amount
                    amount=txn_data.get("amount", 0.0),
                    
                    # Transaction details
                    transaction_type=txn_type.value,
                    transaction_id=txn_data.get("transaction_id"),
                    utr_number=txn_data.get("utr_number"),
                    
                    # Timestamp
                    transaction_timestamp=txn_timestamp,
                    
                    # Chain position
                    hop_number=txn_data.get("hop_number", 1),
                    
                    # Split information
                    split_group_id=txn_data.get("split_group_id"),
                    split_index=txn_data.get("split_index"),
                    split_total=txn_data.get("split_total"),
                    
                    # Status
                    status=TransactionStatus.COMPLETED.value
                )
            except Exception as create_error:
                # If creating transaction fails (e.g., column doesn't exist), create without new fields
                error_msg = str(create_error).lower()
                if "column" in error_msg or "does not exist" in error_msg:
                    logger.warning(f"Database columns missing, creating transaction without balance/location fields")
                    has_balance_columns = False
                    # Create transaction without new fields (balance/location/split)
                    # Only use core fields that definitely exist in the database
                    transaction = Transaction(
                        case_id=case.id,
                        from_account=txn_data.get("from_account"),
                        from_bank=txn_data.get("from_bank"),
                        from_ifsc=txn_data.get("from_ifsc"),
                        from_holder_name=txn_data.get("from_holder_name"),
                        to_account=txn_data.get("to_account"),
                        to_bank=txn_data.get("to_bank"),
                        to_ifsc=txn_data.get("to_ifsc"),
                        to_holder_name=txn_data.get("to_holder_name"),
                        amount=txn_data.get("amount", 0.0),
                        transaction_type=txn_type.value,
                        transaction_id=txn_data.get("transaction_id"),
                        utr_number=txn_data.get("utr_number"),
                        transaction_timestamp=txn_timestamp,
                        hop_number=txn_data.get("hop_number", 1),
                        # Don't set split fields if columns don't exist
                        # split_group_id, split_index, split_total will be None
                        status=TransactionStatus.COMPLETED.value
                    )
                else:
                    raise  # Re-raise if it's a different error
            
            db.add(transaction)
            stored_transactions.append(transaction)
        
        try:
            await db.commit()
        except Exception as commit_error:
            error_msg = str(commit_error).lower()
            if "column" in error_msg or "does not exist" in error_msg:
                logger.error(f"Database migration required: {commit_error}")
                await db.rollback()
                missing_cols = []
                if "split_group_id" in error_msg or "split_index" in error_msg:
                    missing_cols.append("split columns")
                if "balance" in error_msg or "location" in error_msg:
                    missing_cols.append("balance/location columns")
                
                migration_msg = "Database migration required. Please run:\n"
                if "split" in error_msg or not missing_cols:
                    migration_msg += "  python backend/scripts/add_split_columns.py\n"
                if "balance" in error_msg or "location" in error_msg or not missing_cols:
                    migration_msg += "  python backend/scripts/add_balance_location_columns.py\n"
                migration_msg += "\nOr execute SQL files in backend/migrations/ directory"
                
                raise Exception(migration_msg)
            raise
        
        # Refresh transactions to get IDs
        for txn in stored_transactions:
            await db.refresh(txn)
        
        logger.info(f"Stored {len(stored_transactions)} transactions for case {case.id}")
        
        # Step 3: Detect mule accounts using mule detector service
        logger.info(f"Detecting mule accounts for case {case.id}")
        
        # Prepare transaction data for mule detector
        txn_dicts = []
        for txn in stored_transactions:
            txn_dicts.append({
                "from_account": txn.from_account,
                "from_bank": txn.from_bank,
                "from_holder_name": txn.from_holder_name,
                "to_account": txn.to_account,
                "to_bank": txn.to_bank,
                "to_holder_name": txn.to_holder_name,
                "amount": txn.amount,
                "hop_number": txn.hop_number,
                "transaction_timestamp": txn.transaction_timestamp.isoformat()
            })
        
        # Detect mules
        # The method is defined as async but may not use await internally
        try:
            mule_predictions = await mule_detector.detect_mules_from_transactions(
                case_id=case.id,
                transactions=txn_dicts,
                threshold=0.5,
                victim_account=victim_account
            )
        except Exception as e:
            logger.error(f"Error in mule detection for case {case.id}: {e}")
            # Continue without mule detection - transactions are still stored
            mule_predictions = {}
        
        # Step 4: Store mule accounts in database
        logger.info(f"Storing mule accounts for case {case.id}")
        
        stored_mule_accounts = []
        account_amounts = {}  # Track amount received per account
        account_first_hop = {}  # Track first hop number for each account
        
        # Calculate amount received per account from transactions
        for txn in stored_transactions:
            to_acc = txn.to_account
            if to_acc and to_acc != victim_account:  # Exclude victim account
                if to_acc not in account_amounts:
                    account_amounts[to_acc] = 0.0
                    account_first_hop[to_acc] = txn.hop_number
                account_amounts[to_acc] += txn.amount
        
        # Create mule account records for ALL accounts that received money (not just detected mules)
        # This ensures we track all accounts in the chain, even if mule detection confidence is low
        all_receiving_accounts = set(account_amounts.keys())
        mule_detected_accounts = set(mule_predictions.keys())
        
        # Process accounts detected by mule detector
        for account_id, prediction in mule_predictions.items():
            # Skip victim account
            if account_id == victim_account:
                continue
            
            # Only create mule account if it's actually detected as a mule or has high risk
            is_mule = prediction.get("is_mule", False) if isinstance(prediction, dict) else False
            mule_prob = prediction.get("mule_probability", 0.0) if isinstance(prediction, dict) else 0.0
            
            # Find transaction details for this account
            account_txn = None
            for txn in stored_transactions:
                if txn.to_account == account_id:
                    account_txn = txn
                    break
            
            if not account_txn:
                logger.warning(f"No transaction found for account {account_id}, skipping")
                continue
            
            # Create mule account record (even if not high confidence, for tracking)
            mule_account = MuleAccount(
                case_id=case.id,
                
                # Account details
                account_number=account_id,
                bank_name=account_txn.to_bank or "Unknown",
                ifsc_code=account_txn.to_ifsc,
                holder_name=account_txn.to_holder_name,
                
                # Amount tracking
                amount_received=account_amounts.get(account_id, account_txn.amount),
                current_balance=account_amounts.get(account_id, account_txn.amount) * 0.8,  # Estimate 80% still in account
                
                # Status (ACTIVE by default, can be frozen later)
                status=MuleAccountStatus.ACTIVE.value,
                
                # AI Classification
                mule_confidence=mule_prob,
                risk_indicators={
                    "risk_score": prediction.get("risk_score", 0.0) if isinstance(prediction, dict) else 0.0,
                    "is_mule": is_mule,
                    "mule_probability": mule_prob
                },
                
                # Chain position (from transaction)
                hop_number=account_txn.hop_number
            )
            
            db.add(mule_account)
            stored_mule_accounts.append(mule_account)
        
        # Also create records for accounts that received money but weren't in mule_predictions
        # (This can happen if mule detection failed or account wasn't analyzed)
        for account_id in all_receiving_accounts - mule_detected_accounts:
            if account_id == victim_account:
                continue
            
            # Find transaction details for this account
            account_txn = None
            for txn in stored_transactions:
                if txn.to_account == account_id:
                    account_txn = txn
                    break
            
            if not account_txn:
                continue
            
            # Create mule account record with low confidence (needs review)
            mule_account = MuleAccount(
                case_id=case.id,
                
                # Account details
                account_number=account_id,
                bank_name=account_txn.to_bank or "Unknown",
                ifsc_code=account_txn.to_ifsc,
                holder_name=account_txn.to_holder_name,
                
                # Amount tracking
                amount_received=account_amounts.get(account_id, account_txn.amount),
                current_balance=account_amounts.get(account_id, account_txn.amount) * 0.8,  # Estimate 80% still in account
                
                # Status (ACTIVE by default)
                status=MuleAccountStatus.ACTIVE.value,
                
                # AI Classification (low confidence - needs manual review)
                mule_confidence=0.3,  # Default low confidence for accounts not analyzed
                risk_indicators={
                    "risk_score": 30.0,
                    "is_mule": False,  # Not confirmed
                    "mule_probability": 0.3,
                    "note": "Account not analyzed by mule detector"
                },
                
                # Chain position
                hop_number=account_first_hop.get(account_id, account_txn.hop_number)
            )
            
            db.add(mule_account)
            stored_mule_accounts.append(mule_account)
        
        await db.commit()
        
        # Refresh mule accounts to get IDs
        for mule in stored_mule_accounts:
            await db.refresh(mule)
        
        mule_count = len([m for m in stored_mule_accounts if m.mule_confidence and m.mule_confidence >= 0.5])
        
        # Calculate total amount in mule accounts (should match fraud_amount)
        total_in_mules = sum(m.amount_received for m in stored_mule_accounts)
        
        logger.info(f"Stored {len(stored_mule_accounts)} mule accounts for case {case.id} ({mule_count} with high confidence)")
        logger.info(f"Total amount in mule accounts: ₹{total_in_mules:.2f} (fraud_amount: ₹{case.fraud_amount:.2f})")
        
        return {
            "success": True,
            "transactions_traced": len(stored_transactions),
            "mule_accounts_detected": len(stored_mule_accounts),
            "mule_accounts_high_confidence": mule_count,
            "total_amount_traced": total_traced,
            "fraud_amount": case.fraud_amount,
            "transaction_ids": [str(txn.id) for txn in stored_transactions],
            "mule_account_ids": [str(mule.id) for mule in stored_mule_accounts]
        }
        
    except Exception as e:
        # Use str(case.id) to avoid SQLAlchemy lazy loading issues
        case_id_str = str(case.id)
        error_msg = str(e)
        logger.error(f"Error tracing money flow for case {case_id_str}: {error_msg}", exc_info=False)
        
        # Check if it's a database schema error
        error_msg_lower = error_msg.lower()
        if any(keyword in error_msg_lower for keyword in ["column", "does not exist", "undefinedcolumn", "split_group_id", "from_balance"]):
            logger.warning(f"Database migration required for case {case_id_str}")
            await db.rollback()
            return {
                "success": False,
                "error": "Database migration required. Please run:\n  python backend/scripts/add_split_columns.py\n  python backend/scripts/add_balance_location_columns.py",
                "transactions_traced": 0,
                "mule_accounts_detected": 0
            }
        
        await db.rollback()
        return {
            "success": False,
            "error": str(e),
            "transactions_traced": 0,
            "mule_accounts_detected": 0
        }

