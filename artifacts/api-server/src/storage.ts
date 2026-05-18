import { query } from "./db";

export interface User {
  id: string;
  email: string | null;
  credits: number;
  created_at: Date;
}

export const storage = {
  async getUser(id: string): Promise<User | null> {
    const res = await query("SELECT * FROM users WHERE id = $1", [id]);
    return (res.rows[0] as User) || null;
  },

  async upsertUser(id: string, email: string): Promise<User> {
    const res = await query(
      `INSERT INTO users (id, email) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
       RETURNING *`,
      [id, email]
    );
    return res.rows[0] as User;
  },

  async decrementCredit(userId: string): Promise<void> {
    await query(
      "UPDATE users SET credits = credits - 1 WHERE id = $1 AND credits > 0",
      [userId]
    );
  },

  async addCredits(userId: string, amount: number): Promise<void> {
    await query("UPDATE users SET credits = credits + $1 WHERE id = $2", [
      amount,
      userId,
    ]);
  },

  async claimFreeTrial(userId: string): Promise<void> {
    // 테스트 모드: 무제한(9999 크레딧) 지급
    await query("UPDATE users SET credits = 9999 WHERE id = $1", [userId]);
  },
};
