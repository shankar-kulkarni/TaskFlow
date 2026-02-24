import { Pool } from 'pg';

export const db = new Pool({
  connectionString:
    process.env.DATABASE_URL ?? 'postgresql://taskflow:password@localhost:5432/taskflow?schema=public',
});
