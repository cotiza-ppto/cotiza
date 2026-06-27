import pg from 'pg';

const { Pool } = pg;

let host = process.env.DB_HOST || 'aws-1-us-east-2.pooler.supabase.com';
if (host.includes('db.ewrhzalwcnzclhjortfp')) {
  host = 'aws-1-us-east-2.pooler.supabase.com';
}

let user = process.env.DB_USER || 'postgres.ewrhzalwcnzclhjortfp';
if (user === 'postgres' || user === 'postgres.ewrhzalwcnzclhjortfp.sup') {
  user = 'postgres.ewrhzalwcnzclhjortfp';
}

const pool = new Pool({
  host,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'postgres',
  user: user,
  password: process.env.DB_PASS || '',
  ssl: {
    rejectUnauthorized: false
  }
});

export default pool;
