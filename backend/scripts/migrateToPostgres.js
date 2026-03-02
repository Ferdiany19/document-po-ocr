const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const XLSX = require('xlsx');
const db = require('../db');

async function migrateData() {
    console.log('Starting migration to Supabase PostgreSQL...');

    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL is not set in environment variables.');
        process.exit(1);
    }

    try {
        // 1. Create table if not exists
        console.log('Creating table `products` if it doesn\'t exist...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                spec_code VARCHAR(255) NOT NULL,
                thick NUMERIC,
                width NUMERIC,
                length1 NUMERIC,
                product_no VARCHAR(255) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Table ready.');

        // 2. Clear existing entries (optional, but good for fresh migration)
        console.log('Clearing existing data to prevent duplicates...');
        await db.query('TRUNCATE TABLE products RESTART IDENTITY;');

        // 3. Read Excel data
        const dbPath = path.join(__dirname, '..', '..', 'DB PM Fujiseat.xlsx');
        console.log(`Reading Master Database from: ${dbPath}`);

        const wb = XLSX.readFile(dbPath);
        const ws = wb.Sheets['Sheet2'];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // Skip header row
        const products = data.slice(1)
            .filter(row => row[0] || row[4]) // Only process rows that have some valid data
            .map(row => ({
                specCode: String(row[0] || '').trim(),
                thick: parseFloat(row[1]) || 0,
                width: parseFloat(row[2]) || 0,
                length1: parseFloat(row[3]) || 0,
                productNo: String(row[4] || '').trim()
            }));

        console.log(`Found ${products.length} valid entries in Excel.`);

        // 4. Insert data
        let insertedCount = 0;

        // Use parameterized query for safety
        const insertQuery = `
            INSERT INTO products (spec_code, thick, width, length1, product_no) 
            VALUES ($1, $2, $3, $4, $5)
        `;

        for (const p of products) {
            await db.query(insertQuery, [
                p.specCode,
                p.thick,
                p.width,
                p.length1,
                p.productNo
            ]);
            insertedCount++;

            if (insertedCount % 50 === 0) {
                console.log(`Inserted ${insertedCount} / ${products.length}...`);
            }
        }

        console.log(`\n🎉 Migration successful! Inserted ${insertedCount} total entries into Postgres.`);

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
    } finally {
        await db.pool.end();
        process.exit(0);
    }
}

migrateData();
