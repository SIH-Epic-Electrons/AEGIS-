#!/usr/bin/env python3
"""
Real-time Blockchain Monitoring Script

Monitors blockchain storage operations in real-time while the application is running.

Usage:
    python scripts/monitor_blockchain_live.py

This script will:
- Show real-time blockchain storage operations
- Display statistics
- Monitor API endpoint for recent operations
"""

import asyncio
import sys
import time
from datetime import datetime
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import requests
from rich.console import Console
from rich.table import Table
from rich.live import Live
from rich.panel import Panel
from rich.layout import Layout
from rich.text import Text

console = Console()


def get_blockchain_status(base_url: str = "http://localhost:8000", token: str = None):
    """Get blockchain status from API"""
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


def get_recent_operations(base_url: str = "http://localhost:8000", limit: int = 10, token: str = None):
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


def get_stats(base_url: str = "http://localhost:8000", hours: int = 24, token: str = None):
    """Get blockchain statistics"""
    try:
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        
        response = requests.get(
            f"{base_url}/api/v1/predictions/blockchain/monitor/stats",
            params={"hours": hours},
            headers=headers,
            timeout=5
        )
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        return None


def create_status_panel(status_data):
    """Create status panel"""
    if not status_data:
        return Panel("[red]❌ Cannot connect to API[/red]", title="Status", border_style="red")
    
    enabled = status_data.get("blockchain_enabled", False)
    service_enabled = status_data.get("service_enabled", False)
    last_op = status_data.get("last_operation")
    
    status_text = Text()
    if enabled and service_enabled:
        status_text.append("✅ ", style="green")
        status_text.append("Blockchain Enabled & Active\n", style="green")
    elif enabled:
        status_text.append("⚠️ ", style="yellow")
        status_text.append("Blockchain Enabled (Service Not Ready)\n", style="yellow")
    else:
        status_text.append("❌ ", style="red")
        status_text.append("Blockchain Disabled\n", style="red")
    
    if last_op:
        status_text.append(f"\nLast Operation: {last_op.get('timestamp', 'N/A')}\n", style="cyan")
        status_text.append(f"Case ID: {last_op.get('case_id', 'N/A')}\n", style="cyan")
        status_text.append(f"Status: {last_op.get('status', 'N/A')}", style="cyan")
    
    return Panel(status_text, title="🔗 Blockchain Status", border_style="cyan")


def create_stats_panel(stats_data):
    """Create statistics panel"""
    if not stats_data:
        return Panel("[yellow]No statistics available[/yellow]", title="Statistics", border_style="yellow")
    
    stats_text = Text()
    stats_text.append(f"Period: {stats_data.get('period_hours', 0)} hours\n", style="bold")
    stats_text.append(f"Total Operations: {stats_data.get('total_operations', 0)}\n", style="cyan")
    stats_text.append(f"✅ Successful: {stats_data.get('successful', 0)}\n", style="green")
    stats_text.append(f"❌ Failed: {stats_data.get('failed', 0)}\n", style="red")
    stats_text.append(f"Success Rate: {stats_data.get('success_rate', 0):.1f}%", style="bold")
    
    return Panel(stats_text, title="📊 Statistics", border_style="blue")


def create_operations_table(operations_data):
    """Create operations table"""
    table = Table(title="🔄 Recent Operations", show_header=True, header_style="bold magenta")
    table.add_column("Time", style="cyan", width=20)
    table.add_column("Case ID", style="green", width=36)
    table.add_column("Status", width=10)
    table.add_column("Details", style="yellow", width=30)
    
    if not operations_data or not operations_data.get("operations"):
        table.add_row("No operations", "", "", "")
        return table
    
    for op in operations_data["operations"][:10]:
        timestamp = op.get("timestamp", "")
        if timestamp:
            try:
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                time_str = dt.strftime("%H:%M:%S")
            except:
                time_str = timestamp[:19] if len(timestamp) > 19 else timestamp
        else:
            time_str = "N/A"
        
        case_id = op.get("case_id", "N/A")
        status = op.get("status", "unknown")
        details = op.get("details", {})
        
        status_style = "green" if status == "success" else "red"
        details_str = f"Locations: {details.get('locations_count', 'N/A')}" if details else ""
        
        table.add_row(time_str, case_id[:36], f"[{status_style}]{status}[/{status_style}]", details_str)
    
    return table


def create_layout(status_data, stats_data, operations_data):
    """Create main layout"""
    layout = Layout()
    
    layout.split_column(
        Layout(name="header", size=3),
        Layout(name="body"),
        Layout(name="footer", size=7)
    )
    
    layout["body"].split_row(
        Layout(create_status_panel(status_data), name="status"),
        Layout(create_stats_panel(stats_data), name="stats")
    )
    
    layout["header"].update(Panel(
        "[bold cyan]🔗 AEGIS Blockchain Real-Time Monitor[/bold cyan]\n"
        f"[dim]Last Updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}[/dim]",
        border_style="cyan"
    ))
    
    layout["footer"].update(create_operations_table(operations_data))
    
    return layout


def main():
    """Main monitoring loop"""
    console.print("[bold cyan]Starting Blockchain Real-Time Monitor...[/bold cyan]")
    console.print("[dim]Press Ctrl+C to stop[/dim]\n")
    
    # Get token from environment or user input
    token = None
    base_url = "http://localhost:8000"
    
    try:
        with Live(create_layout(None, None, None), refresh_per_second=2, screen=True) as live:
            while True:
                # Fetch data
                status_data = get_blockchain_status(base_url, token)
                stats_data = get_stats(base_url, hours=24, token=token)
                operations_data = get_recent_operations(base_url, limit=10, token=token)
                
                # Update display
                live.update(create_layout(status_data, stats_data, operations_data))
                
                time.sleep(2)  # Update every 2 seconds
                
    except KeyboardInterrupt:
        console.print("\n[yellow]Monitoring stopped by user[/yellow]")
    except Exception as e:
        console.print(f"\n[red]Error: {e}[/red]")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    # Check if rich is installed
    try:
        import rich
    except ImportError:
        print("Error: 'rich' library not installed.")
        print("Install it with: pip install rich")
        sys.exit(1)
    
    main()

