# Database Migrations

## Adding Split Fields to Transactions Table

To support money splitting visualization, you need to add new columns to the `transactions` table.

### Quick Migration

Run the SQL script:

```bash
# Using psql
psql -U your_username -d your_database -f migrations/add_split_fields_to_transactions.sql

# Or using Python with asyncpg
python -c "
import asyncio
import asyncpg

async def migrate():
    conn = await asyncpg.connect('postgresql://user:pass@localhost/dbname')
    with open('migrations/add_split_fields_to_transactions.sql', 'r') as f:
        await conn.execute(f.read())
    await conn.close()

asyncio.run(migrate())
"
```

### Manual Migration

If you prefer to run it manually, execute these SQL commands:

```sql
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS split_group_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS split_index INTEGER,
ADD COLUMN IF NOT EXISTS split_total INTEGER;

CREATE INDEX IF NOT EXISTS idx_transactions_split_group ON transactions(split_group_id);
```

### Verification

After running the migration, verify the columns exist:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'transactions' 
AND column_name IN ('split_group_id', 'split_index', 'split_total');
```

You should see all three columns listed.

