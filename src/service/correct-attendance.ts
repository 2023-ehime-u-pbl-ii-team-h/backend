import { isTeacher } from "../model/account";
import { Attendance } from "../model/attendance";
import { AttendanceBoard } from "../model/attendance-board";
import { ID } from "../model/id";
import { Session } from "../model/session";

export interface AttendanceRepository {
  getAttendance(attendanceId: ID<Attendance>): Promise<Attendance | null>;
  updateAttendance(attendance: Attendance): Promise<void>;
}

export interface AttendanceBoardRepository {
  getBoard(boardId: ID<AttendanceBoard>): Promise<AttendanceBoard | null>;
}

export interface CorrectAttendanceDeps {
  session: Session;
  target: ID<Attendance>;
  timeToSet: Date;
  attendanceRepo: AttendanceRepository;
  boardRepo: AttendanceBoardRepository;
}

export type CorrectAttendanceResult = "OK" | "BAD_REQUEST" | "UNAUTHORIZED";

export async function correctAttendance({
  session,
  target,
  timeToSet,
  attendanceRepo,
  boardRepo,
}: CorrectAttendanceDeps): Promise<CorrectAttendanceResult> {
  if (!isTeacher(session.account)) {
    return "UNAUTHORIZED";
  }

  const toCorrect = await attendanceRepo.getAttendance(target);
  if (!toCorrect) {
    return "BAD_REQUEST";
  }

  const board = await boardRepo.getBoard(toCorrect.where);
  if (!board) {
    throw new Error("attendance lost relation to board");
  }

  if (timeToSet.valueOf() < board.startFrom.valueOf()) {
    return "BAD_REQUEST";
  }

  const newAttendance: Attendance = {
    ...toCorrect,
    created_at: Math.floor(timeToSet.getTime() / 1000),
  };
  await attendanceRepo.updateAttendance(newAttendance);
  return "OK";
}
