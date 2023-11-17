import { ID } from './id'
import { Account } from './account'
import { nanoid } from 'nanoid'

export class Session {
    constructor(
        public readonly id: ID<Session>,
        public readonly account: Account,
        public readonly loginAt: Date,
        public readonly deviceName: string,
    ) {}

    static newSession(clock: Clock, account: Account, deviceName: string): Session{
        const id = nanoid() as ID <Session>;
        const loginAt  = clock.now();
        return {
            id,
            account,
            loginAt,
            deviceName,
        };
    }
}

export type Clock = {
    now(): Date;
};