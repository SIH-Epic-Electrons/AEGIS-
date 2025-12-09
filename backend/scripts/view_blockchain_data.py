#!/usr/bin/env python3
"""
Blockchain Data Viewer Script

This script allows you to view prediction data stored on Hyperledger Fabric blockchain.

Usage:
    python scripts/view_blockchain_data.py <command> [arguments]

Commands:
    get <case_id>              - Get a specific prediction by case ID
    query <start_date> <end_date> - Query predictions by date range
    history <case_id>          - Get prediction history for a case
    list                       - List all predictions (use with caution)

Examples:
    python scripts/view_blockchain_data.py get 123e4567-e89b-12d3-a456-426614174000
    python scripts/view_blockchain_data.py query 2025-01-01T00:00:00Z 2025-12-31T23:59:59Z
    python scripts/view_blockchain_data.py history 123e4567-e89b-12d3-a456-426614174000
"""

import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path
from uuid import UUID

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.blockchain_service import get_blockchain_service
from app.core.config import settings


def print_json(data, indent=2):
    """Pretty print JSON data"""
    print(json.dumps(data, indent=indent, default=str))


async def get_prediction(case_id: str):
    """Get a specific prediction"""
    try:
        uuid_obj = UUID(case_id)
    except ValueError:
        print(f"Error: Invalid UUID format: {case_id}")
        return
    
    blockchain_service = get_blockchain_service()
    prediction = await blockchain_service.get_prediction(uuid_obj)
    
    if prediction:
        print(f"\n✅ Prediction found for case: {case_id}\n")
        print_json(prediction)
    else:
        print(f"❌ No prediction found for case: {case_id}")


async def query_by_date_range(start_date: str, end_date: str):
    """Query predictions by date range"""
    try:
        start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
    except ValueError as e:
        print(f"Error: Invalid date format: {e}")
        print("Use ISO format: YYYY-MM-DDTHH:MM:SSZ (e.g., 2025-01-01T00:00:00Z)")
        return
    
    blockchain_service = get_blockchain_service()
    predictions = await blockchain_service.query_by_date_range(start_dt, end_dt)
    
    print(f"\n✅ Found {len(predictions)} predictions between {start_date} and {end_date}\n")
    print_json(predictions)


async def get_history(case_id: str):
    """Get prediction history"""
    try:
        uuid_obj = UUID(case_id)
    except ValueError:
        print(f"Error: Invalid UUID format: {case_id}")
        return
    
    blockchain_service = get_blockchain_service()
    history = await blockchain_service.get_prediction_history(uuid_obj)
    
    if history:
        print(f"\n✅ Found {len(history)} version(s) for case: {case_id}\n")
        for idx, version in enumerate(history, 1):
            print(f"\n--- Version {idx} ---")
            print_json(version)
    else:
        print(f"❌ No history found for case: {case_id}")


async def list_all():
    """List all predictions (use with caution)"""
    print("⚠️  Warning: This will query all predictions. This may take a while...")
    response = input("Continue? (yes/no): ")
    if response.lower() != 'yes':
        print("Cancelled.")
        return
    
    # Note: This function doesn't exist in the service, so we'll need to add it
    # For now, just show a message
    print("❌ List all function not yet implemented. Use date range query instead.")


async def main():
    """Main function"""
    if not settings.blockchain_enabled:
        print("❌ Error: Blockchain is not enabled.")
        print("Set BLOCKCHAIN_ENABLED=true in your .env file or environment variables.")
        sys.exit(1)
    
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    try:
        if command == "get":
            if len(sys.argv) < 3:
                print("Error: Missing case_id argument")
                print("Usage: python scripts/view_blockchain_data.py get <case_id>")
                sys.exit(1)
            await get_prediction(sys.argv[2])
        
        elif command == "query":
            if len(sys.argv) < 4:
                print("Error: Missing date arguments")
                print("Usage: python scripts/view_blockchain_data.py query <start_date> <end_date>")
                sys.exit(1)
            await query_by_date_range(sys.argv[2], sys.argv[3])
        
        elif command == "history":
            if len(sys.argv) < 3:
                print("Error: Missing case_id argument")
                print("Usage: python scripts/view_blockchain_data.py history <case_id>")
                sys.exit(1)
            await get_history(sys.argv[2])
        
        elif command == "list":
            await list_all()
        
        else:
            print(f"Error: Unknown command: {command}")
            print(__doc__)
            sys.exit(1)
    
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

