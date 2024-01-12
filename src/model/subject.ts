import { ID } from "./id";

export type Subject = {
  readonly id: ID<Subject>;
  readonly name: string;
};
