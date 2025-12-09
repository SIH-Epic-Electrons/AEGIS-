/**
 * Shared utility functions for extracting and transforming mule account data
 * Ensures consistency across MoneyTrailScreen, MuleAccountsScreen, and CaseDetailScreen
 */

export interface MuleAccountFromTransaction {
  id: string;
  bank: string;
  bankName: string;
  accountNumber: string;
  amountReceived: number;
  currentBalance: number;
  accountHolder: string;
  ifscCode: string;
  accountAge: string;
  location: string;
  status: 'active' | 'withdrawn' | 'frozen';
  muleConfidence?: number;
  riskIndicators?: string[];
  hopNumber?: number;
}

/**
 * Extract mule accounts from transaction data
 * This ensures consistent data extraction across all screens
 */
export function extractMuleAccountsFromTransactions(
  transactions: any[],
  skipVictimAccount: boolean = true
): MuleAccountFromTransaction[] {
  const accountMap = new Map<string, MuleAccountFromTransaction>();

  transactions.forEach((txn: any) => {
    const toAccount = txn.to_account;
    
    // Skip if no destination account
    if (!toAccount) return;
    
    // Skip victim account if requested
    if (skipVictimAccount && txn.from_account && txn.from_account.toLowerCase().includes('victim')) {
      return;
    }

    if (!accountMap.has(toAccount)) {
      // Use actual balance from transaction if available, otherwise use amount as estimate
      const balance = txn.to_balance_after !== undefined && txn.to_balance_after !== null
        ? txn.to_balance_after
        : (txn.amount || 0); // Use amount as balance estimate if balance not available

      accountMap.set(toAccount, {
        id: toAccount,
        bank: txn.to_bank || 'Unknown',
        bankName: txn.to_bank || 'Unknown Bank',
        accountNumber: toAccount ? `XXXX${String(toAccount).slice(-4)}` : 'N/A',
        amountReceived: txn.amount || 0,
        currentBalance: balance,
        accountHolder: txn.to_holder_name || 'Unknown',
        ifscCode: txn.to_ifsc || txn.to_ifsc_code || 'XXXX0000000',
        accountAge: 'Unknown', // Could be calculated from account creation date if available
        location: txn.to_location 
          ? `${txn.to_location.city || ''}, ${txn.to_location.state || ''}`.trim() || 'Unknown'
          : 'Unknown',
        status: (txn.status === 'FROZEN' ? 'frozen' : txn.status === 'WITHDRAWN' ? 'withdrawn' : 'active') as 'active' | 'withdrawn' | 'frozen',
    muleConfidence: txn.mule_confidence,
    riskIndicators: txn.risk_indicators,
        hopNumber: txn.hop_number || 0,
      });
    } else {
      // Update existing account: accumulate amount and use latest balance (highest hop number)
      const existing = accountMap.get(toAccount)!;
      const existingHop = existing.hopNumber || 0;
      
      // Update balance if this transaction has a higher hop number (more recent)
      if (txn.hop_number > existingHop && txn.to_balance_after !== undefined && txn.to_balance_after !== null) {
        existing.currentBalance = txn.to_balance_after;
        existing.hopNumber = txn.hop_number;
      }
      
      // Accumulate amount received
      existing.amountReceived += txn.amount || 0;
      
      // Update status if frozen or withdrawn
      if (txn.status === 'FROZEN' && existing.status !== 'frozen') {
        existing.status = 'frozen';
      } else if (txn.status === 'WITHDRAWN' && existing.status !== 'withdrawn') {
        existing.status = 'withdrawn';
      }
    }
  });

  return Array.from(accountMap.values());
}

/**
 * Transform API mule account response to consistent format
 */
export function transformApiMuleAccount(acc: any): MuleAccountFromTransaction {
  return {
    id: acc.id || acc.account_number || `acc-${Math.random()}`,
    bank: acc.bank_name || acc.bank || 'Unknown',
    bankName: acc.bank_name || acc.bank || 'Unknown Bank',
    accountNumber: acc.account_number ? `XXXX${String(acc.account_number).slice(-4)}` : 'N/A',
    amountReceived: acc.amount_received || 0,
    currentBalance: acc.current_balance || 0,
    accountHolder: acc.holder_name || acc.account_holder_name || 'Unknown',
    ifscCode: acc.ifsc_code || acc.ifsc || 'XXXX0000000',
    accountAge: acc.account_age_days 
      ? `${acc.account_age_days} days${acc.account_age_days < 30 ? ' (New)' : ''}`
      : 'Unknown',
    location: (acc.registered_city && acc.registered_state) 
      ? `${acc.registered_city}, ${acc.registered_state}`
      : (acc.city && acc.state)
      ? `${acc.city}, ${acc.state}`
      : 'Unknown',
    status: (acc.status === 'FROZEN' ? 'frozen' : acc.status === 'WITHDRAWN' ? 'withdrawn' : 'active') as 'active' | 'withdrawn' | 'frozen',
    muleConfidence: acc.mule_confidence || acc.confidence || acc.mule_confidence_score,
    riskIndicators: acc.risk_indicators || acc.risk_flags || [],
    hopNumber: acc.hop_number,
  };
}

