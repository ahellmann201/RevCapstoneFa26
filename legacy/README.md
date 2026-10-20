# Archived prototype

`api/` and `test_database/` preserve the earlier frontend team's API and
SQLite development database. The local SQLite file moves here with its data.
`frontend-starter/` preserves the unused Vite starter source.

From the project root:

```powershell
npm.cmd run legacy:db:init
npm.cmd run legacy:api
```

The archived API uses `.env.test` and port 8000. Stop the integrated API
before starting it. Its user-ID login response is incompatible with the
current frontend's JWT contract. It is retained for reference, not as the
integrated demo's backend. Database reset explicitly removes local SQLite data.
