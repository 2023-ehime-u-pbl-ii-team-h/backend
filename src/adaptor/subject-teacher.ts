import { Teacher } from "../model/account";
import { Subject } from "../model/subject";

export class D1SubjectTeacherRepository {
  constructor(private readonly db: D1Database) {}

  async teachersByEachSubject(
    subjects: readonly Subject[],
  ): Promise<Teacher[][]> {
    if (subjects.length === 0) {
      return [];
    }

    const selectTeacher = this.db.prepare(
      "SELECT account.id, account.name, account.email, account.role FROM charge INNER JOIN account ON account.id = charge.teacher_id AND charge.subject_id = ?1 AND account.role = 'TEACHER'",
    );
    const resultsBySubject = await this.db.batch<Teacher>(
      subjects.map(({ id }) => selectTeacher.bind(id)),
    );
    return resultsBySubject.map(({ results }) => {
      if (!results) {
        throw new Error("related account query failed");
      }
      return results;
    });
  }

  async subjectsByEachTeacher(
    teachers: readonly Teacher[],
  ): Promise<Subject[][]> {
    if (teachers.length === 0) {
      return [];
    }

    const selectSubject = this.db.prepare(
      "SELECT subject.id, subject.name FROM charge INNER JOIN subject ON charge.subject_id = subject.id AND charge.teacher_id = ?1",
    );

    return (
      await this.db.batch<Subject>(
        teachers.map(({ id }) => selectSubject.bind(id)).concat(),
      )
    ).map(({ results }) => {
      if (!results) {
        throw new Error("query subject related to teacher failed");
      }
      return results;
    });
  }
}
