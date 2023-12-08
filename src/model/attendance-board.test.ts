import { ID } from "./id";

type AttendanceBoard = {
    readonly id: ID<AttendanceBoard>;
    readonly subject: ID<Subject>;
    readonly startFrom: Date;
    readonly secondsFromStartToBeLate: number;
    readonly secondsFromBeLateToEnd: number;
};

type AttendanceState = 
    | "TOO_EARLY"
    | "ATTENDED"
    | "BE_LATE"
    | "CLOSED"
;

function determineState(board: AttendanceBoard, toAttendAt: Date): AttendanceState {
       
const currentDateTime = new Date(); // 現在の日時を取得
const Attendtime = new Date(toAttendAt.getTime() + board.secondsFromStartToBeLate * 1000);//出席と認められる時間
const Latetime = new Date(toAttendAt.getTime() + board.secondsFromStartToBeLate * 1000 + board.secondsFromBeLateToEnd * 1000);//遅刻と認められる時間

if (currentDateTime < toAttendAt) {
    return "TOO_EARLY";
} else if(currentDateTime == toAttendAt){
    return "ATTENDED";
}else if(toAttendAt < currentDateTime && currentDateTime < Attendtime){
    return "ATTENDED";
}else if(currentDateTime == Attendtime){
    return "BE_LATE";
}else if(Attendtime < currentDateTime && currentDateTime < Latetime){
    return "BE_LATE";
}else if(Latetime <= currentDateTime){
    return "CLOSED";
}

}