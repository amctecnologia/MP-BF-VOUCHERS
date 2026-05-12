import { Pool } from 'pg';

export const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'bf_vouchers',
  user:     process.env.DB_USER     || 'bf_vouchers',
  password: process.env.DB_PASSWORD || '',
  max: 20,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});
