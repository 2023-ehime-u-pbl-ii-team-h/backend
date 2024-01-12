INSERT INTO
    account (id, name, email, role)
VALUES
    (
        'acc01',
        'TEST Student',
        'test.student@example.com',
        'STUDENT'
    );

INSERT INTO
    account (id, name, email, role)
VALUES
    (
        'acc02',
        'TEST Teacher',
        'test.teacher@example.com',
        'TEACHER'
    );

INSERT INTO
    subject (id, name)
VALUES
    ('sub01', 'TEST Subject');

INSERT INTO
    charge (teacher_id, subject_id)
VALUES
    ('acc02', 'sub01');

INSERT INTO
    registration (student_id, subject_id)
VALUES
    ('acc01', 'sub01');

INSERT INTO
    "session"(id, account_id, login_at, device_name)
VALUES
    ('ses01', 'acc01', unixepoch('now'), 'TEST Phone');

INSERT INTO
    "session"(id, account_id, login_at, device_name)
VALUES
    ('ses02', 'acc02', unixepoch('now'), 'TEST PC');
