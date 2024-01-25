import {
  AttendanceBoard,
  AttendanceBoardRepository,
} from "../model/attendance-board";
import { ID } from "../model/id";
import { Subject } from "../model/subject";
import { nanoid } from "nanoid";
import { z } from "zod";

const SCHEMA = z.object({
  boards: z
    .array(
      z.object({
        startFrom: z.string().datetime(),
        secondsFromStartToBeLate: z.number().int().positive(),
        secondsFromBeLateToEnd: z.number().int().positive(),
      }),
    )
    .min(1),
});

export interface NewBoardsDeps {
  subjectId: ID<Subject>;
  reqBody: unknown;
  repo: AttendanceBoardRepository;
}

export type NewBoardsResult =
  | [type: "OK", ids: ID<AttendanceBoard>[]]
  | [type: "BAD_REQUEST"];

export async function newBoards({
  subjectId,
  reqBody,
  repo,
}: NewBoardsDeps): Promise<NewBoardsResult> {
  const parseResult = await SCHEMA.safeParseAsync(reqBody);
  if (!parseResult.success) {
    return ["BAD_REQUEST"];
  }

  const { boards: boardParams } = parseResult.data;
  const boards = boardParams.map(
    ({
      startFrom,
      secondsFromStartToBeLate,
      secondsFromBeLateToEnd,
    }): AttendanceBoard => ({
      id: nanoid() as ID<AttendanceBoard>,
      subject: subjectId,
      startFrom: new Date(startFrom),
      secondsFromStartToBeLate,
      secondsFromBeLateToEnd,
    }),
  );
  boards.sort((a, b) => a.startFrom.getTime() - b.startFrom.getTime());

  const doneInsert = await repo.insertBoards(boards);
  if (!doneInsert) {
    throw new Error("insert boards failed");
  }
  return ["OK", boards.map(({ id }) => id)];
}
