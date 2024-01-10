-- migrate charge
CREATE TABLE new_charge (
    teacher_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    PRIMARY KEY (teacher_id, subject_id),
    FOREIGN KEY (teacher_id) REFERENCES account(id),
    FOREIGN KEY (subject_id) REFERENCES subject(id)
);

INSERT INTO
    new_charge(teacher_id, subject_id)
SELECT
    teacher_id,
    subject_id
FROM
    charge;

DROP TABLE charge;

ALTER TABLE
    new_charge RENAME TO charge;

-- migrate registration
CREATE TABLE new_registration (
    student_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    PRIMARY KEY (student_id, subject_id),
    FOREIGN KEY (student_id) REFERENCES account(id),
    FOREIGN KEY (subject_id) REFERENCES subject(id)
);

INSERT INTO
    new_registration(student_id, subject_id)
SELECT
    student_id,
    subject_id
FROM
    registration;

DROP TABLE registration;

ALTER TABLE
    new_registration RENAME TO registration;
