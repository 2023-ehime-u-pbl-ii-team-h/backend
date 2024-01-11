import { ID } from "./id";
import { Subject } from "./subject";

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
