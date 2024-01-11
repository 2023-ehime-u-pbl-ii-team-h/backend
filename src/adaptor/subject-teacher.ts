import { Teacher } from "../model/account";
import { AttendanceBoard } from "../model/attendance-board";
import { ID } from "../model/id";
import { Subject } from "../model/subject";

export class D1SubjectTeacherRepository {
  constructor(private readonly db: D1Database) {}

  async teachersByEachSubject(
    subjects: readonly Subject[],
  ): Promise<Teacher[][]> {
    const statement = this.db.prepare(
      "SELECT account.id, account.name, account.email, account.role FROM charge INNER JOIN account ON account.id = charge.teacher_id AND charge.subject_id = ?1 AND account.role = 'TEACHER'",
    );
    const resultsBySubject = await this.db.batch<Teacher>(
      subjects.map(({ id }) => statement.bind(id)),
    );
    return resultsBySubject.map(({ results }) => {
      if (!results) {
        throw new Error("related account query failed");
      }
      return results;
    });
  }

  async subjectsByEachTeacher(
    teachers: readonly Teacher[],
  ): Promise<Subject[][]> {
    const selectSubject = this.db.prepare(
      "SELECT subject.id, subject.name FROM charge INNER JOIN subject ON charge.subject_id = subject.id AND charge.teacher_id = ?1",
    );

    const partialSubjectsByTeacher = (
      await this.db.batch<{ id: ID<Subject>; name: string }>(
        teachers.map(({ id }) => selectSubject.bind(id)).concat(),
      )
    ).map(({ results }) => {
      if (!results) {
        throw new Error("query subject related to teacher failed");
      }
      return results;
    });

    const subjectIds = new Set(
      partialSubjectsByTeacher.flat().map(({ id }) => id),
    );

    const selectAttendanceBoard = this.db.prepare(
      "SELECT id, subject_id, start_from, seconds_from_start_to_be_late, seconds_from_be_late_to_end FROM attendance_board WHERE subject_id = ?1",
    );
    const [attendanceBoards] = (
      await this.db.batch<{
        id: ID<AttendanceBoard>;
        subject_id: ID<Subject>;
        start_from: number;
        seconds_from_start_to_be_late: number;
        seconds_from_be_late_to_end: number;
      }>([...subjectIds.values()].map((id) => selectAttendanceBoard.bind(id)))
    ).map(({ results }) => {
      if (!results) {
        throw new Error("query attendance board related to subject failed");
      }
      return results;
    });

    const attendanceBoardsById: Record<
      ID<Subject>,
      AttendanceBoard[] | undefined
    > = {};
    for (const attendanceBoard of attendanceBoards) {
      if (!attendanceBoardsById[attendanceBoard.subject_id]) {
        attendanceBoardsById[attendanceBoard.subject_id] = [];
      }
      attendanceBoardsById[attendanceBoard.subject_id]!.push({
        id: attendanceBoard.id,
        subject: attendanceBoard.subject_id,
        startFrom: new Date(attendanceBoard.start_from * 1000),
        secondsFromStartToBeLate: attendanceBoard.seconds_from_start_to_be_late,
        secondsFromBeLateToEnd: attendanceBoard.seconds_from_be_late_to_end,
      });
    }

    return partialSubjectsByTeacher.map((partialSubjects) =>
      partialSubjects.map(
        ({ id, name }) => new Subject(id, name, attendanceBoardsById[id] ?? []),
      ),
    );
  }
}
