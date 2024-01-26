import { AttendanceBoard, dummyBoardRepo } from "../model/attendance-board";
import { ID } from "../model/id";
import { Subject, dummySubjectRepo } from "../model/subject";
import { editBoards } from "./edit-boards";
import { expect, test, vi } from "vitest";

test("edit boards", async () => {
  const boardRepo = dummyBoardRepo;
  vi.spyOn(boardRepo, "boardsByEachSubject").mockReturnValue(
    Promise.resolve([
      [
        {
          id: "brd01" as ID<AttendanceBoard>,
          subject: "sub01" as ID<Subject>,
          startFrom: new Date("2024-01-01T12:00:00Z"),
          secondsFromStartToBeLate: 300,
          secondsFromBeLateToEnd: 600,
        },
      ],
    ]),
  );
  const updateSpy = vi.spyOn(boardRepo, "update");

  const res = await editBoards({
    subjectId: "sub01" as ID<Subject>,
    boardId: "brd01" as ID<AttendanceBoard>,
    subjectRepo: {
      ...dummySubjectRepo,
      getSubject: () =>
        Promise.resolve({
          id: "sub01" as ID<Subject>,
          name: "foo",
        }),
    },
    boardRepo,
    reqBody: {
      start_from: "2024-01-01T12:30:00Z",
      seconds_from_start_to_be_late: 200,
      seconds_from_be_late_to_end: 300,
      change_all_after: false,
    },
  });

  expect(res).toBe("OK");
  expect(updateSpy).toHaveBeenCalledWith([
    {
      id: "brd01",
      subject: "sub01",
      startFrom: new Date("2024-01-01T12:30:00Z"),
      secondsFromStartToBeLate: 200,
      secondsFromBeLateToEnd: 300,
    },
  ]);
});

test("change after all", async () => {
  const boardRepo = dummyBoardRepo;
  vi.spyOn(boardRepo, "boardsByEachSubject").mockReturnValue(
    Promise.resolve([
      [
        {
          id: "brd01" as ID<AttendanceBoard>,
          subject: "sub01" as ID<Subject>,
          startFrom: new Date("2024-01-01T12:00:00Z"),
          secondsFromStartToBeLate: 300,
          secondsFromBeLateToEnd: 600,
        },
        {
          id: "brd02" as ID<AttendanceBoard>,
          subject: "sub01" as ID<Subject>,
          startFrom: new Date("2024-01-08T12:00:00Z"),
          secondsFromStartToBeLate: 300,
          secondsFromBeLateToEnd: 600,
        },
        {
          id: "brd03" as ID<AttendanceBoard>,
          subject: "sub01" as ID<Subject>,
          startFrom: new Date("2024-01-15T12:00:00Z"),
          secondsFromStartToBeLate: 300,
          secondsFromBeLateToEnd: 600,
        },
      ],
    ]),
  );
  const updateSpy = vi.spyOn(boardRepo, "update");

  const res = await editBoards({
    subjectId: "sub01" as ID<Subject>,
    boardId: "brd02" as ID<AttendanceBoard>,
    subjectRepo: {
      ...dummySubjectRepo,
      getSubject: () =>
        Promise.resolve({
          id: "sub01" as ID<Subject>,
          name: "foo",
        }),
    },
    boardRepo,
    reqBody: {
      start_from: "2024-01-10T12:30:00Z",
      seconds_from_start_to_be_late: 200,
      seconds_from_be_late_to_end: 300,
      change_all_after: true,
    },
  });

  expect(res).toBe("OK");
  expect(updateSpy).toHaveBeenCalledWith([
    {
      id: "brd01",
      subject: "sub01",
      startFrom: new Date("2024-01-01T12:00:00Z"),
      secondsFromStartToBeLate: 300,
      secondsFromBeLateToEnd: 600,
    },
    {
      id: "brd02",
      subject: "sub01",
      startFrom: new Date("2024-01-10T12:30:00Z"),
      secondsFromStartToBeLate: 200,
      secondsFromBeLateToEnd: 300,
    },
    {
      id: "brd03",
      subject: "sub01",
      startFrom: new Date("2024-01-17T12:30:00Z"),
      secondsFromStartToBeLate: 200,
      secondsFromBeLateToEnd: 300,
    },
  ]);
});

test("invalid body", async () => {
  const boardRepo = dummyBoardRepo;
  vi.spyOn(boardRepo, "boardsByEachSubject").mockReturnValue(
    Promise.resolve([
      [
        {
          id: "brd01" as ID<AttendanceBoard>,
          subject: "sub01" as ID<Subject>,
          startFrom: new Date("2024-01-01T12:00:00Z"),
          secondsFromStartToBeLate: 300,
          secondsFromBeLateToEnd: 600,
        },
      ],
    ]),
  );
  const updateSpy = vi.spyOn(boardRepo, "update");

  const res = await editBoards({
    subjectId: "sub01" as ID<Subject>,
    boardId: "brd01" as ID<AttendanceBoard>,
    subjectRepo: {
      ...dummySubjectRepo,
      getSubject: () =>
        Promise.resolve({
          id: "sub01" as ID<Subject>,
          name: "foo",
        }),
    },
    boardRepo,
    reqBody: {
      seconds_from_start_to_be_late: "200",
    },
  });

  expect(res).toBe("BAD_REQUEST");
  expect(updateSpy).not.toHaveBeenCalled();
});

test("unknown subject", async () => {
  const boardRepo = dummyBoardRepo;
  vi.spyOn(boardRepo, "boardsByEachSubject").mockReturnValue(
    Promise.resolve([
      [
        {
          id: "brd01" as ID<AttendanceBoard>,
          subject: "sub01" as ID<Subject>,
          startFrom: new Date("2024-01-01T12:00:00Z"),
          secondsFromStartToBeLate: 300,
          secondsFromBeLateToEnd: 600,
        },
      ],
    ]),
  );
  const updateSpy = vi.spyOn(boardRepo, "update");

  const res = await editBoards({
    subjectId: "sub01" as ID<Subject>,
    boardId: "brd01" as ID<AttendanceBoard>,
    subjectRepo: dummySubjectRepo,
    boardRepo,
    reqBody: {
      start_from: "2024-01-01T12:30:00Z",
      seconds_from_start_to_be_late: 200,
      seconds_from_be_late_to_end: 300,
      change_all_after: false,
    },
  });

  expect(res).toBe("NOT_FOUND");
  expect(updateSpy).not.toHaveBeenCalled();
});

test("unknown board", async () => {
  const boardRepo = dummyBoardRepo;
  vi.spyOn(boardRepo, "boardsByEachSubject").mockReturnValue(
    Promise.resolve([[]]),
  );
  const updateSpy = vi.spyOn(boardRepo, "update");

  const res = await editBoards({
    subjectId: "sub01" as ID<Subject>,
    boardId: "brd01" as ID<AttendanceBoard>,
    subjectRepo: {
      ...dummySubjectRepo,
      getSubject: () =>
        Promise.resolve({
          id: "sub01" as ID<Subject>,
          name: "foo",
        }),
    },
    boardRepo,
    reqBody: {
      start_from: "2024-01-01T12:30:00Z",
      seconds_from_start_to_be_late: 200,
      seconds_from_be_late_to_end: 300,
      change_all_after: false,
    },
  });

  expect(res).toBe("NOT_FOUND");
  expect(updateSpy).not.toHaveBeenCalled();
});
