-- This file runs after the schema during db:test:init and db:test:reset.
-- Keep seed statements idempotent so init can be rerun safely.

-- Test-only account. The hash was generated with the same Argon2 password
-- hasher used by the current API. This lets the seeded account log in normally.
-- main_hand is NULL because the current schema stores L/R or NULL; the API maps
-- NULL to the UI's "both" option.
INSERT INTO users (
    display_name,
    username,
    password_hash,
    email,
    main_hand
)
VALUES (
    'bowlerhatguy',
    'user1',
    CAST('$argon2id$v=19$m=65536,t=3,p=4$7QxjPlm1rH6nJH7kIIYNwA$7zRwBaFEicjfPLicfmxF1dvRB3RDEOB2OVHJsJh1DbI' AS BLOB), -- Bowling1
    'bowling@mail.com',
    NULL
)
ON CONFLICT(username) DO UPDATE SET
    display_name = excluded.display_name,
    password_hash = excluded.password_hash,
    email = excluded.email,
    main_hand = excluded.main_hand;

-- Additional test account for multi-user scenarios.
-- Login: heisenberg / breakbad
INSERT INTO users (
    display_name,
    username,
    password_hash,
    email,
    main_hand
)
VALUES (
    'Bryan Cranston',
    'heisenberg',
    CAST('$argon2id$v=19$m=65536,t=3,p=4$FgfKdcXgoeAQy2bEKTeTHQ$J1MY87BQ6j6CVc50Gl/0CjkazWiyy93dV8swlAyKiMM' AS BLOB),
    'heisenberg@mail.com',
    NULL
)
ON CONFLICT(username) DO UPDATE SET
    display_name = excluded.display_name,
    password_hash = excluded.password_hash,
    email = excluded.email,
    main_hand = excluded.main_hand;

-- Monty Python and the Holy Grail test account; intentionally has no balls.
-- Login: arthur / holy-grail
INSERT INTO users (
    display_name,
    username,
    password_hash,
    email,
    main_hand
)
VALUES (
    'King Arthur',
    'arthur',
    CAST('$argon2id$v=19$m=65536,t=3,p=4$rCkPQoxC9TmwavZbmT5e7g$eCoX/jREbnvTG+O5pRaVPHiHnASlpPK2YOCF1BcEj/c' AS BLOB),
    'arthur@camelot.test',
    NULL
)
ON CONFLICT(username) DO UPDATE SET
    display_name = excluded.display_name,
    password_hash = excluded.password_hash,
    email = excluded.email,
    main_hand = excluded.main_hand;

-- Test-only bowling balls for the seeded account. Match by name so rerunning
-- db:test:init or db:test:reset does not add duplicate rows.
UPDATE balls
SET weight = CASE ball_name
    WHEN 'DARE' THEN 16
    WHEN 'Humility' THEN 8
    WHEN 'Tranz' THEN 13
END
WHERE user_id = (SELECT user_id FROM users WHERE username = 'user1')
  AND ball_name IN ('DARE', 'Humility', 'Tranz');

