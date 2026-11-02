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
    CAST('$argon2id$v=19$m=65536,t=3,p=4$7QxjPlm1rH6nJH7kIIYNwA$7zRwBaFEicjfPLicfmxF1dvRB3RDEOB2OVHJsJh1DbI' AS BLOB),
    'bowling@mail.com',
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
