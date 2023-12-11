import { ID } from "./id";
import { Student } from "./account";
import { AttendanceBoard } from "./attendance-board"

export type Attendance = {
    readonly id: ID<Attendance>;
    readonly created_at: number;
    readonly who: ID<Student>;
    readonly where: ID<AttendanceBoard>;
};