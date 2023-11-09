import {ID} from './id'
import {Account} from './account'

export class Session {
    readonly id: ID<Session>;
    readonly account: Account;
    readonly loginAt: Date;
    readonly deviceName: string;
}

export type Clock = {
    now(): Date;
};

export type AuthorizationRepository = AccountRepository & {
    deviceName(): string;
};