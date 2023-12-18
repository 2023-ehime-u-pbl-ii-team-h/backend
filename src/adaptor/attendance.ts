import { Attendance } from "../model/attendance";
import { AttendanceRepository } from "../service/attend";

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
}
