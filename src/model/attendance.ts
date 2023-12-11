import { ID } from "./id";
import { Student } from "./account";
import { AttendanceBoard } from "./attendance-board";

export type Attendance = {
  readonly id: ID<Attendance>;
  readonly created_at: number;
  readonly who: ID<Student>; //事前条件：whoに相当する学生のエンティティがただ一つ存在する
  readonly where: ID<AttendanceBoard>; //事前条件：whereに相当する出席申請受付のエンティティがただ一つ存在する
};
