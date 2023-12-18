import { ID } from "./id";
import { Subject } from "./subject";
import { test, expect } from "vitest";

const subject = new Subject(
  "0" as ID<Subject>,
  "foo",
  [
    {
      startFrom: new Date("2023-01-01"),
    },
    {
      startFrom: new Date("2023-01-10"),
    },
    {
      startFrom: new Date("2023-01-31"),
    },
  ],
  [],
  [],
);

test("to shift all", () => {
  expect(subject.shiftAll(1, 0).boards).toStrictEqual([
    {
      startFrom: new Date("2023-01-02"),
    },
    {
      startFrom: new Date("2023-01-11"),
    },
    {
      startFrom: new Date("2023-02-01"),
    },
  ]);
  expect(subject.shiftAll(-1, 0).boards).toStrictEqual([
    {
      startFrom: new Date("2022-12-31"),
    },
    {
      startFrom: new Date("2023-01-09"),
    },
    {
      startFrom: new Date("2023-01-30"),
    },
  ]);
});

test("to shift last", () => {
  expect(subject.shiftAll(1, 2).boards).toStrictEqual([
    {
      startFrom: new Date("2023-01-01"),
    },
    {
      startFrom: new Date("2023-01-10"),
    },
    {
      startFrom: new Date("2023-02-01"),
    },
  ]);
  expect(subject.shiftAll(-1, 2).boards).toStrictEqual([
    {
      startFrom: new Date("2023-01-01"),
    },
    {
      startFrom: new Date("2023-01-10"),
    },
    {
      startFrom: new Date("2023-01-30"),
    },
  ]);
});

test("not to shift", () => {
  expect(subject.shiftAll(0, 0).boards).toStrictEqual([
    {
      startFrom: new Date("2023-01-01"),
    },
    {
      startFrom: new Date("2023-01-10"),
    },
    {
      startFrom: new Date("2023-01-31"),
    },
  ]);
});
