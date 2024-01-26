import {
  AttendanceBoard,
  AttendanceBoardRepository,
  updateWith,
} from "../model/attendance-board";
import { ID } from "../model/id";
import { Subject, SubjectRepository } from "../model/subject";
import { z } from "zod";

export type EditBoardsDeps = {
  boardRepo: AttendanceBoardRepository;
  subjectRepo: SubjectRepository;
  subjectId: ID<Subject>;
  boardId: ID<AttendanceBoard>;
  reqBody: unknown;
};

export type EditBoardsResult = "OK" | "NOT_FOUND" | "BAD_REQUEST";

export async function editBoards({
  boardRepo,
  subjectRepo,
  subjectId,
  boardId,
  reqBody,
}: EditBoardsDeps): Promise<EditBoardsResult> {
  const subject = await subjectRepo.getSubject(subjectId);
  if (!subject) {
    return "NOT_FOUND";
  }
  const [boards] = await boardRepo.boardsByEachSubject([subject]);
  const foundIndex = boards.findIndex(({ id }) => id === boardId);
  if (foundIndex < 0) {
    return "NOT_FOUND";
  }

  const schema = z.object({
    start_from: z.string().datetime().optional(),
    seconds_from_start_to_be_late: z.number().positive().optional(),
    seconds_from_be_late_to_end: z.number().positive().optional(),
    change_all_after: z.boolean().optional(),
  });
  const parseResult = await schema.safeParseAsync(reqBody);
  if (!parseResult.success) {
    return "BAD_REQUEST";
  }

  const parsed = parseResult.data;
  if (parsed.change_all_after) {
    const shiftAmount = parsed.start_from
      ? new Date(parsed.start_from).valueOf() -
        boards[foundIndex].startFrom.valueOf()
      : 0;
    const partialNew = {
      secondsFromStartToBeLate: parsed.seconds_from_start_to_be_late ?? null,
      secondsFromBeLateToEnd: parsed.seconds_from_be_late_to_end ?? null,
    };
    boards.push(
      ...boards.splice(foundIndex).map((old) =>
        updateWith(old, {
          ...partialNew,
          startFrom: new Date(old.startFrom.valueOf() + shiftAmount),
        }),
      ),
    );
    await boardRepo.update(boards);
  } else {
    const partialNew = {
      startFrom: parsed.start_from ? new Date(parsed.start_from) : null,
      secondsFromStartToBeLate: parsed.seconds_from_start_to_be_late ?? null,
      secondsFromBeLateToEnd: parsed.seconds_from_be_late_to_end ?? null,
    };
    await boardRepo.update([updateWith(boards[foundIndex], partialNew)]);
  }
  return "OK";
}
