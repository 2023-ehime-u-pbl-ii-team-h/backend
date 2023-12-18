import { nanoid } from "nanoid";
import { Session } from "../model/session";
import { ID } from "../model/id";
import { Account, Student } from "../model/account";
import { Attendance } from "../model/attendance";
import { AttendanceBoard } from "../model/attendance-board";

export interface Input {
  ipAddress: string;
  session: Session;
}

export interface Config {
  allowIpRegex: string;
}

export interface StudentQueryService {
  isValidStudent(accountId: ID<Account>): Promise<boolean>;
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

export interface AttendanceRepository {
  createAttendance(newAttendance: Attendance): Promise<void>;
}

export interface AttendDeps {
  input: Input;
  config: Config;
  studentQuery: StudentQueryService;
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
  studentQuery,
  boardQuery,
  clock,
  repo,
}: AttendDeps): Promise<Response> {
  const allowPattern = new RegExp(config.allowIpRegex);
  if (!allowPattern.test(input.ipAddress)) {
    return "FORBIDDEN";
  }

  if (!(await studentQuery.isValidStudent(input.session.account.id))) {
    return "UNAUTHORIZED";
  }
  const studentId = input.session.account.id as ID<Student>;

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
