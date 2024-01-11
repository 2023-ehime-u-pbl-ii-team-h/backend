import { Teacher } from "../model/account";
import { Subject } from "../model/subject";

export class D1SubjectTeacherRepository {
  constructor(private readonly db: D1Database) {}

  async teachersByEachSubject(
    subjects: readonly Subject[],
  ): Promise<Teacher[][]> {
    const statement = this.db.prepare(
      "SELECT account.id, account.name, account.email, account.role FROM charge INNER JOIN account ON account.id = charge.teacher_id AND charge.subject_id = ?1 AND account.role = 'TEACHER'",
    );
    const resultsBySubject = await this.db.batch<Teacher>(
      subjects.map(({ id }) => statement.bind(id)),
    );
    return resultsBySubject.map(({ results }) => {
      if (!results) {
        throw new Error("related account query failed");
      }
      return results;
    });
  }

  subjectsByEachTeacher(teachers: readonly Teacher[]): Promise<Subject[][]> {
    throw new Error("todo");
  }
}
