import { Account } from "../model/account";
import { AttendanceRepository } from "../model/attendance";
import { AttendanceBoard } from "../model/attendance-board";
import { ID } from "../model/id";
import { attend } from "./attend";
import { expect, test, vi } from "vitest";

test("attend to board", async () => {
  const repo: AttendanceRepository = {
    createAttendance: () => Promise.resolve(),
    getAttendance: () => Promise.resolve(null),
    updateAttendance: () => Promise.resolve(),
  };
  const createAttendanceSpy = vi.spyOn(repo, "createAttendance");
  const res = await attend({
    input: {
      ipAddress: "192.168.0.1",
      account: {
        id: "acc01" as ID<Account>,
        name: "TEST Student",
        role: "STUDENT",
        email: "test.student@example.com",
      },
    },
    config: { allowIpRegex: ".*" },
    boardQuery: {
      getBoardRegisteredBy: () =>
        Promise.resolve("board01" as ID<AttendanceBoard>),
      hadSubmitted: () => Promise.resolve(false),
    },
    clock: { nowSeconds: () => 100 },
    repo,
  });

  expect(res).toBe("OK");
  const param = createAttendanceSpy.mock.calls[0][0];
  expect(param.created_at).toBe(100);
  expect(param.where).toBe("board01");
  expect(param.who).toBe("acc01");
});

test("blocked by ip address filter", async () => {
  const repo: AttendanceRepository = {
    createAttendance: () => Promise.resolve(),
    getAttendance: () => Promise.resolve(null),
    updateAttendance: () => Promise.resolve(),
  };
  const res = await attend({
    input: {
      ipAddress: "172.0.0.1",
      account: {
        id: "acc01" as ID<Account>,
        name: "TEST Student",
        role: "STUDENT",
        email: "test.student@example.com",
      },
    },
    config: { allowIpRegex: "^192.168.0.1$" },
    boardQuery: {
      getBoardRegisteredBy: () =>
        Promise.resolve("board01" as ID<AttendanceBoard>),
      hadSubmitted: () => Promise.resolve(false),
    },
    clock: { nowSeconds: () => 100 },
    repo,
  });

  expect(res).toBe("FORBIDDEN");
});

test("not a student", async () => {
  const repo: AttendanceRepository = {
    createAttendance: () => Promise.resolve(),
    getAttendance: () => Promise.resolve(null),
    updateAttendance: () => Promise.resolve(),
  };
  const res = await attend({
    input: {
      ipAddress: "192.168.0.1",
      account: {
        id: "acc01" as ID<Account>,
        name: "TEST Teacher",
        role: "TEACHER",
        email: "test.teacher@example.com",
      },
    },
    config: { allowIpRegex: ".*" },
    boardQuery: {
      getBoardRegisteredBy: () =>
        Promise.resolve("board01" as ID<AttendanceBoard>),
      hadSubmitted: () => Promise.resolve(false),
    },
    clock: { nowSeconds: () => 100 },
    repo,
  });

  expect(res).toBe("UNAUTHORIZED");
});

test("invalid board", async () => {
  const repo: AttendanceRepository = {
    createAttendance: () => Promise.resolve(),
    getAttendance: () => Promise.resolve(null),
    updateAttendance: () => Promise.resolve(),
  };
  const res = await attend({
    input: {
      ipAddress: "192.168.0.1",
      account: {
        id: "acc01" as ID<Account>,
        name: "TEST Student",
        role: "STUDENT",
        email: "test.student@example.com",
      },
    },
    config: { allowIpRegex: ".*" },
    boardQuery: {
      getBoardRegisteredBy: () => Promise.resolve(null),
      hadSubmitted: () => Promise.resolve(false),
    },
    clock: { nowSeconds: () => 100 },
    repo,
  });

  expect(res).toBe("NOT_FOUND");
});

test("already submitted", async () => {
  const repo: AttendanceRepository = {
    createAttendance: () => Promise.resolve(),
    getAttendance: () => Promise.resolve(null),
    updateAttendance: () => Promise.resolve(),
  };
  const res = await attend({
    input: {
      ipAddress: "192.168.0.1",
      account: {
        id: "acc01" as ID<Account>,
        name: "TEST Student",
        role: "STUDENT",
        email: "test.student@example.com",
      },
    },
    config: { allowIpRegex: ".*" },
    boardQuery: {
      getBoardRegisteredBy: () =>
        Promise.resolve("board01" as ID<AttendanceBoard>),
      hadSubmitted: () => Promise.resolve(true),
    },
    clock: { nowSeconds: () => 100 },
    repo,
  });

  expect(res).toBe("UNPROCESSABLE_ENTITY");
});
