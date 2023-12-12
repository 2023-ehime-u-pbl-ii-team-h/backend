import { nanoid } from "nanoid";
import { Teacher } from "../model/account";
import { ID } from "../model/id";
import { Subject } from "../model/subject";
import { SubjectRepository } from "../service/new-subject";

export class D1SubjectRepository implements SubjectRepository {
  constructor(private readonly db: D1Database) {}

  async createSubject(
    id: ID<Subject>,
    name: string,
    assignees: ID<Teacher>[],
  ): Promise<void> {
    const insertCharge = this.db.prepare(
      "INSERT INTO charge (id, teacher_id, subject_id) VALUES (?, ?, ?)",
    );
    await this.db.batch(
      [
        this.db
          .prepare("INSERT INTO subject (id, name) VALUES (?, ?)")
          .bind(id, name),
      ].concat(
        assignees.map((assignee) => insertCharge.bind(nanoid(), assignee, id)),
      ),
    );
  }
}
