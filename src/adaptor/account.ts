import { Account } from "../model/account";
import { ID } from "../model/id";
import { AccountRepository } from "../service/get-or-new-account";

export class D1AccountRepository implements AccountRepository {
  constructor(private readonly db: D1Database) {}

  getAccount(email: string): Promise<Account> {
    return this.db
      .prepare("SELECT * FROM account WHERE email = ?")
      .bind(email)
      .first();
  }

  async createAccount(
    id: ID<Account>,
    name: string,
    email: string,
    role: "STUDENT" | "TEACHER",
  ): Promise<Account> {
    const res = await this.db
      .prepare(
        "INSERT INTO account (id, name, email, role) VALUES (?1, ?2, ?3, ?4)",
      )
      .bind(id, name, email, role)
      .run();
    if (!res.success) {
      throw new Error("failed to create account");
    }
    return {
      id,
      email,
    };
  }
}
