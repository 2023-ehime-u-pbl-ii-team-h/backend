import { ID } from "./id";

export type Account = {
  readonly id: ID<Account>;
  readonly name: string;
  readonly email: string;
  readonly role: string;
};

export type Student = Account & {
  readonly role: "STUDENT";
};

export type Teacher = Account & {
  readonly role: "TEACHER";
};
