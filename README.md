# M-Pesa STK Push Desktop Payment System

Production-ready scaffold for an Electron cashier/admin desktop app backed by an Express API, Supabase Auth/PostgreSQL, and a Daraja-ready STK Push service.

## Apps

- `desktop-app` - Electron + React + Vite + Tailwind + shadcn-style UI components.
- `server` - Express API on port `5000`, Supabase repository layer, and mock-first Daraja STK Push flow.

## Setup

```bash
npm install
```

Create environment files from the examples:

```bash
copy server\.env.example server\.env
copy desktop-app\.env.example desktop-app\.env
```

Run the backend:

```bash
npm run dev:server
```

Run the desktop app:

```bash
npm run dev:desktop
```

The backend health endpoint is `http://localhost:5000/health`. The React dev server runs at `http://127.0.0.1:5173` and Electron loads it automatically in development.

## Core Flow

1. Cashier signs in with Supabase Auth.
2. Electron sends `phone`, `amount`, and `branch_id` to `POST /api/stkpush`.
3. Backend creates a Daraja STK Push request. It returns a mock sandbox response by default.
4. Backend stores the transaction as `pending`.
5. Safaricom callback posts to `POST /api/callback`.
6. Backend updates the transaction status to `success` or `failed`.
7. Electron polls `GET /api/transactions` to show live status changes.

## Supabase

The SQL starter schema is in `server/supabase/schema.sql`. It includes:

- `profiles` for user role and branch assignment.
- `branches` for branch records.
- `transactions` for branch-scoped STK Push transactions.

The API uses the Supabase service role key server-side only. The desktop app uses only the public Supabase anon key for Auth.

