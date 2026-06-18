# Deploying CommunityCanvas Studio

Hosted on **Vercel** with **Supabase Postgres**. The DB layer (`lib/db/`) talks
to Postgres through the Supabase **transaction pooler** (port 6543), which works
on Vercel's serverless functions. The schema is created automatically on first
DB access (idempotent) — no migration step.

## Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Scope | Required | Purpose |
|----------|-------|----------|---------|
| `DATABASE_URL` | runtime | **yes** | Supabase pooler URL (port 6543) |
| `ETH_RPC_URL` | runtime | recommended | Server-side Ethereum RPC for ownership/bitmap reads |
| `NEXT_PUBLIC_ETH_RPC_URL` | build | optional | Client RPC; falls back to public mainnet RPC |
| `NEXT_PUBLIC_WALLETCONNECT_ID` | build | optional | Enables WalletConnect; injected wallet works without it |

`DATABASE_URL` format (Supabase → Project Settings → Database → Connection
string → **Transaction pooler**):

```
postgresql://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:6543/postgres
```

The concrete values for this project live in the vault note
`Projekte/Crypto/Ethereum/Ethereum Secrets.md` (Supabase NormieTogether + DB
password) and `Infrastruktur/Keys & Tokens.md` (Alchemy RPC, WalletConnect ID).

## Deploy

```bash
# from studio/
npx vercel --prod              # first run links/creates the project
# set env vars in the dashboard (or `vercel env add DATABASE_URL production`)
```

Or connect the GitHub repo (`DerDoPhil/CommunityCanvas-Studio`) in the Vercel
dashboard for automatic deploys on push.

## Post-deploy verification (E2E)

With a wallet holding a Normie:
1. Connect, enter the `tokenId`, **Create session** → copy the painter link.
2. Open the link in a second browser (no wallet), pick a nickname, optionally a
   tip address, paint within the AP budget, **Submit**. Over-budget is blocked
   in the editor; forcing it via the API returns `422`.
3. As the owner, open `/s/<id>/review`, select a draft → wallet prompts
   `setTransformBitmap` → confirm (small, low-AP change first) → the Normie image
   updates on normies.art.
4. **Tip (optional):** for a draft with a tip address, enter an ETH amount →
   **Send tip** → confirm the plain ETH transfer to the artist.
5. **Close session** → the painter link now shows "This session is closed."
