import { ID } from "./id";
import { Subject } from "./subject";

export type Account = {
  readonly id: ID<Account>;
  readonly name: string;
  readonly email: string;
};

export type Student = Account & {
  readonly role: "STUDENT";
  readonly enrolling: readonly ID<Subject>[];
};

export type Teacher = Account & {
  readonly role: "TEACHER";
  readonly assigned: readonly ID<Subject>[];
};
