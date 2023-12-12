import { ID } from "./id";
// import { AttendanceBoard } from "./attendance-board";
import { Student, Teacher } from "./account";

export interface AttendanceBoard {
  startFrom: Date;
}

export class Subject {
  constructor(
    public readonly id: ID<Subject>,
    public readonly name: string,
    public readonly boards: readonly AttendanceBoard[],
    public readonly enrolled: readonly ID<Student>[],
    public readonly assigned: readonly ID<Teacher>[],
  ) {}

  shiftAll(days: number, firstIndex: number, lastIndex?: number): Subject {
    if (!(0 <= firstIndex && firstIndex < this.boards.length)) {
      throw new Error("`firstIndex` out of range");
    }
    if (!Number.isInteger(days)) {
      throw new Error("`days` is not an integer");
    }
    const newBoards = structuredClone(this.boards);
    for (const board of newBoards.slice(
      firstIndex,
      lastIndex ? lastIndex + 1 : undefined,
    )) {
      board.startFrom.setUTCDate(board.startFrom.getUTCDate() + days);
    }
    return new Subject(
      this.id,
      this.name,
      newBoards,
      this.enrolled,
      this.assigned,
    );
  }
}
