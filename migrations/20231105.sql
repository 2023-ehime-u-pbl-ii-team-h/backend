CREATE TABLE IF NOT EXISTS account(
id TEXT PRIMARY KEY,
name TEXT NOT NULL,
email TEXT NOT NULL,
role TEXT NOT NULL CHECK (role IN ('STUDENT', 'TEACHER'))
);

CREATE TABLE IF NOT EXISTS session( 
id TEXT NOT NULL PRIMARY KEY,
account_id NOT NULL,
login_at NOT NULL,
device_name TEXT,

FOREIGN KEY (account_id)
REFERENCES account(id)
);

CREATE TABLE IF NOT EXISTS subject(
id TEXT NOT NULL PRIMARY KEY,
name TEXT NOT NULL,       
);

CREATE TABLE IF NOT EXISTS charge(
id TEXT PRIMARY KEY,
teacher_id TEXT,
subject_id TEXT, 

FOREIGN KEY (teacher_id)
REFERENCES subject(id)
FOREIGN KEY (subject_id)
REFERENCES subject(id)
);

CREATE TABLE IF NOT EXISTS registration(
id TEXT PRIMARY KEY, 
student_id TEXT, 
subject_id TEXT,

FOREIGN KEY (student_id)
REFERENCES student(id)
FOREIGN KEY (subject_id)
REFERENCES subject(id)
);

CREATE TABLE IF NOT EXISTS attendance_board(
id TEXT PRIMARY KEY,
subject_id subject(id),
start_from INTEGER NOT NULL,
seconds_from_start_to_be_late INTEGER NOT NULL CHECK (seconds_from_start_to_be_late > 0),
seconds_from_be_late_to_end INTEGER NOT NULL CHECK (seconds_from_be_late_to_end > 0),

FOREIGN KEY (subject_id)
REFERENCES subject(id)
);

CREATE TABLE IF NOT EXISTS attendance(
id TEXT PRIMARY KEY,
created_at INTEGER NOT NULL,
who TEXT NOT NULL,
where TEXT NOT NULL,

FOREIGN KEY (who)
REFERENCES student(id)
FOREIGN KEY (where)
REFERENCES attendance_board(id)
);