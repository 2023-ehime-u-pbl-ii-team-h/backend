import { Student } from "../model/account";
import { Attendance } from "../model/attendance";
import { AttendanceBoard } from "../model/attendance-board";
import { ID } from "../model/id";

export class D1AttendanceStudentRepository {
  constructor(private readonly db: D1Database) {}

  async getAttendancesBetween(
    boardId: ID<AttendanceBoard>,
    since: Date,
    until: Date,
  ): Promise<[Attendance, Student][]> {
    const { results } = await this.db
      .prepare(
        `
      SELECT attendance.id, attendance.created_at, attendance.who, attendance."where", account.name, account.email
      FROM attendance
      INNER JOIN account
        ON attendance.who = account.id
      WHERE attendance.created_at BETWEEN ?1 AND ?2 AND attendance."where" = ?3`,
      )
      .bind(
        Math.floor(since.valueOf() / 1000),
        Math.floor(until.valueOf() / 1000),
        boardId,
      )
      .all<{
        id: ID<Attendance>;
        created_at: number;
        who: ID<Student>;
        where: ID<AttendanceBoard>;
        name: string;
        email: string;
      }>();
    if (!results) {
      throw new Error("query attendance and student failed");
    }
    return results.map(({ id, created_at, who, where, name, email }) => [
      {
        id,
        created_at,
        who,
        where,
      },
      {
        id: who,
        name,
        email,
        role: "STUDENT",
      },
    ]);
  }
}
