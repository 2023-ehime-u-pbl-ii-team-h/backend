import { ID } from "./id";
import { AttendanceBoard } from "./attendance-board";
import { Student, Teacher } from "./account";

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
    if (lastIndex === undefined) {
      lastIndex = this.boards.length - 1;
    }
    const newBoards = structuredClone(this.boards);
    for (let i = firstIndex; i <= lastIndex; ++i) {
      newBoards[i].startFrom.setUTCDate(
        newBoards[i].startFrom.getUTCDate() + days,
      );
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
