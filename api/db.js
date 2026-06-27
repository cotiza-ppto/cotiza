import pg from 'pg';

const { Pool } = pg;

// Sanitize DB_HOST in case it was truncated in the environment variables
let host = process.env.DB_HOST || 'db.ewrhzalwcnzclhjortfp.supabase.co';
if (host === 'db.ewrhzalwcnzclhjortfp.sup') {
  host = 'db.ewrhzalwcnzclhjortfp.supabase.co';
}

const pool = new Pool({
  host,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || '',
  ssl: {
    rejectUnauthorized: false
  }
});

export default pool;
