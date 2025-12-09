#!/usr/bin/env python3
"""
Simple Blockchain Monitor

A simpler version that doesn't require rich library.
Shows real-time blockchain operations in console.

Usage:
    python scripts/simple_blockchain_monitor.py
"""

import time
import sys
import json
from datetime import datetime
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    import requests
except ImportError:
    print("Error: 'requests' library not installed.")
    print("Install it with: pip install requests")
    sys.exit(1)


def get_recent_operations(base_url="http://localhost:8000", limit=10, token=None):
    """Get recent blockchain operations"""
    try:
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        
        response = requests.get(
            f"{base_url}/api/v1/predictions/blockchain/monitor/recent",
            params={"limit": limit},
            headers=headers,
            timeout=5
        )
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        return None


def get_status(base_url="http://localhost:8000", token=None):
    """Get blockchain status"""
    try:
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        
        response = requests.get(
            f"{base_url}/api/v1/predictions/blockchain/monitor/live",
            headers=headers,
            timeout=5
        )
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        return None


def format_timestamp(timestamp_str):
    """Format ISO timestamp to readable format"""
    try:
        dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        return dt.strftime("%H:%M:%S")
    except:
        return timestamp_str[:19] if len(timestamp_str) > 19 else timestamp_str


def print_header():
    """Print header"""
    print("\n" + "="*80)
    print("🔗 AEGIS BLOCKCHAIN REAL-TIME MONITOR")
    print("="*80)


def print_status(status_data):
    """Print status"""
    if not status_data:
        print("❌ Cannot connect to API")
        return
    
    enabled = status_data.get("blockchain_enabled", False)
    service_enabled = status_data.get("service_enabled", False)
    
    if enabled and service_enabled:
        print("✅ Blockchain: ENABLED & ACTIVE")
    elif enabled:
        print("⚠️  Blockchain: ENABLED (Service Not Ready)")
    else:
        print("❌ Blockchain: DISABLED")
    
    last_op = status_data.get("last_operation")
    if last_op:
        print(f"📝 Last Operation: {format_timestamp(last_op.get('timestamp', ''))}")
        print(f"   Case ID: {last_op.get('case_id', 'N/A')}")
        print(f"   Status: {last_op.get('status', 'N/A')}")


def print_operations(operations_data):
    """Print recent operations"""
    print("\n" + "-"*80)
    print("🔄 RECENT OPERATIONS")
    print("-"*80)
    
    if not operations_data or not operations_data.get("operations"):
        print("No operations yet")
        return
    
    print(f"{'Time':<10} {'Case ID':<36} {'Status':<10} {'Details'}")
    print("-"*80)
    
    for op in operations_data["operations"][:10]:
        timestamp = format_timestamp(op.get("timestamp", ""))
        case_id = op.get("case_id", "N/A")
        status = op.get("status", "unknown")
        details = op.get("details", {})
        
        status_icon = "✅" if status == "success" else "❌"
        details_str = ""
        if details:
            if "locations_count" in details:
                details_str = f"Locations: {details['locations_count']}"
            if "confidence" in details:
                details_str += f", Confidence: {details['confidence']:.2%}"
        
        print(f"{timestamp:<10} {case_id[:36]:<36} {status_icon} {status:<8} {details_str}")
    
    print("-"*80)


def main():
    """Main monitoring loop"""
    print_header()
    print("Starting monitor... (Press Ctrl+C to stop)")
    print("="*80)
    
    base_url = "http://localhost:8000"
    token = None  # Add token if needed
    
    try:
        last_count = 0
        while True:
            # Clear screen (works on most terminals)
            print("\033[2J\033[H", end="")  # Clear screen and move cursor to top
            
            print_header()
            print(f"Last Updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print("="*80)
            
            # Get status
            status_data = get_status(base_url, token)
            print_status(status_data)
            
            # Get operations
            operations_data = get_recent_operations(base_url, limit=10, token=token)
            print_operations(operations_data)
            
            # Show if new operations
            current_count = len(operations_data.get("operations", [])) if operations_data else 0
            if current_count > last_count:
                print(f"\n🆕 New operation detected! ({current_count - last_count} new)")
            last_count = current_count
            
            print("\n" + "="*80)
            print("Refreshing in 2 seconds... (Ctrl+C to stop)")
            
            time.sleep(2)
            
    except KeyboardInterrupt:
        print("\n\n✅ Monitoring stopped by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()

