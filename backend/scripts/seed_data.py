"""
Database Seeder - Populates test data for API development and testing.
Run this after database init to test endpoints and understand response structures.
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).parent.parent))

import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgresql import AsyncSessionLocal, init_db
from app.models.officer import Officer
from app.models.station import PoliceStation
from app.models.team import Team
from app.models.atm import ATM
from app.models.case import Case
from app.models.mule_account import MuleAccount
from app.models.transaction import Transaction
from app.core.security import get_password_hash

# Path to processed data files (ATM locations, fraud cases)
DATA_DIR = Path(__file__).parent.parent / "data" / "processed"


async def seed_stations(db: AsyncSession) -> list:
    """
    Creates police stations that officers belong to.
    Stations define jurisdiction areas for case assignment and team deployment.
    """
    stations = [
        # Mumbai station - primary test station for development
        PoliceStation(
            name="Mumbai Cyber Crime Cell",
            code="MH-CYB-MUM",
            city="Mumbai",
            state="Maharashtra",
            district="Mumbai Suburban",
            pincode="400051",
            address="BKC Complex, Bandra Kurla Complex",
            latitude=19.0596,
            longitude=72.8656,
            phone="022-26570111",
            email="cybercrime.mumbai@mhpolice.gov.in"
        ),
        # Delhi station - tests multi-station scenarios
        PoliceStation(
            name="Delhi Cyber Crime Unit",
            code="DL-CYB-DEL",
            city="Delhi",
            state="Delhi",
            district="Central Delhi",
            pincode="110001",
            address="Police HQ, ITO",
            latitude=28.6280,
            longitude=77.2412,
            phone="011-23490000",
            email="cybercrime@delhipolice.gov.in"
        ),
        # Bangalore station - third city for geographic spread
        PoliceStation(
            name="Bangalore Cyber Crime Station",
            code="KA-CYB-BLR",
            city="Bangalore",
            state="Karnataka",
            district="Bangalore Urban",
            pincode="560001",
            address="CID Building, Carlton House",
            latitude=12.9716,
            longitude=77.5946,
            phone="080-22942222",
            email="cybercrime.blr@ksp.gov.in"
        ),
    ]
    
    for station in stations:
        db.add(station)
    
    await db.commit()
    
    # Refresh to get auto-generated IDs (needed for foreign key relationships)
    for station in stations:
        await db.refresh(station)
    
    print(f"✓ Created {len(stations)} police stations")
    return stations


async def seed_officers(db: AsyncSession, stations: list) -> list:
    """
    Creates officer accounts for authentication testing.
    Use badge_id + password to login via /api/v1/auth/login endpoint.
    """
    officers = [
        # Admin account - for system administration
        Officer(
            badge_id="admin",
            name="System Administrator",
            email="admin@aegis.gov.in",
            password_hash=get_password_hash("admin123"),
            phone="+91 99999 99999",
            rank="System Admin",
            designation="Administrator",
            station_id=stations[0].id,  # Links to Mumbai station
            is_active=True,
            is_verified=True,
            settings={"notifications_enabled": True, "dark_mode": False}
        ),
        # Primary test account - use this for most API testing
        Officer(
            badge_id="MH-CYB-2024-001",
            name="SI Priya Sharma",
            email="priya.sharma@mhpolice.gov.in",
            password_hash=get_password_hash("password123"),
            phone="+91 98765 43210",
            rank="Sub Inspector",
            designation="Cyber Crime Investigator",
            station_id=stations[0].id,  # Links to Mumbai station
            is_active=True,
            is_verified=True,
            settings={"notifications_enabled": True, "dark_mode": False}
        ),
        # Field officer - tests team leadership assignment
        Officer(
            badge_id="MH-CYB-2024-002",
            name="ASI Rahul Verma",
            email="rahul.verma@mhpolice.gov.in",
            password_hash=get_password_hash("password123"),
            phone="+91 98765 12345",
            rank="Assistant Sub Inspector",
            designation="Field Officer",
            station_id=stations[0].id,
            is_active=True,
            is_verified=True
        ),
        # Delhi officer - tests cross-station scenarios
        Officer(
            badge_id="DL-CYB-2024-001",
            name="SI Amit Patil",
            email="amit.patil@delhipolice.gov.in",
            password_hash=get_password_hash("password123"),
            phone="+91 99887 76543",
            rank="Sub Inspector",
            station_id=stations[1].id,  # Links to Delhi station
            is_active=True,
            is_verified=True
        ),
    ]
    
    for officer in officers:
        db.add(officer)
    
    await db.commit()
    
    for officer in officers:
        await db.refresh(officer)
    
    print(f"✓ Created {len(officers)} officers")
    return officers


async def seed_teams(db: AsyncSession, stations: list, officers: list) -> list:
    """
    Creates field teams that get deployed to predicted ATM locations.
    Teams have status (AVAILABLE/EN_ROUTE/ON_SITE) and GPS coordinates.
    """
    teams = [
        # Available team - can be assigned to new cases
        Team(
            team_code="TF-A",
            team_name="Task Force Alpha",
            station_id=stations[0].id,
            leader_id=officers[1].id,  # Rahul Verma leads this team
            status="AVAILABLE",
            current_lat=19.1136,  # Andheri area
            current_lon=72.8697,
            radio_channel="Channel 5",
            members_count=4,
            vehicle_number="MH-01-CY-1234"
        ),
        # Second available team - tests team selection by proximity
        Team(
            team_code="TF-B",
            team_name="Task Force Bravo",
            station_id=stations[0].id,
            status="AVAILABLE",
            current_lat=19.0760,  # Bandra area
            current_lon=72.8777,
            radio_channel="Channel 7",
            members_count=3,
            vehicle_number="MH-01-CY-5678"
        ),
        # Busy team - tests filtering by status
        Team(
            team_code="U-7",
            team_name="Unit 7",
            station_id=stations[0].id,
            status="EN_ROUTE",  # Already assigned, not available
            current_lat=19.0896,
            current_lon=72.8656,
            radio_channel="Channel 3",
            members_count=4
        ),
    ]
    
    for team in teams:
        db.add(team)
    
    await db.commit()
    
    for team in teams:
        await db.refresh(team)
    
    print(f"✓ Created {len(teams)} teams")
    return teams


async def seed_atms_from_file(db: AsyncSession, stations: list) -> list:
    """
    Loads real ATM locations from downloaded OpenStreetMap data.
    If file missing, creates minimal sample ATMs for basic testing.
    """
    atm_file = DATA_DIR / "india_atm_locations.parquet"
    
    if not atm_file.exists():
        print("⚠ ATM data not found. Run: python scripts/download_atm_locations.py")
        return await _seed_sample_atms(db, stations)
    
    df = pd.read_parquet(atm_file)
    
    # Priority cities - load more ATMs from major metro areas
    priority_cities = ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Pune"]
    
    atms_to_seed = []
    
    # Load 50 ATMs per priority city for good coverage
    for city in priority_cities:
        city_atms = df[df["city"] == city].head(50)
        for _, row in city_atms.iterrows():
            atms_to_seed.append(row)
    
    # Add 100 ATMs from other cities for geographic spread
    other_cities = df[~df["city"].isin(priority_cities)]
    if len(other_cities) > 0:
        sample_size = min(100, len(other_cities))
        for _, row in other_cities.sample(sample_size).iterrows():
            atms_to_seed.append(row)
    
    # Simple nearest-station finder (Manhattan distance)
    def find_nearest_station(lat, lon):
        min_dist = float("inf")
        nearest = stations[0]
        for s in stations:
            dist = abs(s.latitude - lat) + abs(s.longitude - lon)
            if dist < min_dist:
                min_dist = dist
                nearest = s
        return nearest.id
    
    created = []
    for row in atms_to_seed:
        atm = ATM(
            bank_name=str(row.get("bank_name", "Unknown"))[:100],
            atm_id=f"OSM-{row.get('osm_id', 0)}",
            name=str(row.get("name", "ATM"))[:255],
            address=str(row.get("address", ""))[:500],
            city=str(row.get("city", ""))[:100],
            state=str(row.get("state", ""))[:100],
            pincode=str(row.get("postcode", ""))[:10] if pd.notna(row.get("postcode")) else None,
            latitude=float(row["latitude"]),
            longitude=float(row["longitude"]),
            atm_type="STANDALONE",
            is_active=True,
            nearest_station_id=find_nearest_station(row["latitude"], row["longitude"])
        )
        db.add(atm)
        created.append(atm)
    
    await db.commit()
    
    for atm in created:
        await db.refresh(atm)
    
    print(f"✓ Loaded {len(created)} ATMs from OpenStreetMap data")
    return created


async def _seed_sample_atms(db: AsyncSession, stations: list) -> list:
    """
    Fallback: Creates 3 sample ATMs when real data unavailable.
    Enough to test basic ATM-related endpoints and case predictions.
    """
    sample_atms = [
        ATM(
            bank_name="HDFC",
            atm_id="HDFC-MUM-001",
            name="HDFC ATM, Andheri West",
            address="Lokhandwala Complex, Andheri West",
            city="Mumbai",
            state="Maharashtra",
            pincode="400053",
            latitude=19.1395,
            longitude=72.8295,
            atm_type="MALL",
            is_active=True,
            nearest_station_id=stations[0].id
        ),
        ATM(
            bank_name="SBI",
            atm_id="SBI-MUM-001",
            name="SBI ATM, Bandra",
            address="Hill Road, Bandra West",
            city="Mumbai",
            state="Maharashtra",
            pincode="400050",
            latitude=19.0596,
            longitude=72.8367,
            atm_type="BRANCH",
            is_active=True,
            nearest_station_id=stations[0].id
        ),
        ATM(
            bank_name="ICICI",
            atm_id="ICICI-DEL-001",
            name="ICICI ATM, Connaught Place",
            address="Block A, Connaught Place",
            city="Delhi",
            state="Delhi",
            pincode="110001",
            latitude=28.6315,
            longitude=77.2167,
            atm_type="MALL",
            is_active=True,
            nearest_station_id=stations[1].id
        ),
    ]
    
    for atm in sample_atms:
        db.add(atm)
    
    await db.commit()
    
    for atm in sample_atms:
        await db.refresh(atm)
    
    print(f"✓ Created {len(sample_atms)} sample ATMs (fallback)")
    return sample_atms


async def seed_sample_case(db: AsyncSession, officers: list, teams: list, atms: list) -> Case:
    """
    Creates a complete fraud case with mule accounts and transaction trail.
    This tests the full case lifecycle: creation → prediction → freeze → resolution.
    """
    
    # Create the main case record
    case = Case(
        case_number="MH-2025-00001",
        status="IN_PROGRESS",  # Active case for testing status transitions
        priority="CRITICAL",   # High priority triggers urgent UI indicators
        
        # NCRP complaint details - what victim reported
        ncrp_complaint_id="NCRP-2025-MH-847210",
        fraud_type="OTP_FRAUD",
        fraud_amount=350000,
        fraud_description="Victim received call claiming to be from bank. Shared OTP for 'KYC update'. Amount debited immediately.",
        complaint_timestamp=datetime.utcnow() - timedelta(minutes=23),
        
        # First destination account - where victim's money went (critical for tracing)
        destination_account="XXXX XXXX 4521",
        destination_bank="SBI",
        destination_ifsc="SBIN0012345",
        
        # Victim information
        victim_name="Rajesh Gupta",
        victim_phone="+91 98765 12345",
        victim_email="rajesh.gupta@email.com",
        victim_city="Mumbai",
        victim_state="Maharashtra",
        victim_lat=19.1136,
        victim_lon=72.8697,
        
        # AI prediction - where we expect cash withdrawal to happen
        predicted_atm_id=atms[0].id if atms else None,
        predicted_time_start=datetime.utcnow() + timedelta(minutes=15),
        predicted_time_end=datetime.utcnow() + timedelta(minutes=45),
        location_confidence=0.94,  # 94% confidence in prediction
        alternative_predictions=[
            {"name": "ICICI ATM nearby", "confidence": 0.72},
            {"name": "SBI ATM nearby", "confidence": 0.45}
        ],
        
        # Assignment - who's handling this case
        assigned_officer_id=officers[0].id,
        assigned_team_id=teams[0].id
    )
    
    db.add(case)
    await db.commit()
    await db.refresh(case)
    
    # Create mule accounts - accounts in the fraud money chain
    mules = [
        # Hop 1: First receiver of stolen money (highest confidence mule)
        MuleAccount(
            case_id=case.id,
            account_number="XXXX XXXX 4521",
            bank_name="SBI",
            holder_name="Ramesh Kumar",
            amount_received=210000,
            current_balance=208500,  # Some already transferred out
            status="ACTIVE",         # Not yet frozen
            mule_confidence=0.94,
            risk_indicators=["New account (< 6 months)", "Sudden large deposit"],
            registered_city="Jamtara",      # Known fraud hotspot
            registered_state="Jharkhand",
            registered_lat=24.9264,
            registered_lon=86.7953,
            account_age_days=45,
            hop_number=1
        ),
        # Hop 2: Second layer mule - money getting layered
        MuleAccount(
            case_id=case.id,
            account_number="XXXX XXXX 7832",
            bank_name="HDFC",
            holder_name="Suresh Yadav",
            amount_received=100000,
            current_balance=98200,
            status="ACTIVE",
            mule_confidence=0.89,
            registered_city="Deoghar",  # Another fraud hotspot
            registered_state="Jharkhand",
            registered_lat=24.4854,
            registered_lon=86.6944,
            account_age_days=62,
            hop_number=2
        ),
    ]
    
    for mule in mules:
        db.add(mule)
    
    # Create transaction records - the money trail
    txns = [
        # First transaction: Victim → Mule 1
        Transaction(
            case_id=case.id,
            from_account="XXXX XXXX 1234",
            from_bank="ICICI",
            from_holder_name="Rajesh Gupta",  # Victim
            to_account="XXXX XXXX 4521",
            to_bank="SBI",
            to_holder_name="Ramesh Kumar",    # First mule
            amount=210000,
            transaction_type="IMPS",
            transaction_id="TXN20251204102345",
            transaction_timestamp=datetime.utcnow() - timedelta(minutes=20),
            hop_number=1,
            status="COMPLETED"
        ),
        # Second transaction: Victim → Mule 2 (parallel transfer)
        Transaction(
            case_id=case.id,
            from_account="XXXX XXXX 1234",
            from_bank="ICICI",
            from_holder_name="Rajesh Gupta",
            to_account="XXXX XXXX 7832",
            to_bank="HDFC",
            to_holder_name="Suresh Yadav",
            amount=100000,
            transaction_type="IMPS",
            transaction_id="TXN20251204102512",
            transaction_timestamp=datetime.utcnow() - timedelta(minutes=18),
            hop_number=1,
            status="COMPLETED"
        ),
    ]
    
    for txn in txns:
        db.add(txn)
    
    await db.commit()
    
    print(f"✓ Created sample case: {case.case_number} (with 2 mules, 2 transactions)")
    return case


async def main():
    """
    Main entry point - seeds all tables in correct order.
    Foreign key dependencies: Stations → Officers → Teams → ATMs → Cases
    """
    print("=" * 60)
    print("AEGIS Database Seeder")
    print("Purpose: Create test data for API development")
    print("=" * 60)
    
    # Initialize tables if they don't exist
    print("\nInitializing database schema...")
    await init_db()
    
    async with AsyncSessionLocal() as db:
        print("\nSeeding test data...\n")
        
        # Order matters: each function uses IDs from previous ones
        stations = await seed_stations(db)
        officers = await seed_officers(db, stations)
        teams = await seed_teams(db, stations, officers)
        atms = await seed_atms_from_file(db, stations)
        case = await seed_sample_case(db, officers, teams, atms)
        
        print("\n" + "=" * 60)
        print("✅ Database seeded successfully!")
        print("=" * 60)
        print("\n📋 Test with these credentials:")
        print("   POST /api/v1/auth/login")
        print("   Admin: username='admin', password='admin123'")
        print('   Officer: username="MH-CYB-2024-001", password="password123"')
        print(f"\n📁 Sample case created: {case.case_number}")
        print("   GET /api/v1/cases/{case_id}")


if __name__ == "__main__":
    asyncio.run(main())
