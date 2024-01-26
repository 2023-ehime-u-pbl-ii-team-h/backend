import { Account, Student } from "../model/account";
import { Attendance, AttendanceRepository } from "../model/attendance";
import {
  AttendanceBoard,
  AttendanceBoardRepository,
  dummyBoardRepo,
} from "../model/attendance-board";
import { ID } from "../model/id";
import { Subject } from "../model/subject";
import { correctAttendance } from "./correct-attendance";
import { expect, test, vi } from "vitest";

test("correct attendance", async () => {
  const attendanceRepo: AttendanceRepository = {
    createAttendance: () => Promise.resolve(),
    getAttendance: () =>
      Promise.resolve({
        id: "att01" as ID<Attendance>,
        created_at: Math.floor(Date.UTC(2024, 0, 8, 14, 20, 2) / 1000),
        where: "board01" as ID<AttendanceBoard>,
        who: "acc01" as ID<Student>,
      }),
    updateAttendance: () => Promise.resolve(),
  };
  const getAttendanceSpy = vi.spyOn(attendanceRepo, "getAttendance");
  const updateAttendanceSpy = vi.spyOn(attendanceRepo, "updateAttendance");
  const boardRepo: AttendanceBoardRepository = {
    ...dummyBoardRepo,
    getBoard: () =>
      Promise.resolve({
        id: "board01" as ID<AttendanceBoard>,
        subject: "sub01" as ID<Subject>,
        startFrom: new Date("2024-01-08T13:50:00Z"),
        secondsFromStartToBeLate: 30 * 60,
        secondsFromBeLateToEnd: 60 * 60,
      }),
  };
  const getBoardSpy = vi.spyOn(boardRepo, "getBoard");

  const res = await correctAttendance({
    account: {
      id: "acc01" as ID<Account>,
      name: "TEST Teacher",
      role: "TEACHER",
      email: "test.teacher@example.com",
    },
    target: "att01" as ID<Attendance>,
    timeToSet: new Date("2024-01-08T14:19:59Z"),
    attendanceRepo,
    boardRepo,
  });

  expect(res).toBe("OK");
  expect(getAttendanceSpy).toHaveBeenCalledWith("att01");
  expect(updateAttendanceSpy).toHaveBeenCalledWith({
    id: "att01" as ID<Attendance>,
    created_at: Math.floor(Date.UTC(2024, 0, 8, 14, 19, 59) / 1000),
    where: "board01" as ID<AttendanceBoard>,
    who: "acc01" as ID<Student>,
  });
  expect(getBoardSpy).toHaveBeenCalledWith("board01");
});

test("not a teacher", async () => {
  const attendanceRepo: AttendanceRepository = {
    createAttendance: () => Promise.resolve(),
    getAttendance: () =>
      Promise.resolve({
        id: "att01" as ID<Attendance>,
        created_at: Math.floor(Date.UTC(2024, 0, 8, 14, 20, 2) / 1000),
        where: "board01" as ID<AttendanceBoard>,
        who: "acc01" as ID<Student>,
      }),
    updateAttendance: () => Promise.resolve(),
  };
  const boardRepo: AttendanceBoardRepository = {
    ...dummyBoardRepo,
    getBoard: () =>
      Promise.resolve({
        id: "board01" as ID<AttendanceBoard>,
        subject: "sub01" as ID<Subject>,
        startFrom: new Date("2024-01-08T13:50:00Z"),
        secondsFromStartToBeLate: 30 * 60,
        secondsFromBeLateToEnd: 60 * 60,
      }),
  };

  const res = await correctAttendance({
    account: {
      id: "acc02" as ID<Account>,
      name: "TEST Student",
      role: "STUDENT",
      email: "test.student@example.com",
    },
    target: "att01" as ID<Attendance>,
    timeToSet: new Date("2024-01-08T14:19:59Z"),
    attendanceRepo,
    boardRepo,
  });

  expect(res).toBe("UNAUTHORIZED");
});

test("not found attendance", async () => {
  const attendanceRepo: AttendanceRepository = {
    createAttendance: () => Promise.resolve(),
    getAttendance: () => Promise.resolve(null),
    updateAttendance: () => Promise.resolve(),
  };
  const boardRepo: AttendanceBoardRepository = {
    ...dummyBoardRepo,
    getBoard: () =>
      Promise.resolve({
        id: "board01" as ID<AttendanceBoard>,
        subject: "sub01" as ID<Subject>,
        startFrom: new Date("2024-01-08T13:50:00Z"),
        secondsFromStartToBeLate: 30 * 60,
        secondsFromBeLateToEnd: 60 * 60,
      }),
  };

  const res = await correctAttendance({
    account: {
      id: "acc01" as ID<Account>,
      name: "TEST Teacher",
      role: "TEACHER",
      email: "test.teacher@example.com",
    },
    target: "att01" as ID<Attendance>,
    timeToSet: new Date("2024-01-08T14:19:59Z"),
    attendanceRepo,
    boardRepo,
  });

  expect(res).toBe("BAD_REQUEST");
});

test("cannot set to time before start of board", async () => {
  const attendanceRepo: AttendanceRepository = {
    createAttendance: () => Promise.resolve(),
    getAttendance: () =>
      Promise.resolve({
        id: "att01" as ID<Attendance>,
        created_at: Math.floor(Date.UTC(2024, 0, 8, 14, 20, 2) / 1000),
        where: "board01" as ID<AttendanceBoard>,
        who: "acc01" as ID<Student>,
      }),
    updateAttendance: () => Promise.resolve(),
  };
  const boardRepo: AttendanceBoardRepository = {
    ...dummyBoardRepo,
    getBoard: () =>
      Promise.resolve({
        id: "board01" as ID<AttendanceBoard>,
        subject: "sub01" as ID<Subject>,
        startFrom: new Date("2024-01-08T13:50:00Z"),
        secondsFromStartToBeLate: 30 * 60,
        secondsFromBeLateToEnd: 60 * 60,
      }),
  };

  const res = await correctAttendance({
    account: {
      id: "acc01" as ID<Account>,
      name: "TEST Teacher",
      role: "TEACHER",
      email: "test.teacher@example.com",
    },
    target: "att01" as ID<Attendance>,
    timeToSet: new Date("2024-01-08T12:59:59Z"),
    attendanceRepo,
    boardRepo,
  });

  expect(res).toBe("BAD_REQUEST");
});
