import { Account, Teacher } from "../model/account";
import { ID } from "../model/id";
import { Session } from "../model/session";
import { SubjectRepository } from "../model/subject";
import { AccountQueryService, newSubject } from "./new-subject";
import { expect, test, vi } from "vitest";

test("new subject", async () => {
  const query: AccountQueryService = {
    existsAll: () => Promise.resolve(true),
  };
  const existsAllSpy = vi.spyOn(query, "existsAll");
  const repo: SubjectRepository = {
    createSubject: () => Promise.resolve(),
  };
  const createSubjectSpy = vi.spyOn(repo, "createSubject");

  const res = await newSubject({
    session: new Session(
      "ses01" as ID<Session>,
      {
        id: "acc01" as ID<Account>,
        name: "TEST Teacher",
        role: "TEACHER",
        email: "test.teacher@example.com",
      },
      new Date("2024-01-08T02:19:59Z"),
      "TEST Phone",
    ),
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
  const repo: SubjectRepository = {
    createSubject: () => Promise.resolve(),
  };

  const res = await newSubject({
    session: new Session(
      "ses01" as ID<Session>,
      {
        id: "acc01" as ID<Account>,
        name: "TEST Teacher",
        role: "TEACHER",
        email: "test.teacher@example.com",
      },
      new Date("2024-01-08T02:19:59Z"),
      "TEST Phone",
    ),
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
  const repo: SubjectRepository = {
    createSubject: () => Promise.resolve(),
  };

  const res = await newSubject({
    session: new Session(
      "ses01" as ID<Session>,
      {
        id: "acc01" as ID<Account>,
        name: "TEST Teacher",
        role: "TEACHER",
        email: "test.teacher@example.com",
      },
      new Date("2024-01-08T02:19:59Z"),
      "TEST Phone",
    ),
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
