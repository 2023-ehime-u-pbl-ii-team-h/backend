import { Student } from "../model/account";
import { AttendanceBoard } from "../model/attendance-board";
import { ID } from "../model/id";
import { AttendanceBoardQueryService } from "../service/attend";

export class D1AttendanceBoardRepository
  implements AttendanceBoardQueryService
{
  constructor(private readonly db: D1Database) {}

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