INSERT INTO balls (user_id, ball_name, weight, color, core_type)
SELECT users.user_id, seed.ball_name, seed.weight, seed.color, seed.core_type
FROM users
CROSS JOIN (
    SELECT 'Plastic Beach' AS ball_name, 14 AS weight, '#c7ac69' AS color, 'Asymmetric' AS core_type
    UNION ALL SELECT 'White Flag', 15, '#fbfbfb', 'Asymmetric'
    UNION ALL SELECT 'Rhinestone Eyes', 16, '#df3aa5', 'Asymmetric'
    UNION ALL SELECT 'Stylo', 13, '#020202', 'Symmetric'
    UNION ALL SELECT 'Empire Ants', 14, '#051b55', 'Symmetric'
    UNION ALL SELECT 'Melancholy Hill', 15, '#1eff2d', 'Asymmetric'
    UNION ALL SELECT 'DARE', 16, '#a11d79', 'Asymmetric'
    UNION ALL SELECT 'O Green World', 6, '#265022', 'Asymmetric'
    UNION ALL SELECT 'Humility', 8, '#44b5de', 'Symmetric'
    UNION ALL SELECT 'Tranz', 13, '#9944de', 'Symmetric'
    UNION ALL SELECT 'Clint Eastwood', 12, '#8c6f3d', 'Asymmetric'
    UNION ALL SELECT '19-2000', 19, '#d1ff00', 'Symmetric'
    UNION ALL SELECT 'Tomorrow Comes Today', 12, '#5b8791', 'Symmetric'
    UNION ALL SELECT 'Rock the House', 100, '#e84624', 'Asymmetric'
    UNION ALL SELECT 'Feel Good Inc.', 13, '#94b21b', 'Symmetric'
    UNION ALL SELECT 'Dirty Harry', 12, '#a48d55', 'Asymmetric'
    UNION ALL SELECT 'Kids with Guns', 9, '#f21c36', 'Asymmetric'
    UNION ALL SELECT 'El Mañana', 14, '#9dbad4', 'Symmetric'
    UNION ALL SELECT 'Every Planet We Reach Is Dead', 16, '#201550', 'Asymmetric'
    UNION ALL SELECT 'Last Living Souls', 11, '#1c3356', 'Asymmetric'
    UNION ALL SELECT 'Fire Coming Out of the Monkey''s Head', 16, '#d65b1f', 'Asymmetric'
    UNION ALL SELECT 'Don''t Get Lost in Heaven', 7, '#bacbf2', 'Symmetric'
    UNION ALL SELECT 'Superfast Jellyfish', 3, '#ff5bbf', 'Symmetric'
    UNION ALL SELECT 'Some Kind of Nature', 14, '#4e7537', 'Symmetric'
    UNION ALL SELECT 'Sweepstakes', 777, '#d4af37', 'Asymmetric'
    UNION ALL SELECT 'Broken', 8, '#d9a4b7', 'Symmetric'
    UNION ALL SELECT 'Welcome to the World of the Plastic Beach', 12, '#d0a96d', 'Asymmetric'
    UNION ALL SELECT 'Saturnz Barz', 15, '#5e123b', 'Asymmetric'
    UNION ALL SELECT 'Andromeda', 14, '#6155cc', 'Symmetric'
    UNION ALL SELECT 'Strobelite', 1, '#00c9b7', 'Symmetric'
) AS seed
WHERE users.username = 'user1'
  AND NOT EXISTS (
      SELECT 1
      FROM balls
      WHERE balls.user_id = users.user_id
        AND balls.ball_name = seed.ball_name
  );

-- Test-only Breaking Bad-inspired balls for the Heisenberg account.
INSERT INTO balls (user_id, ball_name, weight, color, core_type)
SELECT users.user_id, seed.ball_name, seed.weight, seed.color, seed.core_type
FROM users
CROSS JOIN (
    SELECT 'Heisenberg' AS ball_name, 14 AS weight, '#168b89' AS color, 'Asymmetric' AS core_type
    UNION ALL SELECT 'Blue Sky', 15, '#2878d0', 'Asymmetric'
    UNION ALL SELECT 'Los Pollos Hermanos', 15, '#e6bd32', 'Symmetric'
    UNION ALL SELECT 'Better Call Saul', 13, '#f0c83e', 'Symmetric'
    UNION ALL SELECT 'Say My Name', 16, '#171717', 'Asymmetric'
    UNION ALL SELECT 'The One Who Knocks', 16, '#38312b', 'Asymmetric'
    UNION ALL SELECT 'Fulminated Mercury', 12, '#c9c7be', 'Asymmetric'
    UNION ALL SELECT 'Pink Teddy Bear', 9, '#ed78a9', 'Symmetric'
    UNION ALL SELECT 'Crystal Ship', 14, '#8ac8e8', 'Symmetric'
    UNION ALL SELECT 'Jesse Pinkman', 12, '#e9c945', 'Symmetric'
    UNION ALL SELECT 'Hank Schrader', 15, '#635b3d', 'Asymmetric'
    UNION ALL SELECT 'Tuco Salamanca', 16, '#d45125', 'Asymmetric'
    UNION ALL SELECT 'Walt''s Hat', 6, '#81502d', 'Symmetric'
    UNION ALL SELECT 'Ozymandias', 15, '#b98f4d', 'Asymmetric'
    UNION ALL SELECT 'Face Off', 13, '#6e382f', 'Asymmetric'
    UNION ALL SELECT 'Albuquerque', 14, '#c49b59', 'Symmetric'
) AS seed
WHERE users.username = 'heisenberg'
  AND NOT EXISTS (
      SELECT 1
      FROM balls
      WHERE balls.user_id = users.user_id
        AND balls.ball_name = seed.ball_name
  );

-- Fifteen complete, distinct games for the seeded user1 history. Every game
-- has its own dated session, ten frames, and twenty shot records. Scores are
-- shot-derived (45 through 59) and match the editable summary columns too.
INSERT INTO events (user_id, event_name, event_type)
SELECT users.user_id, 'User1 Test Game History', 'Practice'
FROM users
WHERE users.username = 'user1'
  AND NOT EXISTS (
      SELECT 1
      FROM events
      WHERE events.user_id = users.user_id
        AND events.event_name = 'User1 Test Game History'
  );

