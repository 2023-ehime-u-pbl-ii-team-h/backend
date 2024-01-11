import { ID } from "../model/id";
import { Subject } from "../model/subject";
import { SubjectRepository } from "../service/new-subject";
import { AttendanceBoard } from "../model/attendance-board";

export class D1SubjectRepository implements SubjectRepository {
  constructor(private readonly db: D1Database) {}

  async createSubject(id: ID<Subject>, name: string): Promise<void> {
    await this.db
      .prepare("INSERT INTO subject (id, name) VALUES (?, ?)")
      .bind(id, name)
      .run();
  }

  async getSubject(subjectId: ID<Subject>): Promise<Subject | null> {
    const [nameRes, boardsRes] = await this.db.batch([
      this.db.prepare("SELECT name FROM subject WHERE id = ?1").bind(subjectId),
      this.db
        .prepare(
          "SELECT id, start_from, seconds_from_start_to_be_late, seconds_from_be_late_to_end FROM attendance_board WHERE subject_id = ?1",
        )
        .bind(subjectId),
    ]);
    if (!nameRes.results || !boardsRes.results) {
      throw new Error("invalid query");
    }
    if (nameRes.results.length !== 1) {
      return null;
    }
    const name = nameRes.results[0];
    boardsRes.results;
    return new Subject(
      subjectId,
      name as string,
      (
        boardsRes.results as {
          id: ID<AttendanceBoard>;
          start_from: number;
          seconds_from_start_to_be_late: number;
          seconds_from_be_late_to_end: number;
        }[]
      ).map(
        ({
          id,
          start_from,
          seconds_from_start_to_be_late,
          seconds_from_be_late_to_end,
        }): AttendanceBoard => ({
          id,
          subject: subjectId,
          startFrom: new Date(start_from * 1000),
          secondsFromStartToBeLate: seconds_from_start_to_be_late,
          secondsFromBeLateToEnd: seconds_from_be_late_to_end,
        }),
      ),
    );
  }

  async searchSubjects(
    partialName: string,
    amount: number,
    offset: number,
  ): Promise<{ id: ID<Subject>; name: string }[]> {
    const { results } = await this.db
      .prepare(
        "SELECT id, name FROM subject WHERE name LIKE ?1 ORDER BY name LIMIT ?2 OFFSET ?3",
      )
      .bind(partialName, amount, offset)
      .all<{ id: ID<Subject>; name: string }>();
    if (!results) {
      throw new Error(`query error with partial name: ${partialName}`);
    }

    return results;
  }
}
