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
if (currentDateTime < toAttendAt) {
    return "TOO_EARLY";
} else if(currentDateTime == toAttendAt){
    return "ATTENDED";
}else if(toAttendAt < currentDateTime && currentDateTime < toAttendAt){
    return "ATTENDED";
}else if(4){
    return "BE_LATE";
}else if(5){
    return "BE_LATE";
}else if(6){
    return "CLOSED";
}

}