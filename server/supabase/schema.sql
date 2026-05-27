create extension if not exists "pgcrypto";

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  till_number text,
  shortcode text,
  daraja_passkey text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null default 'cashier' check (role in ('admin', 'cashier')),
  branch_id uuid references public.branches(id),
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  cashier_id uuid references auth.users(id),
  phone text not null,
  amount numeric(12, 2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  mpesa_receipt text,
  checkout_request_id text unique,
  merchant_request_id text,
  result_code integer,
  failure_reason text,
  raw_request jsonb,
  raw_response jsonb,
  callback_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references public.transactions(id) on delete set null,
  message text not null,
  level text not null default 'info' check (level in ('info', 'error')),
  created_at timestamptz not null default now()
);

alter table public.branches add column if not exists till_number text;
alter table public.branches add column if not exists shortcode text;
alter table public.branches add column if not exists daraja_passkey text;
alter table public.branches add column if not exists active boolean not null default true;
alter table public.branches add column if not exists updated_at timestamptz not null default now();

alter table public.users add column if not exists branch_id uuid references public.branches(id);

alter table public.transactions add column if not exists mpesa_receipt text;
alter table public.transactions add column if not exists cashier_id uuid references auth.users(id);
alter table public.transactions add column if not exists merchant_request_id text;
alter table public.transactions add column if not exists result_code integer;
alter table public.transactions add column if not exists failure_reason text;
alter table public.transactions add column if not exists raw_request jsonb;
alter table public.transactions add column if not exists raw_response jsonb;
alter table public.transactions add column if not exists callback_payload jsonb;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'branches'
      and column_name = 'code'
  ) then
    alter table public.branches alter column code drop not null;
    update public.branches
      set till_number = coalesce(till_number, code)
      where till_number is null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'transactions'
      and column_name = 'receipt_number'
  ) then
    update public.transactions
      set mpesa_receipt = coalesce(mpesa_receipt, receipt_number)
      where mpesa_receipt is null;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'profiles'
  ) then
    insert into public.users (id, email, role, branch_id, created_at)
    select
      auth_users.id,
      auth_users.email,
      coalesce(profiles.role, 'cashier'),
      profiles.branch_id,
      coalesce(profiles.created_at, auth_users.created_at)
    from auth.users auth_users
    left join public.profiles profiles on profiles.id = auth_users.id
    on conflict (id) do update set
      email = excluded.email,
      role = excluded.role,
      branch_id = excluded.branch_id;
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_branches_updated_at on public.branches;
create trigger set_branches_updated_at
before update on public.branches
for each row execute function public.set_updated_at();

drop trigger if exists set_transactions_updated_at on public.transactions;
create trigger set_transactions_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'role', 'cashier')
  )
  on conflict (id) do update set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create index if not exists users_role_idx on public.users (role);
create index if not exists users_branch_idx on public.users (branch_id);
create index if not exists transactions_branch_created_idx
  on public.transactions (branch_id, created_at desc);
create index if not exists transactions_checkout_request_idx
  on public.transactions (checkout_request_id);
create index if not exists logs_transaction_idx on public.logs (transaction_id);

alter table public.users enable row level security;
alter table public.branches enable row level security;
alter table public.transactions enable row level security;
alter table public.logs enable row level security;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid()
$$;

create or replace function public.current_branch_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select branch_id from public.users where id = auth.uid()
$$;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_branch_id() to authenticated;

drop policy if exists "Admin full access to users" on public.users;
drop policy if exists "Users can read own user row" on public.users;
drop policy if exists "Admin full access to branches" on public.branches;
drop policy if exists "Cashiers can read own branch" on public.branches;
drop policy if exists "Admin full access to transactions" on public.transactions;
drop policy if exists "Cashiers can insert own branch transactions" on public.transactions;
drop policy if exists "Cashiers can read own branch transactions" on public.transactions;
drop policy if exists "Admin full access to logs" on public.logs;

create policy "Admin full access to users"
  on public.users for all
  to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy "Users can read own user row"
  on public.users for select
  to authenticated
  using (id = auth.uid());

create policy "Admin full access to branches"
  on public.branches for all
  to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy "Cashiers can read own branch"
  on public.branches for select
  to authenticated
  using (id = public.current_branch_id());

create policy "Admin full access to transactions"
  on public.transactions for all
  to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy "Cashiers can insert own branch transactions"
  on public.transactions for insert
  to authenticated
  with check (
    public.current_app_role() = 'cashier'
    and branch_id = public.current_branch_id()
  );

create policy "Cashiers can read own branch transactions"
  on public.transactions for select
  to authenticated
  using (
    public.current_app_role() = 'cashier'
    and branch_id = public.current_branch_id()
  );

create policy "Admin full access to logs"
  on public.logs for all
  to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');
