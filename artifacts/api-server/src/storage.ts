import { query } from "./db";

export interface User {
  id: string;
  email: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
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

  async updateStripeCustomer(userId: string, stripeCustomerId: string): Promise<void> {
    await query("UPDATE users SET stripe_customer_id = $1 WHERE id = $2", [
      stripeCustomerId,
      userId,
    ]);
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

  async getActiveSubscription(userId: string) {
    const user = await this.getUser(userId);
    if (!user?.stripe_customer_id) return null;

    const res = await query(
      `SELECT s.* FROM stripe.subscriptions s
       JOIN stripe.customers c ON c.id = s.customer
       WHERE c.id = $1 AND s.status = 'active'
       LIMIT 1`,
      [user.stripe_customer_id]
    );
    return res.rows[0] || null;
  },
};
