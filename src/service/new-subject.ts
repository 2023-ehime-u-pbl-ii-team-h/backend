import { Account, Teacher, isTeacher } from "../model/account";
import { ID } from "../model/id";
import { Subject, SubjectRepository } from "../model/subject";
import { nanoid } from "nanoid";

export interface AccountQueryService {
  existsAll(...ids: ID<Account>[]): Promise<boolean>;
}

export interface NewSubjectParams {
  name: string;
  assignees: ID<Teacher>[];
}

export interface NewSubjectDependencies {
  account: Account;
  params: NewSubjectParams;
  query: AccountQueryService;
  repo: SubjectRepository;
}

export interface NewSubjectResponse {
  id: ID<Subject>;
  name: string;
  assignees: readonly ID<Teacher>[];
}

export async function newSubject({
  account,
  params,
  query,
  repo,
}: NewSubjectDependencies): Promise<NewSubjectResponse | null> {
  if (!isTeacher(account)) {
    return null;
  }

  const assigneesSet = new Set(params.assignees);
  if (!assigneesSet.has(account.id)) {
    return null;
  }

  const assignees = [...assigneesSet.values()];
  if (!(await query.existsAll(...assignees))) {
    return null;
  }

  const newSubjectID = nanoid() as ID<Subject>;
  await repo.createSubject(newSubjectID, params.name, assignees);
  return {
    id: newSubjectID,
    name: params.name,
    assignees,
  };
}
