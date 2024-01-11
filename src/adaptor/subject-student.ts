import { Student } from "../model/account";
import { Subject } from "../model/subject";

export class D1SubjectStudentRepository {
  constructor(private readonly db: D1Database) {}

  async studentsByEachSubjects(
    subjects: readonly Subject[],
  ): Promise<Student[][]> {
    const selectStudent = this.db.prepare(
      "SELECT account.id, account.name, account.email, account.role FROM registration INNER JOIN account ON registration.student_id = account.id AND registration.subject_id = ?1 AND account.role = 'STUDENT'",
    );

    const resultsBySubject = await this.db.batch<Student>(
      subjects.map(({ id }) => selectStudent.bind(id)),
    );

    return resultsBySubject.map(({ results }) => {
      if (!results) {
        throw new Error("related account query failed");
      }
      return results;
    });
  }

  subjectsByEachStudent(students: readonly Student[]): Promise<Subject[][]> {
    throw new Error("todo");
  }
}
