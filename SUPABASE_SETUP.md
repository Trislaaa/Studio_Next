# ⚠️ IPv6 Issue Detected

The "Direct Connection" (starting with `db.`) is **IPv6 Only**. 
Your system/network is trying to connect via IPv4, which is why it fails.

## ✅ The Fix: Use Connection Pooler

1. Go to Supabase Dashboard > Settings > Database.
2. Under "Connection string", click the **"Connection pooling"** tab.
3. The URL **MUST** start with `aws-0-...` (e.g. `aws-0-ap-south-1.pooler.supabase.com`).
4. **DO NOT** use the one starting with `db.`.

## Correct Format Example:
```
postgresql://postgres.lkcokmnmhwmssvjjbjxg:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

Please copy the **Connection pooling** URL and provide it (or update .env).
