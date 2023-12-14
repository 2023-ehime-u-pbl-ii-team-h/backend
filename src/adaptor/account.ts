import { Account } from "../model/account";
import { ID } from "../model/id";
import { AccountRepository } from "../service/get-or-new-account";
import { AccountQueryService } from "../service/new-subject";

export class D1AccountRepository
  implements AccountRepository, AccountQueryService
{
  constructor(private readonly db: D1Database) {}

  async getAccount(email: string): Promise<Account> {
    const entry = await this.db
      .prepare("SELECT * FROM account WHERE email = ?")
      .bind(email)
      .first();
    if (!entry) {
      throw new Error(`account having email ${email} not found`);
    }
    return entry as Account;
  }

  async existsAll(...ids: ID<Account>[]): Promise<boolean> {
    const statement = this.db.prepare("SELECT * FROM account WHERE id = ?");
    const rows = await this.db.batch(ids.map((id) => statement.bind(id)));
    return rows.every((row) => row.results.length === 1);
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
