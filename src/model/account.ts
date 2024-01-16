import { ID } from "./id";
import { nanoid } from "nanoid";

export type Account = {
  readonly id: ID<Account>;
  readonly name: string;
  readonly email: string;
  readonly role: string;
};

export type Student = Account & {
  readonly role: "STUDENT";
};

export const isStudent = (account: Account): account is Student =>
  account.role === "STUDENT";

export type Teacher = Account & {
  readonly role: "TEACHER";
};

export const isTeacher = (account: Account): account is Teacher =>
  account.role === "TEACHER";

export function newAccount(name: string, email: string): Account | null {
  const isStudent = /^[a-z]\d{6}[a-z]@mails\.cc\.ehime-u\.ac\.jp$/.test(email);
  const isTeacher = /@(.+\.)?ehime-u\.ac\.jp$/.test(email);
  const id = nanoid() as ID<Account>;
  switch (true) {
    case isStudent:
      return {
        id,
        name,
        email,
        role: "STUDENT",
      };
    case isTeacher:
      return {
        id,
        name,
        email,
        role: "TEACHER",
      };
    default:
      return null;
  }
}
