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
INSERT INTO balls (user_id, ball_name, weight, color, core_type)
SELECT users.user_id, seed.ball_name, seed.weight, seed.color, seed.core_type
FROM users
CROSS JOIN (
    SELECT 'Storm Nova' AS ball_name, 14 AS weight, '#800080' AS color, 'Asymmetric' AS core_type
    UNION ALL SELECT 'Roto Grip Gem', 15, '#DC143C', 'Asymmetric'
    UNION ALL SELECT 'Hammer Black Widow', 16, '#FF8C00', 'Asymmetric'
    UNION ALL SELECT 'Brunswick Rhino', 13, '#4682B4', 'Symmetric'
    UNION ALL SELECT 'Motiv Venom Shock', 14, '#DAA520', 'Symmetric'
    UNION ALL SELECT 'Ebonite The One', 15, '#1E90FF', 'Asymmetric'
    UNION ALL SELECT 'Track Stealth', 12, '#008080', 'Asymmetric'
    UNION ALL SELECT 'Columbia 300 White Dot', 10, '#F5F5F5', 'Pancake'
    UNION ALL SELECT '900 Global Reality', 16, '#FF4500', 'Asymmetric'
    UNION ALL SELECT 'DV8 Trouble Maker', 13, '#32CD32', 'Symmetric'
) AS seed
WHERE users.username = 'user1'
  AND NOT EXISTS (
      SELECT 1
      FROM balls
      WHERE balls.user_id = users.user_id
        AND balls.ball_name = seed.ball_name
  );
