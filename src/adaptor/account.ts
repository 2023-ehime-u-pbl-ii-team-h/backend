import { Account, Student, Teacher } from "../model/account";
import { AccountRepository } from "../model/account";
import { ID } from "../model/id";
import { AccountQueryService } from "../service/new-subject";

export class D1AccountRepository
  implements AccountRepository, AccountQueryService
{
  constructor(private readonly db: D1Database) {}

  async getAccount(email: string): Promise<Account | null> {
    const entry = await this.db
      .prepare("SELECT id, name, email, role FROM account WHERE email = ?")
      .bind(email)
      .first<{ id: ID<Account>; name: string; email: string; role: string }>();
    if (!entry) {
      return null;
    }
    return entry;
  }

  async getStudentOrTeacher(
    accountId: ID<Account>,
  ): Promise<Student | Teacher | null> {
    const entry = await this.db
      .prepare("SELECT name, email, role FROM account WHERE id = ?1")
      .bind(accountId)
      .first();
    if (!entry) {
      return null;
    }

    const { name, email, role } = entry as Record<
      "name" | "email" | "role",
      string
    >;

    if (role === "STUDENT") {
      return {
        id: accountId as ID<Student>,
        name,
        email,
        role,
      } satisfies Student;
    }
    if (role === "TEACHER") {
      return {
        id: accountId as ID<Teacher>,
        name,
        email,
        role,
      } satisfies Teacher;
    }
    throw new Error(`unknown role: ${role}`);
  }

  async isValidStudent(accountId: ID<Account>): Promise<boolean> {
    return (
      (await this.db
        .prepare("SELECT * FROM account WHERE role = 'STUDENT' AND id = ?1")
        .bind(accountId)
        .first()) !== null
    );
  }

  async existsAll(...ids: ID<Account>[]): Promise<boolean> {
    const statement = this.db.prepare("SELECT * FROM account WHERE id = ?");
    const rows = await this.db.batch(ids.map((id) => statement.bind(id)));
    return rows.every((row) => row.results.length === 1);
  }

  async addAccount({ id, name, email, role }: Account): Promise<boolean> {
    const res = await this.db
      .prepare(
        "INSERT INTO account (id, name, email, role) VALUES (?1, ?2, ?3, ?4)",
      )
      .bind(id, name, email, role)
      .run();
    return res.success;
  }

  async selectAccountName(id: ID<Account>): Promise<string> {
    const name = await this.db
      .prepare("SELECT name FROM account WHERE id = ?")
      .bind(id)
      .first<string>("name");

    if (name === null) {
      throw new Error("Entry was invalid");
    }
    return name;
  }
}
