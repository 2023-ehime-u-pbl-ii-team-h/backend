import {
  AttendanceBoard,
  AttendanceBoardRepository,
} from "../model/attendance-board";
import { ID } from "../model/id";
import { Subject } from "../model/subject";
import { newBoards } from "./new-boards";
import { expect, test, vi } from "vitest";

test("new boards", async () => {
  const repo: AttendanceBoardRepository = {
    getBoard: () =>
      Promise.resolve({
        id: "board01" as ID<AttendanceBoard>,
        subject: "sub01" as ID<Subject>,
        startFrom: new Date("2024-01-08T13:50:00Z"),
        secondsFromStartToBeLate: 30 * 60,
        secondsFromBeLateToEnd: 60 * 60,
      }),
    insertBoards: () => Promise.resolve(true),
  };
  const insertBoardsSpy = vi.spyOn(repo, "insertBoards");

  const res = await newBoards({
    reqBody: {
      subject: "sub01",
      boards: [
        {
          startFrom: "2024-04-01T13:30:00Z",
          secondsFromStartToBeLate: 30 * 60,
          secondsFromBeLateToEnd: 60 * 60,
        },
      ],
    },
    repo,
  });

  expect(res[0]).toBe("OK");
  const board = insertBoardsSpy.mock.calls[0][0][0];
  expect(board.subject).toBe("sub01");
  expect(board.startFrom).toStrictEqual(new Date("2024-04-01T13:30:00Z"));
  expect(board.secondsFromStartToBeLate).toBe(30 * 60);
  expect(board.secondsFromBeLateToEnd).toBe(60 * 60);
});

test("invalid body", async () => {
  const repo: AttendanceBoardRepository = {
    getBoard: () =>
      Promise.resolve({
        id: "board01" as ID<AttendanceBoard>,
        subject: "sub01" as ID<Subject>,
        startFrom: new Date("2024-01-08T13:50:00Z"),
        secondsFromStartToBeLate: 30 * 60,
        secondsFromBeLateToEnd: 60 * 60,
      }),
    insertBoards: () => Promise.resolve(true),
  };

  const res = await newBoards({
    reqBody: {
      subject: "sub01",
      boards: [
        {
          statFrom: "2024-04-01T13:30:00Z",
          secondsFromStartToBeLate: 30 * 60,
          secondsFromBeLateToEnd: 60 * 60,
        },
      ],
    },
    repo,
  });

  expect(res[0]).toBe("BAD_REQUEST");
});

test("insert failure", async () => {
  const repo: AttendanceBoardRepository = {
    getBoard: () =>
      Promise.resolve({
        id: "board01" as ID<AttendanceBoard>,
        subject: "sub01" as ID<Subject>,
        startFrom: new Date("2024-01-08T13:50:00Z"),
        secondsFromStartToBeLate: 30 * 60,
        secondsFromBeLateToEnd: 60 * 60,
      }),
    insertBoards: () => Promise.resolve(false),
  };

  await expect(() =>
    newBoards({
      reqBody: {
        subject: "sub01",
        boards: [
          {
            startFrom: "2024-04-01T13:30:00Z",
            secondsFromStartToBeLate: 30 * 60,
            secondsFromBeLateToEnd: 60 * 60,
          },
        ],
      },
      repo,
    }),
  ).rejects.toThrowError(new Error("insert boards failed"));
});
