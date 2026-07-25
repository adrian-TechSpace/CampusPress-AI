# Phase 2 Admin Bootstrap

Phase 2 correctly blocks users from self-assigning `admin` or `editor` roles.
That means the first administrator must be promoted once, manually, after signing
up through the normal reader flow.

## One-time SQL

Run this in the Supabase SQL editor. Replace the email with the reader account
that should become the first CampusPress administrator.

```sql
update public.profiles
set
  role = 'admin',
  updated_at = now()
where email = lower('admin@example.com')
  and role = 'reader'
returning id, email, role, updated_at;
```

Expected result: exactly one row is returned with `role = admin`.

## Verification SQL

Use this to confirm the promoted profile exists before testing admin-only RLS
from the application.

```sql
select id, email, role, verified, created_at, updated_at
from public.profiles
where email = lower('admin@example.com');
```

## Safety notes

- Do this only once, for the initial administrator.
- Do not promote arbitrary users from the client. RLS intentionally blocks that.
- After the first admin exists, future privileged roles should be assigned through
  the admin workspace built in Phase 8.
