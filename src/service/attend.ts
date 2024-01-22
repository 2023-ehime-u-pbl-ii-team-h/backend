import { Account, Student, isStudent } from "../model/account";
import { Attendance, AttendanceRepository } from "../model/attendance";
import { AttendanceBoard } from "../model/attendance-board";
import { ID } from "../model/id";
import { nanoid } from "nanoid";

export interface Input {
  ipAddress: string;
  account: Account;
}

export interface Config {
  allowIpRegex: string;
}

export interface AttendanceBoardQueryService {
  getBoardRegisteredBy(
    studentId: ID<Student>,
    nowSeconds: number,
  ): Promise<ID<AttendanceBoard> | null>;
  hadSubmitted(who: ID<Student>, where: ID<AttendanceBoard>): Promise<boolean>;
}

export interface Clock {
  nowSeconds(): number;
}

export interface AttendDeps {
  input: Input;
  config: Config;
  boardQuery: AttendanceBoardQueryService;
  clock: Clock;
  repo: AttendanceRepository;
}

export type Response =
  | "OK"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "UNPROCESSABLE_ENTITY";

export async function attend({
  input,
  config,
  boardQuery,
  clock,
  repo,
}: AttendDeps): Promise<Response> {
  const allowPattern = new RegExp(config.allowIpRegex);
  if (!allowPattern.test(input.ipAddress)) {
    return "FORBIDDEN";
  }

  if (!isStudent(input.account)) {
    return "UNAUTHORIZED";
  }
  const studentId = input.account.id;

  const now = clock.nowSeconds();
  const boardId = await boardQuery.getBoardRegisteredBy(studentId, now);
  if (!boardId) {
    return "NOT_FOUND";
  }
  if (!(await boardQuery.hadSubmitted(studentId, boardId))) {
    return "UNPROCESSABLE_ENTITY";
  }

  await repo.createAttendance({
    id: nanoid() as ID<Attendance>,
    created_at: now,
    who: studentId,
    where: boardId,
  });
  return "OK";
}
