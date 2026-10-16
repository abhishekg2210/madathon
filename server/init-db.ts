import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

async function initDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log('ℹ️  No DATABASE_URL found. ReworkGuard is using the high-performance in-memory datastore with full mock persistence.');
    return;
  }

  console.log('🔄 Connecting to PostgreSQL database...');
  const pool = new Pool({ connectionString });

  try {
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(sql);
    console.log('✅ PostgreSQL Schema and seed data successfully applied!');
  } catch (err) {
    console.error('❌ Failed to initialize PostgreSQL database:', err);
  } finally {
    await pool.end();
  }
}

initDatabase();
