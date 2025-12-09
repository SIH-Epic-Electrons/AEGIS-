"""
Neo4j Graph Service for Money Flow Visualization
Creates and queries graph database for transaction networks
"""

import logging
import random
from typing import List, Dict, Optional
from uuid import UUID
from datetime import datetime

from app.db.neo4j import Neo4jConnection

logger = logging.getLogger(__name__)


class Neo4jGraphService:
    """Service for managing money flow graphs in Neo4j"""
    
    @staticmethod
    def create_case_graph(case_id: UUID, transactions: List[Dict], mule_predictions: Optional[Dict] = None):
        """
        Create graph for a case showing money flow.
        
        Args:
            case_id: Case identifier
            transactions: List of transaction dictionaries
            mule_predictions: Optional dict mapping account_id -> mule_probability
        """
        try:
            # Create case node
            case_query = """
            MERGE (c:Case {case_id: $case_id})
            SET c.case_number = $case_number,
                c.fraud_amount = $fraud_amount,
                c.created_at = $created_at
            """
            
            case_number = f"MH-2025-{random.randint(10000, 99999)}"
            fraud_amount = transactions[0]["amount"] if transactions else 0
            
            Neo4jConnection.execute_write(
                case_query,
                {
                    "case_id": str(case_id),
                    "case_number": case_number,
                    "fraud_amount": fraud_amount,
                    "created_at": datetime.utcnow().isoformat()
                }
            )
            
            # Create account nodes and transaction edges
            for txn in transactions:
                # From account node
                from_query = """
                MERGE (a1:Account {account_id: $from_account})
                SET a1.account_number = $from_account_number,
                    a1.bank = $from_bank,
                    a1.ifsc = $from_ifsc,
                    a1.holder_name = $from_holder,
                    a1.is_mule = $from_is_mule,
                    a1.mule_probability = $from_mule_prob,
                    a1.risk_score = $from_risk_score
                """
                
                # IMPORTANT: First account in chain is always the victim (never a mule)
                is_from_victim = txn["from_account"] == transactions[0].get("from_account") if transactions else False
                from_is_mule = 0  # Victim is never a mule
                from_mule_prob = 0.0  # Victim has 0% mule probability
                from_risk_score = 0.0  # Victim has 0 risk score
                
                if mule_predictions and not is_from_victim:
                    from_pred = mule_predictions.get(txn["from_account"], {})
                    from_is_mule = 1 if from_pred.get("is_mule", False) else 0
                    from_mule_prob = from_pred.get("mule_probability", 0.0)
                    from_risk_score = from_pred.get("risk_score", 0.0)
                
                Neo4jConnection.execute_write(
                    from_query,
                    {
                        "from_account": txn["from_account"],
                        "from_account_number": txn.get("from_account_number", txn["from_account"]),
                        "from_bank": txn["from_bank"],
                        "from_ifsc": txn.get("from_ifsc", ""),
                        "from_holder": txn.get("from_holder_name", ""),
                        "from_is_mule": from_is_mule,
                        "from_mule_prob": from_mule_prob,
                        "from_risk_score": from_risk_score
                    }
                )
                
                # To account node
                to_query = """
                MERGE (a2:Account {account_id: $to_account})
                SET a2.account_number = $to_account_number,
                    a2.bank = $to_bank,
                    a2.ifsc = $to_ifsc,
                    a2.holder_name = $to_holder,
                    a2.is_mule = $to_is_mule,
                    a2.mule_probability = $to_mule_prob,
                    a2.risk_score = $to_risk_score
                """
                
                to_is_mule = 0
                to_mule_prob = 0.0
                to_risk_score = 0.0
                
                if mule_predictions:
                    to_pred = mule_predictions.get(txn["to_account"], {})
                    # Ensure victim accounts are never marked as mules
                    is_victim = txn["to_account"] == transactions[0].get("from_account") if transactions else False
                    to_is_mule = 0 if is_victim else (1 if to_pred.get("is_mule", False) else 0)
                    to_mule_prob = 0.0 if is_victim else to_pred.get("mule_probability", 0.0)
                    to_risk_score = 0.0 if is_victim else to_pred.get("risk_score", 0.0)
                
                Neo4jConnection.execute_write(
                    to_query,
                    {
                        "to_account": txn["to_account"],
                        "to_account_number": txn.get("to_account_number", txn["to_account"]),
                        "to_bank": txn["to_bank"],
                        "to_ifsc": txn.get("to_ifsc", ""),
                        "to_holder": txn.get("to_holder_name", ""),
                        "to_is_mule": to_is_mule,
                        "to_mule_prob": to_mule_prob,
                        "to_risk_score": to_risk_score
                    }
                )
                
                # Transaction edge
                txn_query = """
                MATCH (a1:Account {account_id: $from_account})
                MATCH (a2:Account {account_id: $to_account})
                MERGE (a1)-[t:TRANSFERRED_TO {
                    transaction_id: $txn_id,
                    case_id: $case_id
                }]->(a2)
                SET t.amount = $amount,
                    t.transaction_type = $txn_type,
                    t.timestamp = $timestamp,
                    t.hop_number = $hop_number,
                    t.utr_number = $utr_number
                """
                
                Neo4jConnection.execute_write(
                    txn_query,
                    {
                        "from_account": txn["from_account"],
                        "to_account": txn["to_account"],
                        "txn_id": txn.get("transaction_id", ""),
                        "case_id": str(case_id),
                        "amount": txn["amount"],
                        "txn_type": txn.get("transaction_type", "IMPS"),
                        "timestamp": txn.get("transaction_timestamp", datetime.utcnow().isoformat()),
                        "hop_number": txn.get("hop_number", 1),
                        "utr_number": txn.get("utr_number", "")
                    }
                )
            
            # Link case to first account (victim)
            if transactions:
                link_query = """
                MATCH (c:Case {case_id: $case_id})
                MATCH (a:Account {account_id: $victim_account})
                MERGE (c)-[:VICTIM_OF]->(a)
                """
                
                Neo4jConnection.execute_write(
                    link_query,
                    {
                        "case_id": str(case_id),
                        "victim_account": transactions[0]["from_account"]
                    }
                )
            
            logger.info(f"Created graph for case {case_id} with {len(transactions)} transactions")
            
        except Exception as e:
            logger.error(f"Error creating graph for case {case_id}: {e}")
            raise
    
    @staticmethod
    def get_case_graph(case_id: UUID) -> Dict:
        """
        Get graph data for a case.
        
        Returns:
            Dictionary with nodes and edges for visualization
        """
        try:
            query = """
            MATCH (c:Case {case_id: $case_id})
            OPTIONAL MATCH path = (c)-[:VICTIM_OF]->(victim:Account)
            OPTIONAL MATCH (victim)-[txns:TRANSFERRED_TO*]->(account:Account)
            RETURN c, victim, account, txns
            """
            
            # Alternative query to get all nodes and edges
            full_query = """
            MATCH (c:Case {case_id: $case_id})
            OPTIONAL MATCH (c)-[:VICTIM_OF]->(victim:Account)
            OPTIONAL MATCH (victim)-[t:TRANSFERRED_TO*]->(a:Account)
            WITH c, collect(DISTINCT victim) + collect(DISTINCT a) as accounts, 
                 collect(DISTINCT t) as transactions
            RETURN c, accounts, transactions
            """
            
            # Query to get transaction chain in order (follows hop_number sequence)
            # This ensures: Victim → Account1 → Account2 → Account3 (chain, not star)
            viz_query = """
            MATCH (c:Case {case_id: $case_id})
            OPTIONAL MATCH (c)-[:VICTIM_OF]->(victim:Account)
            OPTIONAL MATCH path = (victim)-[txns:TRANSFERRED_TO* {case_id: $case_id}]->(end:Account)
            WHERE ALL(rel IN relationships(path) WHERE rel.case_id = $case_id)
            WITH c, victim, path, relationships(path) as rels
            ORDER BY length(path) DESC
            LIMIT 1
            WITH c, victim, 
                 [node IN nodes(path) WHERE node IS NOT NULL] as chain_nodes,
                 [rel IN rels WHERE rel IS NOT NULL] as chain_rels
            UNWIND chain_nodes as node
            WITH c, collect(DISTINCT {
                id: id(node),
                account_id: node.account_id,
                account_number: node.account_number,
                bank: node.bank,
                holder_name: node.holder_name,
                is_mule: node.is_mule,
                mule_probability: node.mule_probability,
                risk_score: node.risk_score,
                label: CASE 
                    WHEN node.is_mule = 1 THEN 'Mule Account'
                    WHEN EXISTS((c)-[:VICTIM_OF]->(node)) THEN 'Victim'
                    ELSE 'Account'
                END
            }) as nodes,
            [rel IN chain_rels | {
                source: id(startNode(rel)),
                target: id(endNode(rel)),
                amount: rel.amount,
                transaction_type: rel.transaction_type,
                hop_number: rel.hop_number,
                timestamp: rel.timestamp
            }] as edges
            RETURN nodes, edges
            """
            
            # Use the visualization query
            results = Neo4jConnection.execute_query(
                viz_query,
                {"case_id": str(case_id)}
            )
            
            if results and len(results) > 0:
                result = results[0]
                nodes = result.get("nodes", [])
                edges = result.get("edges", [])
                
                return {
                    "nodes": nodes if nodes else [],
                    "edges": edges if edges else [],
                    "case_id": str(case_id)
                }
            
            return {"nodes": [], "edges": [], "case_id": str(case_id)}
            
        except Exception as e:
            logger.error(f"Error getting graph for case {case_id}: {e}")
            return {"nodes": [], "edges": [], "case_id": str(case_id), "error": str(e)}
    
    @staticmethod
    def get_mule_network(account_id: str) -> Dict:
        """
        Get network of accounts connected to a mule account.
        
        Returns:
            Dictionary with connected accounts and transactions across all cases
        """
        try:
            # Find all accounts connected to this mule (both directions)
            query = """
            MATCH (mule:Account {account_id: $account_id})
            OPTIONAL MATCH (mule)-[t1:TRANSFERRED_TO]->(outgoing:Account)
            OPTIONAL MATCH (incoming:Account)-[t2:TRANSFERRED_TO]->(mule)
            WITH mule, 
                 collect(DISTINCT outgoing) + collect(DISTINCT incoming) as all_connected,
                 collect(DISTINCT t1) + collect(DISTINCT t2) as all_transactions
            UNWIND all_connected as acc
            WHERE acc IS NOT NULL
            WITH mule, 
                 collect(DISTINCT {
                     account_id: acc.account_id,
                     account_number: acc.account_number,
                     bank: acc.bank,
                     holder_name: acc.holder_name,
                     is_mule: acc.is_mule,
                     mule_probability: acc.mule_probability,
                     risk_score: acc.risk_score
                 }) as connected_accounts,
                 [t IN all_transactions WHERE t IS NOT NULL | {
                     from_account: startNode(t).account_id,
                     to_account: endNode(t).account_id,
                     amount: t.amount,
                     transaction_type: t.transaction_type,
                     hop_number: t.hop_number,
                     timestamp: t.timestamp,
                     case_id: t.case_id
                 }] as transactions
            RETURN {
                mule_account: {
                    account_id: mule.account_id,
                    account_number: mule.account_number,
                    bank: mule.bank,
                    holder_name: mule.holder_name,
                    is_mule: mule.is_mule,
                    mule_probability: mule.mule_probability,
                    risk_score: mule.risk_score
                },
                connected_accounts: connected_accounts,
                transactions: transactions,
                network_size: size(connected_accounts)
            } as network
            """
            
            results = Neo4jConnection.execute_query(
                query,
                {"account_id": account_id}
            )
            
            if results and len(results) > 0:
                return results[0].get("network", {})
            
            return {
                "mule_account": None,
                "connected_accounts": [],
                "transactions": [],
                "network_size": 0
            }
            
        except Exception as e:
            logger.error(f"Error getting mule network for {account_id}: {e}")
            return {
                "mule_account": None,
                "connected_accounts": [],
                "transactions": [],
                "network_size": 0,
                "error": str(e)
            }

