import { Student } from "../model/account";
import { Attendance } from "../model/attendance";
import { AttendanceRepository } from "../model/attendance";
import { AttendanceBoard } from "../model/attendance-board";
import { ID } from "../model/id";
import { Subject } from "../model/subject";

export interface AttendancesSum {
  onTime: number;
  late: number;
  miss: number;
}

export class D1AttendanceRepository implements AttendanceRepository {
  constructor(private readonly db: D1Database) {}

  async createAttendance(newAttendance: Attendance): Promise<void> {
    const result = await this.db
      .prepare(
        'INSERT INTO attendance (id, created_at, who, "where") VALUES (?1, ?2, ?3, ?4)',
      )
      .bind(
        newAttendance.id,
        newAttendance.created_at,
        newAttendance.who,
        newAttendance.where,
      )
      .run();
    if (!result.success) {
      throw new Error(
        `failed to create a new attendance: ${JSON.stringify(
          newAttendance,
        )}\n${JSON.stringify(result.error)}`,
      );
    }
  }

  getAttendance(attendanceId: ID<Attendance>): Promise<Attendance | null> {
    return this.db
      .prepare(
        'SELECT id, created_at, who, "where" FROM attendance WHERE id = ?1',
      )
      .bind(attendanceId)
      .first<{
        id: ID<Attendance>;
        created_at: number;
        who: ID<Student>;
        where: ID<AttendanceBoard>;
      }>();
  }

  async updateAttendance(attendance: Attendance): Promise<void> {
    const result = await this.db
      .prepare("UPDATE attendance SET created_at = ?1 WHERE id = ?2")
      .bind(attendance.created_at, attendance.id)
      .run();
    if (!result.success) {
      throw new Error("update attendance failed");
    }
  }

  async sumAttendances(
    student: ID<Student>,
    subject: ID<Subject>,
  ): Promise<AttendancesSum> {
    const entry = await this.db
      .prepare(
        `
    SELECT
      SUM(CASE WHEN attendance_board.start_from <= attendance.created_at AND attendance.created_at < (attendance_board.start_from + attendance_board.seconds_from_start_to_be_late) THEN 1 ELSE 0 END) AS on_time,
      SUM(CASE WHEN (attendance_board.start_from + attendance_board.seconds_from_start_to_be_late) <= attendance.created_at AND attendance.created_at < (attendance_board.start_from + attendance_board.seconds_from_start_to_be_late + attendance_board.seconds_from_be_late_to_end) THEN 1 ELSE 0 END) AS late,
      SUM(CASE WHEN (attendance_board.start_from + attendance_board.seconds_from_start_to_be_late + attendance_board.seconds_from_be_late_to_end) <= attendance.created_at THEN 1 ELSE 0 END) AS miss
    FROM attendance
    INNER JOIN attendance_board
      ON attendance."where" = attendance_board.id
    WHERE attendance.who = ?1 AND attendance_board.subject_id = ?2`.replace(
          /\n/g,
          "",
        ),
      )
      .bind(student, subject)
      .first();

    if (entry === null) {
      throw new Error("SUM up query was invalid");
    }
    let { on_time: onTime, late, miss } = entry;
    if (typeof onTime !== "number") {
      onTime = 0;
    }
    if (typeof late !== "number") {
      late = 0;
    }
    if (typeof miss !== "number") {
      miss = 0;
    }
    return { onTime, late, miss } as AttendancesSum;
  }
}
