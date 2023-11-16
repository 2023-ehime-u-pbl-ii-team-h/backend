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

    /*現在時刻と認証情報から新しいセッションを作成する*/
    static async from(clock: Clock, auth: AuthorizationRepository): Promise<Session> {
        const session = await nanoid();
        const id = auth.id;
        const account = auth.account;
        const loginAt  = await clock.now();
        const deviceName  = await auth.deviceName();
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

export type AuthorizationRepository = AccountRepository & {
    deviceName(): string;
};