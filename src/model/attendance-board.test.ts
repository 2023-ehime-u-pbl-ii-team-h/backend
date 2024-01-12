import { AttendanceBoard, shiftAll } from "./attendance-board";
import { ID } from "./id";
import { Subject } from "./subject";
import { test, expect } from "vitest";

const subjectId = "0" as ID<Subject>;
const boards: readonly AttendanceBoard[] = [
  {
    startFrom: new Date("2023-01-01"),
    id: "0" as ID<AttendanceBoard>,
    subject: subjectId,
    secondsFromStartToBeLate: 300,
    secondsFromBeLateToEnd: 300,
  },
  {
    startFrom: new Date("2023-01-10"),
    id: "0" as ID<AttendanceBoard>,
    subject: subjectId,
    secondsFromStartToBeLate: 300,
    secondsFromBeLateToEnd: 300,
  },
  {
    startFrom: new Date("2023-01-31"),
    id: "0" as ID<AttendanceBoard>,
    subject: subjectId,
    secondsFromStartToBeLate: 300,
    secondsFromBeLateToEnd: 300,
  },
];

const getStartFrom = ({ startFrom }: AttendanceBoard): Date => startFrom;

test("to shift all", () => {
  expect(shiftAll(boards, 1, 0).map(getStartFrom)).toStrictEqual([
    new Date("2023-01-02"),
    new Date("2023-01-11"),
    new Date("2023-02-01"),
  ]);
  expect(shiftAll(boards, -1, 0).map(getStartFrom)).toStrictEqual([
    new Date("2022-12-31"),
    new Date("2023-01-09"),
    new Date("2023-01-30"),
  ]);
});

test("to shift last", () => {
  expect(shiftAll(boards, 1, 2).map(getStartFrom)).toStrictEqual([
    new Date("2023-01-01"),
    new Date("2023-01-10"),
    new Date("2023-02-01"),
  ]);
  expect(shiftAll(boards, -1, 2).map(getStartFrom)).toStrictEqual([
    new Date("2023-01-01"),
    new Date("2023-01-10"),
    new Date("2023-01-30"),
  ]);
});

test("not to shift", () => {
  expect(shiftAll(boards, 0, 0).map(getStartFrom)).toStrictEqual([
    new Date("2023-01-01"),

    new Date("2023-01-10"),

    new Date("2023-01-31"),
  ]);
});
