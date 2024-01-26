import { Teacher } from "./account";
import { ID } from "./id";

export type Subject = {
  readonly id: ID<Subject>;
  readonly name: string;
};

export interface SubjectRepository {
  createSubject(
    id: ID<Subject>,
    name: string,
    assignees: ID<Teacher>[],
  ): Promise<void>;

  getSubject(subjectId: ID<Subject>): Promise<Subject | null>;
}
