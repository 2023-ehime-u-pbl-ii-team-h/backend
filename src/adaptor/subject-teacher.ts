import { Teacher } from "../model/account";
import { Subject } from "../model/subject";

export class D1SubjectTeacherRepository {
  constructor(private readonly db: D1Database) {}

  async teachersByEachSubject(
    subjects: readonly Subject[],
  ): Promise<Teacher[][]> {
    throw new Error("todo");
  }

  subjectsByEachTeacher(teachers: readonly Teacher[]): Promise<Subject[][]> {
    throw new Error("todo");
  }
}
