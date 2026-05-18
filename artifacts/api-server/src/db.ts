import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function query(text: string, params?: any[]) {
  const res = await pool.query(text, params);
  return res;
}
