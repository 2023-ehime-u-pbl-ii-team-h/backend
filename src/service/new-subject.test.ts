import { Account, Teacher } from "../model/account";
import { ID } from "../model/id";
import { SubjectRepository, dummySubjectRepo } from "../model/subject";
import { AccountQueryService, newSubject } from "./new-subject";
import { expect, test, vi } from "vitest";

test("new subject", async () => {
  const query: AccountQueryService = {
    existsAll: () => Promise.resolve(true),
  };
  const existsAllSpy = vi.spyOn(query, "existsAll");
  const repo: SubjectRepository = dummySubjectRepo;
  const createSubjectSpy = vi.spyOn(repo, "createSubject");

  const res = await newSubject({
    account: {
      id: "acc01" as ID<Account>,
      name: "TEST Teacher",
      role: "TEACHER",
      email: "test.teacher@example.com",
    },
    params: {
      name: "foo",
      assignees: ["acc01" as ID<Teacher>, "acc01" as ID<Teacher>],
    },
    query,
    repo,
  });

  expect(res).not.toBeNull();
  expect(res?.assignees).toStrictEqual(["acc01"]);
  expect(res?.name).toBe("foo");
  expect(existsAllSpy).toHaveBeenCalledWith("acc01");
  const created = createSubjectSpy.mock.calls[0];
  expect(created[1]).toBe("foo");
  expect(created[2]).toStrictEqual(["acc01"]);
});

test("teacher does not exist", async () => {
  const query: AccountQueryService = {
    existsAll: () => Promise.resolve(false),
  };
  const existsAllSpy = vi.spyOn(query, "existsAll");
  const repo: SubjectRepository = dummySubjectRepo;

  const res = await newSubject({
    account: {
      id: "acc01" as ID<Account>,
      name: "TEST Teacher",
      role: "TEACHER",
      email: "test.teacher@example.com",
    },
    params: {
      name: "foo",
      assignees: ["acc01" as ID<Teacher>, "acc01" as ID<Teacher>],
    },
    query,
    repo,
  });

  expect(res).toBeNull();
  expect(existsAllSpy).toHaveBeenCalledWith("acc01");
});

test("assignees do not include me", async () => {
  const query: AccountQueryService = {
    existsAll: () => Promise.resolve(true),
  };
  const existsAllSpy = vi.spyOn(query, "existsAll");
  const repo: SubjectRepository = dummySubjectRepo;

  const res = await newSubject({
    account: {
      id: "acc01" as ID<Account>,
      name: "TEST Teacher",
      role: "TEACHER",
      email: "test.teacher@example.com",
    },
    params: {
      name: "foo",
      assignees: ["acc02" as ID<Teacher>],
    },
    query,
    repo,
  });

  expect(res).toBeNull();
  expect(existsAllSpy).not.toHaveBeenCalled();
});
