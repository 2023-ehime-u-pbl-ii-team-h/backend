import {ID} from './id'

export type Account = {
    readonly id: ID<Account>;
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