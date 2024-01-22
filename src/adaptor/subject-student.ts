import { Student } from "../model/account";
import { ID } from "../model/id";
import { Subject } from "../model/subject";

export class D1SubjectStudentRepository {
  constructor(private readonly db: D1Database) {}

  async insert(
    subjectId: ID<Subject>,
    studentId: ID<Student>,
  ): Promise<"OK" | "ALREADY_EXISTS" | "UNKNOWN_SUBJECT"> {
    const exists = !(await this.db
      .prepare(
        "SELECT * FROM registration WHERE student_id = ?1 AND subject_id = ?2",
      )
      .bind(studentId, subjectId)
      .first());
    if (exists) {
      return "ALREADY_EXISTS";
    }

    const { success } = await this.db
      .prepare(
        "INSERT INTO registration (student_id, subject_id) VALUES (?1, ?2)",
      )
      .bind(studentId, subjectId)
      .run();

    return success ? "OK" : "UNKNOWN_SUBJECT";
  }

  async studentsByEachSubjects(
    subjects: readonly Subject[],
  ): Promise<Student[][]> {
    if (subjects.length === 0) {
      return [];
    }

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

  async subjectsByEachStudent(
    students: readonly Student[],
  ): Promise<Subject[][]> {
    if (students.length === 0) {
      return [];
    }

    const selectSubject = this.db.prepare(
      "SELECT subject.id, subject.name FROM registration INNER JOIN subject ON registration.subject_id = subject.id AND registration.student_id = ?1",
    );

    return (
      await this.db.batch<Subject>(
        students.map(({ id }) => selectSubject.bind(id)),
      )
    ).map(({ results }) => {
      if (!results) {
        throw new Error("query subject related to student failed");
      }
      return results;
    });
  }
}
