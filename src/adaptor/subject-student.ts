import { Student } from "../model/account";
import { AttendanceBoard } from "../model/attendance-board";
import { ID } from "../model/id";
import { Subject } from "../model/subject";

export class D1SubjectStudentRepository {
  constructor(private readonly db: D1Database) {}

  async studentsByEachSubjects(
    subjects: readonly Subject[],
  ): Promise<Student[][]> {
    const selectStudent = this.db.prepare(
      "SELECT account.id, account.name, account.email, account.role FROM registration INNER JOIN account ON registration.student_id = account.id AND registration.subject_id = ?1 AND account.role = 'STUDENT'",
    );

    const resultsBySubject = await this.db.batch<Student>(
      subjects.map(({ id }) => selectStudent.bind(id)),
    );

    return resultsBySubject.map(({ results }) => {
      if (!results) {
        throw new Error("related account query failed");
      }
      return results;
    });
  }

  async subjectsByEachStudent(
    students: readonly Student[],
  ): Promise<Subject[][]> {
    const selectSubject = this.db.prepare(
      "SELECT subject.id, subject.name FROM registration INNER JOIN subject ON registration.subject_id = subject.id AND registration.student_id = ?1",
    );

    const partialSubjectsByStudent = (
      await this.db.batch<Subject>(
        students.map(({ id }) => selectSubject.bind(id)),
      )
    ).map(({ results }) => {
      if (!results) {
        throw new Error("query subject related to student failed");
      }
      return results;
    });

    const subjectIds = new Set(
      partialSubjectsByStudent.flat().map(({ id }) => id),
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

    return partialSubjectsByStudent.map((partialSubjects) =>
      partialSubjects.map(
        ({ id, name }) => new Subject(id, name, attendanceBoardsById[id] ?? []),
      ),
    );
  }
}
