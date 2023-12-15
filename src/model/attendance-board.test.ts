import { ID } from "./id";
import { Subject } from "./subject";

export type AttendanceBoard = {
    readonly id: ID<AttendanceBoard>;
    readonly subject: ID<Subject>;
    readonly startFrom: Date;
    readonly secondsFromStartToBeLate: number;
    readonly secondsFromBeLateToEnd: number;
};

export type AttendanceState = 
    | "TOO_EARLY"
    | "ATTENDED"
    | "BE_LATE"
    | "CLOSED"
;

export function determineState(board: AttendanceBoard, toAttendAt: Date): AttendanceState {
       
    const currentMs = Date.now(); // 現在の日時を取得
    const beLateMs = toAttendAt.getTime() + board.secondsFromStartToBeLate * 1000;;//出席扱いの時間
    const endMs = toAttendAt.getTime() + board.secondsFromStartToBeLate * 1000 + board.secondsFromBeLateToEnd * 1000;//遅刻扱いの時間

if (currentMs < toAttendAt.getTime()) {
    return "TOO_EARLY";
} else if(currentMs == toAttendAt.getTime()){
    return "ATTENDED";
}else if(toAttendAt.getTime() < currentMs && currentMs < beLateMs){
    return "ATTENDED";
}else if(currentMs == beLateMs){
    return "BE_LATE";
}else if(beLateMs < currentMs && currentMs < endMs){
    return "BE_LATE";
}else if(endMs <= currentMs){
    return "CLOSED";
}

}