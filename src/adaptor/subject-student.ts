import { Student } from "../model/account";
import { Subject } from "../model/subject";

export class D1SubjectStudentRepository {
  constructor(private readonly db: D1Database) {}

  studentsByEachSubjects(teachers: readonly Subject[]): Promise<Student[][]> {
    throw new Error("todo");
  }

  subjectsByEachStudent(teachers: readonly Student[]): Promise<Subject[][]> {
    throw new Error("todo");
  }
}
