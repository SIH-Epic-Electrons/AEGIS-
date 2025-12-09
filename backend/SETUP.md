# AEGIS Backend Setup Guide

Complete setup instructions for development environment.

---

## Prerequisites

- Python 3.10 or higher
- PostgreSQL 14+
- Neo4j 5.x
- Redis 7.x (optional for MVP)

---

## 1. Python Environment Setup

```powershell
# Navigate to backend directory
cd D:\Ageis\backend

# Create virtual environment
python -m venv venv

# Activate virtual environment (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# If you get execution policy error, run:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Upgrade pip
python -m pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt
```

### If PyTorch installation fails:
```powershell
# Install PyTorch separately (CPU version)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

# For GPU (CUDA 11.8):
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
```

### If torch-geometric fails:
```powershell
# Install PyTorch Geometric dependencies first
pip install torch-scatter torch-sparse -f https://data.pyg.org/whl/torch-2.1.0+cpu.html
pip install torch-geometric
```

---

## 2. PostgreSQL Setup

### Option A: Download and Install (Recommended)

1. **Download PostgreSQL 16**: https://www.postgresql.org/download/windows/

2. **During installation**:
   - Set password for postgres user (remember this!)
   - Default port: 5432
   - Install pgAdmin 4 (included)

3. **Create database and user**:

   Open pgAdmin or psql:
   ```sql
   -- Connect as postgres user
   CREATE USER aegis_user WITH PASSWORD 'aegis_password';
   CREATE DATABASE aegis_db OWNER aegis_user;
   GRANT ALL PRIVILEGES ON DATABASE aegis_db TO aegis_user;
   
   -- Enable PostGIS extension (for geographic queries)
   \c aegis_db
   CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```

### Option B: Using Docker
```powershell
docker run --name aegis-postgres -e POSTGRES_USER=aegis_user -e POSTGRES_PASSWORD=aegis_password -e POSTGRES_DB=aegis_db -p 5432:5432 -d postgis/postgis:16-3.4
```

### Verify Connection:
```powershell
# Using psql
psql -h localhost -U aegis_user -d aegis_db

# Or test with Python
python -c "import psycopg2; conn = psycopg2.connect('postgresql://aegis_user:aegis_password@localhost:5432/aegis_db'); print('PostgreSQL Connected!')"
```

---

## 3. Neo4j Setup

### Option A: Desktop Installation (Recommended for Development)

1. **Download Neo4j Desktop**: https://neo4j.com/download/

2. **Install and launch Neo4j Desktop**

3. **Create a new project** → **Add Database** → **Local DBMS**
   - Name: AEGIS
   - Password: `your_neo4j_password` (remember this!)
   - Version: 5.x

4. **Start the database**

5. **Open Neo4j Browser** (usually http://localhost:7474)

6. **Create constraints**:
   ```cypher
   CREATE CONSTRAINT account_unique IF NOT EXISTS 
   FOR (a:Account) REQUIRE a.account_id IS UNIQUE;
   
   CREATE CONSTRAINT case_unique IF NOT EXISTS 
   FOR (c:Case) REQUIRE c.case_id IS UNIQUE;
   ```

### Option B: Using Docker
```powershell
docker run --name aegis-neo4j -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/your_neo4j_password -d neo4j:5
```

### Verify Connection:
```powershell
python -c "from neo4j import GraphDatabase; d = GraphDatabase.driver('bolt://localhost:7687', auth=('neo4j', 'your_neo4j_password')); d.verify_connectivity(); print('Neo4j Connected!')"
```

---

## 4. Redis Setup (Optional)

### Option A: Using Memurai (Windows Redis Alternative)
1. Download Memurai: https://www.memurai.com/
2. Install and start service
3. Default port: 6379

### Option B: Using Docker
```powershell
docker run --name aegis-redis -p 6379:6379 -d redis:7
```

### Verify:
```powershell
python -c "import redis; r = redis.Redis(); print(r.ping())"
```

---

## 5. Environment Configuration

```powershell
# Copy example env file
copy env.example .env

# Edit .env with your values
notepad .env
```

Update these values in `.env`:
```
POSTGRES_PASSWORD=your_actual_password
NEO4J_PASSWORD=your_neo4j_password
SECRET_KEY=generate-a-random-string-here
JWT_SECRET_KEY=another-random-string
```

---

## 6. Kaggle Setup (for Dataset Download)

1. **Create Kaggle Account**: https://www.kaggle.com/

2. **Get API Token**:
   - Go to https://www.kaggle.com/account
   - Click "Create New API Token"
   - This downloads `kaggle.json`

3. **Setup credentials**:
   ```powershell
   # Create kaggle directory
   mkdir $env:USERPROFILE\.kaggle
   
   # Copy kaggle.json
   copy C:\Users\YourUser\Downloads\kaggle.json $env:USERPROFILE\.kaggle\
   ```

4. **Verify**:
   ```powershell
   kaggle datasets list
   ```

---

## 7. Initialize Database

```powershell
# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Run database migrations (after we create them)
# alembic upgrade head

# For now, create tables directly
python -c "
from app.db.postgresql import init_db
import asyncio
asyncio.run(init_db())
print('Database tables created!')
"
```

---

## 8. Download & Prepare Datasets

```powershell
# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Download Kaggle datasets
python scripts/download_datasets.py

# Generate synthetic Indian fraud data
python scripts/generate_synthetic_data.py
```

---

## 9. Run the Application

```powershell
# Development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## Quick Verification Checklist

```powershell
# Run this to verify all components
python -c "
print('Checking dependencies...')

# PostgreSQL
try:
    import psycopg2
    print('✅ psycopg2')
except: print('❌ psycopg2')

# SQLAlchemy
try:
    import sqlalchemy
    print('✅ sqlalchemy')
except: print('❌ sqlalchemy')

# Neo4j
try:
    from neo4j import GraphDatabase
    print('✅ neo4j')
except: print('❌ neo4j')

# Redis
try:
    import redis
    print('✅ redis')
except: print('❌ redis')

# FastAPI
try:
    import fastapi
    print('✅ fastapi')
except: print('❌ fastapi')

# PyTorch
try:
    import torch
    print(f'✅ torch {torch.__version__}')
except: print('❌ torch')

# Pandas
try:
    import pandas
    print('✅ pandas')
except: print('❌ pandas')

# River ML
try:
    import river
    print('✅ river')
except: print('❌ river')

print('\nDone!')
"
```

---

## Troubleshooting

### PowerShell Execution Policy
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### PostgreSQL Connection Refused
- Check if PostgreSQL service is running
- Verify port 5432 is not blocked
- Check credentials in .env

### Neo4j Connection Failed
- Ensure Neo4j Desktop is running and database is started
- Default bolt port is 7687
- Check password in .env

### PyTorch Installation Issues
```powershell
# Uninstall and reinstall
pip uninstall torch torchvision
pip cache purge
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
```

---

## Next Steps

After setup is complete:
1. Initialize the database schema
2. Seed sample data
3. Start the API server
4. Test endpoints with Swagger UI at http://localhost:8000/docs

