import { nanoid } from "nanoid";
import { Account } from "../model/account";
import { ID } from "../model/id";

export interface AccountRepository {
  getAccount(email: string): Promise<Account | null>;
  createAccount(
    id: ID<Account>,
    name: string,
    email: string,
    role: "STUDENT" | "TEACHER",
  ): Promise<Account>;
}

export async function getOrNewAccount(
  db: AccountRepository,
  email: string,
  name: string,
): Promise<Account | null> {
  const entry = await db.getAccount(email);
  const isNewUser = entry == null;
  if (isNewUser) {
    const newID = nanoid() as ID<Account>;

    const isStudent = /^[a-z]\d{6}[a-z]@mails\.cc\.ehime-u\.ac\.jp$/.test(
      email,
    );
    const isTeacher = /@(.+\.)?ehime-u\.ac\.jp$/.test(email);
    let account: Account;
    if (isStudent) {
      account = await db.createAccount(newID, name, email, "STUDENT");
    } else if (isTeacher) {
      account = await db.createAccount(newID, name, email, "TEACHER");
    } else {
      return null;
    }
    return account;
  }
  return {
    id: entry["id"] as ID<Account>,
    email: entry["email"] as string,
    name: entry["name"],
  };
}
