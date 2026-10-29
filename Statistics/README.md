# Bowling statistics

`statistics_calculations.py` contains pure Python scoring and statistics functions.
They can run offline using recorded games and shots, without importing the API or
connecting to SQL Server.

The authenticated API endpoint is `GET /statistics?recent_limit=10`. Use the
existing Bearer token in Swagger at http://localhost:8000/docs. The default recent
limit is 10; allowed values are 1 through 100. That limit affects only the recent
list, not the all-time totals.

Example response for an account with no completed games:

```json
{
  "completed_games": 0,
  "average_score": null,
  "highest_score": null,
  "recent_games": [],
  "invalid_games": 0
}
```

For completed games, `recent_games` contains `game_id`, `played_at`, and `score`.
`played_at` comes from the parent session date, interpreted as UTC; undated games
are last. Equal dates are ordered by descending game ID. Dates are not game
creation timestamps because the schema does not store those.

Scores are calculated from the remaining pins after each recorded shot, with
strike/spare bonuses and tenth-frame rack resets. A completed game must have all
ten legal, complete frames. A genuine completed zero counts; unfinished games do
not count. `average_score` is rounded to two decimals. Empty averages and highest
scores are null rather than a misleading zero.

The calculations deliberately ignore editable `game_score`, `frame_result`, and
`throw_type` values. They do not write calculated scores back to the database.
Invalid shot sequences, duplicate frame numbers, or invalid pin masks exclude the
game and increment `invalid_games`. This counter lets the frontend warn that some
records need attention. Incomplete games are excluded without being marked invalid.

The SQL endpoint reuses the games ownership scope and does not accept a user ID
from the caller. It currently loads all owned game shots to calculate totals;
larger datasets may eventually need precomputed scores or database aggregation.
No schema migration or new package is needed. Frontend statistics UI integration,
strike/spare percentages, and live SQL Server integration tests are separate work.

Run tests from the project root:

```powershell
.\.venv\Scripts\python.exe -m pytest Database/tests -q
```
