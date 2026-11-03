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
