import { Student } from "../model/account";
import { AttendanceBoard } from "../model/attendance-board";
import { ID } from "../model/id";
import { Subject } from "../model/subject";
import { AttendanceBoardQueryService } from "../service/attend";

export class D1AttendanceBoardRepository
  implements AttendanceBoardQueryService
{
  constructor(private readonly db: D1Database) {}

  async boardsByEachSubject(subjects: Subject[]): Promise<AttendanceBoard[][]> {
    const selectBoard = this.db.prepare(
      "SELECT id, subject_id, start_from, seconds_from_start_to_be_late, seconds_from_be_late_to_end FROM attendance_board WHERE subject_id = ?1",
    );
    return (
      await this.db.batch<{
        id: ID<AttendanceBoard>;
        subject_id: ID<Subject>;
        start_from: number;
        seconds_from_start_to_be_late: number;
        seconds_from_be_late_to_end: number;
      }>(subjects.map(({ id }) => selectBoard.bind(id)))
    ).map(({ results }) => {
      if (!results) {
        throw new Error("query attendance board failed");
      }
      return results.map(
        ({
          id,
          subject_id,
          start_from,
          seconds_from_start_to_be_late,
          seconds_from_be_late_to_end,
        }) => ({
          id,
          subject: subject_id,
          startFrom: new Date(start_from * 1000),
          secondsFromStartToBeLate: seconds_from_start_to_be_late,
          secondsFromBeLateToEnd: seconds_from_be_late_to_end,
        }),
      );
    });
  }

  async hadSubmitted(
    who: ID<Student>,
    where: ID<AttendanceBoard>,
  ): Promise<boolean> {
    return (
      (await this.db
        .prepare('SELECT * FROM attendance WHERE who = ?1 AND "where" = ?2')
        .bind(who, where)
        .first()) !== null
    );
  }

  async getBoardRegisteredBy(
    studentId: ID<Student>,
    nowSeconds: number,
  ): Promise<ID<AttendanceBoard> | null> {
    const idRow = await this.db
      .prepare(
        `
        SELECT id
        FROM attendance_board
        WHERE
            ?1 BETWEEN start_from AND start_from + seconds_from_start_to_be_late + seconds_from_be_late_to_end
            AND subject_id IN (
                SELECT subject_id
                FROM registration
                WHERE student_id = ?2
            )
    `.replace(/\n/g, ""),
      )
      .bind(nowSeconds, studentId)
      .first("id");
    if (typeof idRow === "string") {
      return idRow as ID<AttendanceBoard>;
    }
    if (idRow === null) {
      return idRow;
    }
    throw new Error("expected `id` row in `attendance_board` is a string");
  }
}
