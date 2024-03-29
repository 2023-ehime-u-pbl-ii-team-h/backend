import { ID } from "../model/id";
import { Subject, SubjectRepository } from "../model/subject";

export class D1SubjectRepository implements SubjectRepository {
  constructor(private readonly db: D1Database) {}

  async createSubject(id: ID<Subject>, name: string): Promise<void> {
    await this.db
      .prepare("INSERT INTO subject (id, name) VALUES (?, ?)")
      .bind(id, name)
      .run();
  }

  async getSubject(subjectId: ID<Subject>): Promise<Subject | null> {
    const name = await this.db
      .prepare("SELECT name FROM subject WHERE id = ?1")
      .bind(subjectId)
      .first<string>("name");
    if (name == null) {
      return null;
    }
    return {
      id: subjectId,
      name,
    };
  }

  async searchSubjects(
    partialName: string,
    amount: number,
    offset: number,
  ): Promise<Subject[]> {
    const { results } = await this.db
      .prepare(
        "SELECT id, name FROM subject WHERE name LIKE ?1 ORDER BY name LIMIT ?2 OFFSET ?3",
      )
      .bind(`%${partialName}%`, amount, offset)
      .all<Subject>();
    if (!results) {
      throw new Error(`query error with partial name: ${partialName}`);
    }
    return results;
  }

  async deleteSubject(subject: Subject): Promise<boolean> {
    const { success } = await this.db
      .prepare("DELETE FROM subject WHERE id = ?1")
      .bind(subject.id)
      .run();
    return success;
  }
}
