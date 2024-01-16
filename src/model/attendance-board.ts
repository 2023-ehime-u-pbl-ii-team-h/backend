import { ID } from "./id";
import { Subject } from "./subject";

export type AttendanceBoard = {
  readonly id: ID<AttendanceBoard>;
  readonly subject: ID<Subject>;
  readonly startFrom: Date;
  readonly secondsFromStartToBeLate: number;
  readonly secondsFromBeLateToEnd: number;
};

export interface AttendanceBoardRepository {
  getBoard(boardId: ID<AttendanceBoard>): Promise<AttendanceBoard | null>;
}

export type AttendanceState = "TOO_EARLY" | "ATTENDED" | "BE_LATE" | "CLOSED";

export function determineState(
  board: AttendanceBoard,
  toAttendAt: Date,
): AttendanceState {
  const currentMs = Date.now(); // 現在の日時を取得
  const beLateMs = toAttendAt.getTime() + board.secondsFromStartToBeLate * 1000; //出席扱いの時間
  const endMs =
    toAttendAt.getTime() +
    board.secondsFromStartToBeLate * 1000 +
    board.secondsFromBeLateToEnd * 1000; //遅刻扱いの時間

  if (currentMs < toAttendAt.getTime()) {
    return "TOO_EARLY";
  }
  if (currentMs < beLateMs) {
    return "ATTENDED";
  }
  if (currentMs < endMs) {
    return "BE_LATE";
  }
  return "CLOSED";
}

export function shiftAll(
  boards: readonly AttendanceBoard[],
  days: number,
  firstIndex: number,
  lastIndex?: number,
): AttendanceBoard[] {
  if (!(0 <= firstIndex && firstIndex < boards.length)) {
    throw new Error("`firstIndex` out of range");
  }
  if (!Number.isInteger(days)) {
    throw new Error("`days` is not an integer");
  }
  if (lastIndex === undefined) {
    lastIndex = boards.length - 1;
  }
  const newBoards = structuredClone(boards) as AttendanceBoard[];
  for (let i = firstIndex; i <= lastIndex; ++i) {
    newBoards[i].startFrom.setUTCDate(
      newBoards[i].startFrom.getUTCDate() + days,
    );
  }
  return newBoards;
}

export function nextBoardEnd(
  boards: AttendanceBoard[],
  now: Date,
): Date | null {
  const found = boards.find(
    (board) => board.startFrom.valueOf() <= now.valueOf(),
  );
  if (!found) {
    return null;
  }
  return new Date(
    found.startFrom.valueOf() +
      found.secondsFromStartToBeLate * 1000 +
      found.secondsFromBeLateToEnd * 1000,
  );
}
