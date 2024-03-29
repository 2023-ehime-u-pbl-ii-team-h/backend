import { Student } from "../model/account";
import {
  AttendanceBoard,
  AttendanceBoardRepository,
} from "../model/attendance-board";
import { ID } from "../model/id";
import { Subject } from "../model/subject";
import { AttendanceBoardQueryService } from "../service/attend";

export class D1AttendanceBoardRepository
  implements AttendanceBoardQueryService, AttendanceBoardRepository
{
  constructor(private readonly db: D1Database) {}

  async getBoard(
    boardId: ID<AttendanceBoard>,
  ): Promise<AttendanceBoard | null> {
    const result = await this.db
      .prepare(
        "SELECT subject_id, start_from, seconds_from_start_to_be_late, seconds_from_be_late_to_end FROM attendance_board WHERE id = ?1 LIMIT 1",
      )
      .bind(boardId)
      .first<{
        subject_id: ID<Subject>;
        start_from: number;
        seconds_from_start_to_be_late: number;
        seconds_from_be_late_to_end: number;
      }>();
    if (!result) {
      return null;
    }
    return {
      id: boardId,
      subject: result.subject_id,
      startFrom: new Date(result.start_from * 1000),
      secondsFromStartToBeLate: result.seconds_from_start_to_be_late,
      secondsFromBeLateToEnd: result.seconds_from_be_late_to_end,
    };
  }

  async update(boards: AttendanceBoard[]): Promise<boolean> {
    const updateStatement = this.db.prepare(
      "UPDATE attendance_board SET start_from = ?1, seconds_from_start_to_be_late = ?2, seconds_from_be_late_to_end = ?3 WHERE id = ?4",
    );
    const rows = await this.db.batch(
      boards.map((board) =>
        updateStatement.bind(
          Math.floor(board.startFrom.valueOf() / 1000),
          board.secondsFromStartToBeLate,
          board.secondsFromBeLateToEnd,
          board.id,
        ),
      ),
    );
    return rows.every(({ success }) => success);
  }

  async delete(boardId: ID<AttendanceBoard>): Promise<boolean> {
    const { success } = await this.db
      .prepare("DELETE FROM attendance_board WHERE id = ?1")
      .bind(boardId)
      .run();
    return success;
  }

  async boardsByEachSubject(subjects: Subject[]): Promise<AttendanceBoard[][]> {
    if (subjects.length === 0) {
      return [];
    }

    const selectBoard = this.db.prepare(
      "SELECT id, subject_id, start_from, seconds_from_start_to_be_late, seconds_from_be_late_to_end FROM attendance_board WHERE subject_id = ?1 ORDER BY start_from DESC",
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

  async insertBoards(boards: readonly AttendanceBoard[]): Promise<boolean> {
    const statement = this.db.prepare(
      "insert into attendance_board(id, subject_id, start_from, seconds_from_start_to_be_late, seconds_from_be_late_to_end) values (?1, ?2, ?3, ?4 ,?5)",
    );
    const statements = boards.map(
      ({
        id,
        subject,
        startFrom,
        secondsFromStartToBeLate,
        secondsFromBeLateToEnd,
      }) =>
        statement.bind(
          id,
          subject,
          Math.floor(startFrom.valueOf() / 1000),
          secondsFromStartToBeLate,
          secondsFromBeLateToEnd,
        ),
    );

    const rows = await this.db.batch(statements);
    return rows.every((row) => row.success);
  }
}