WITH RECURSIVE game_numbers(n) AS (
    VALUES (1)
    UNION ALL
    SELECT n + 1 FROM game_numbers WHERE n < 15
)
INSERT INTO sessions (event_id, date_time, opponent, score, record)
SELECT
    (SELECT MIN(event_id) FROM events
     WHERE user_id = users.user_id AND event_name = 'User1 Test Game History'),
    datetime('2026-01-05', printf('+%d days', (game_numbers.n - 1) * 7)),
    'Test Opponent ' || printf('%02d', game_numbers.n),
    9 * CASE WHEN game_numbers.n <= 9 THEN 5 ELSE 6 END
      + CASE WHEN game_numbers.n <= 9 THEN game_numbers.n - 1 ELSE game_numbers.n - 10 END,
    NULL
FROM game_numbers
CROSS JOIN users
WHERE users.username = 'user1'
  AND NOT EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.event_id = (
          SELECT MIN(event_id) FROM events
          WHERE user_id = users.user_id AND event_name = 'User1 Test Game History'
      )
        AND sessions.opponent = 'Test Opponent ' || printf('%02d', game_numbers.n)
  );

WITH RECURSIVE game_numbers(n) AS (
    VALUES (1)
    UNION ALL
    SELECT n + 1 FROM game_numbers WHERE n < 15
)
INSERT INTO games (session_id, game_number, lane_number, game_score, game_result)
SELECT
    sessions.session_id,
    game_numbers.n,
    1 + ((game_numbers.n - 1) % 8),
    9 * CASE WHEN game_numbers.n <= 9 THEN 5 ELSE 6 END
      + CASE WHEN game_numbers.n <= 9 THEN game_numbers.n - 1 ELSE game_numbers.n - 10 END,
    NULL
FROM game_numbers
JOIN sessions
  ON sessions.opponent = 'Test Opponent ' || printf('%02d', game_numbers.n)
JOIN events
  ON events.event_id = sessions.event_id
JOIN users
  ON users.user_id = events.user_id
WHERE users.username = 'user1'
  AND events.event_name = 'User1 Test Game History'
  AND NOT EXISTS (
      SELECT 1 FROM games
      WHERE games.session_id = sessions.session_id
        AND games.game_number = game_numbers.n
  );

WITH RECURSIVE frame_numbers(n) AS (
    VALUES (1)
    UNION ALL
    SELECT n + 1 FROM frame_numbers WHERE n < 10
)
INSERT INTO frames (game_id, frame_number, frame_result)
SELECT
    games.game_id,
    frame_numbers.n,
    CASE WHEN frame_numbers.n < 10
      THEN frame_numbers.n * CASE WHEN games.game_number <= 9 THEN 5 ELSE 6 END
      ELSE 9 * CASE WHEN games.game_number <= 9 THEN 5 ELSE 6 END
        + CASE WHEN games.game_number <= 9 THEN games.game_number - 1 ELSE games.game_number - 10 END
    END
FROM games
JOIN sessions ON sessions.session_id = games.session_id
JOIN events ON events.event_id = sessions.event_id
JOIN users ON users.user_id = events.user_id
CROSS JOIN frame_numbers
WHERE users.username = 'user1'
  AND events.event_name = 'User1 Test Game History'
  AND NOT EXISTS (
      SELECT 1 FROM frames
      WHERE frames.game_id = games.game_id
        AND frames.frame_number = frame_numbers.n
  );

WITH shot_numbers(n) AS (
    VALUES (1), (2)
)
INSERT INTO shots (frame_id, shot_number, foul, pin_leave, comment)
SELECT
    frames.frame_id,
    shot_numbers.n,
    0,
    1023 - ((1 << CASE
        WHEN frames.frame_number < 10 AND games.game_number <= 9 THEN 5
        WHEN frames.frame_number < 10 THEN 6
        WHEN games.game_number <= 9 THEN games.game_number - 1
        ELSE games.game_number - 10
    END) - 1),
    'Seed game ' || games.game_number || ', frame ' || frames.frame_number || ', shot ' || shot_numbers.n
FROM frames
JOIN games ON games.game_id = frames.game_id
JOIN sessions ON sessions.session_id = games.session_id
JOIN events ON events.event_id = sessions.event_id
JOIN users ON users.user_id = events.user_id
CROSS JOIN shot_numbers
WHERE users.username = 'user1'
  AND events.event_name = 'User1 Test Game History'
  AND NOT EXISTS (
      SELECT 1 FROM shots
      WHERE shots.frame_id = frames.frame_id
        AND shots.shot_number = shot_numbers.n
  );
