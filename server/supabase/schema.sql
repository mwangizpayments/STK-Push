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
  idempotency_key text,
  status text not null default 'pending_pin' check (
    status in ('created', 'pending_pin', 'processing', 'success', 'failed', 'timeout', 'cancelled')
  ),
  mpesa_receipt text,
  checkout_request_id text unique,
  merchant_request_id text,
  result_code integer,
  failure_reason text,
  raw_request jsonb,
  raw_response jsonb,
  callback_payload jsonb,
  callback_received_at timestamptz,
  callback_processed_at timestamptz,
  callback_attempts integer not null default 0,
  initiated_at timestamptz,
  timeout_at timestamptz,
  reconciled_at timestamptz,
  reconciliation_attempts integer not null default 0,
  reconciliation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.callback_events (
  id uuid primary key default gen_random_uuid(),
  event_hash text unique not null,
  checkout_request_id text,
  merchant_request_id text,
  mpesa_receipt text,
  result_code integer,
  status text not null default 'received' check (
    status in ('received', 'processing', 'processed', 'duplicate', 'orphan', 'error')
  ),
  payload jsonb not null default '{}'::jsonb,
  transaction_id uuid references public.transactions(id) on delete set null,
  received_count integer not null default 1,
  attempts integer not null default 0,
  error_message text,
  received_at timestamptz not null default now(),
  last_received_at timestamptz not null default now(),
  processing_started_at timestamptz,
  processed_at timestamptz,
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
alter table public.transactions add column if not exists idempotency_key text;
alter table public.transactions add column if not exists merchant_request_id text;
alter table public.transactions add column if not exists result_code integer;
alter table public.transactions add column if not exists failure_reason text;
alter table public.transactions add column if not exists raw_request jsonb;
alter table public.transactions add column if not exists raw_response jsonb;
alter table public.transactions add column if not exists callback_payload jsonb;
alter table public.transactions add column if not exists callback_received_at timestamptz;
alter table public.transactions add column if not exists callback_processed_at timestamptz;
alter table public.transactions add column if not exists callback_attempts integer not null default 0;
alter table public.transactions add column if not exists initiated_at timestamptz;
alter table public.transactions add column if not exists timeout_at timestamptz;
alter table public.transactions add column if not exists reconciled_at timestamptz;
alter table public.transactions add column if not exists reconciliation_attempts integer not null default 0;
alter table public.transactions add column if not exists reconciliation_reason text;

do $$
declare
  status_constraint record;
begin
  for status_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%status%'
  loop
    execute format('alter table public.transactions drop constraint if exists %I', status_constraint.conname);
  end loop;

  update public.transactions
    set status = 'pending_pin'
    where status = 'pending';

  alter table public.transactions
    alter column status set default 'pending_pin';

  alter table public.transactions
    add constraint transactions_status_check
    check (status in ('created', 'pending_pin', 'processing', 'success', 'failed', 'timeout', 'cancelled'));
end $$;

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

drop trigger if exists set_callback_events_updated_at on public.callback_events;
create trigger set_callback_events_updated_at
before update on public.callback_events
for each row execute function public.set_updated_at();

create or replace function public.record_stk_callback_event(
  p_event_hash text,
  p_checkout_request_id text,
  p_merchant_request_id text,
  p_mpesa_receipt text,
  p_result_code integer,
  p_payload jsonb
)
returns public.callback_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.callback_events%rowtype;
begin
  insert into public.callback_events (
    event_hash,
    checkout_request_id,
    merchant_request_id,
    mpesa_receipt,
    result_code,
    payload
  )
  values (
    p_event_hash,
    p_checkout_request_id,
    p_merchant_request_id,
    p_mpesa_receipt,
    p_result_code,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (event_hash) do update set
    received_count = public.callback_events.received_count + 1,
    last_received_at = now(),
    updated_at = now()
  returning * into v_event;

  return v_event;
end;
$$;

create or replace function public.apply_stk_callback(
  p_callback_event_id uuid,
  p_checkout_request_id text,
  p_merchant_request_id text,
  p_result_code integer,
  p_status text,
  p_failure_reason text,
  p_mpesa_receipt text,
  p_callback_payload jsonb
)
returns table (
  duplicate boolean,
  reason text,
  transaction_id uuid,
  transaction_row jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction public.transactions%rowtype;
  v_receipt_transaction public.transactions%rowtype;
begin
  if p_status not in ('success', 'failed', 'timeout', 'cancelled') then
    raise exception 'Unsupported final transaction status: %', p_status;
  end if;

  select *
    into v_transaction
    from public.transactions
    where checkout_request_id = p_checkout_request_id
    for update;

  if not found then
    update public.callback_events
      set status = 'orphan',
          attempts = attempts + 1,
          error_message = 'No transaction found for checkout_request_id',
          processed_at = now(),
          updated_at = now()
      where id = p_callback_event_id;

    return query select true, 'transaction_not_found', null::uuid, null::jsonb;
    return;
  end if;

  if p_mpesa_receipt is not null then
    select *
      into v_receipt_transaction
      from public.transactions
      where mpesa_receipt = p_mpesa_receipt
        and id <> v_transaction.id
      for update;

    if found then
      update public.callback_events
        set status = 'duplicate',
            transaction_id = v_receipt_transaction.id,
            attempts = attempts + 1,
            error_message = 'M-Pesa receipt is already attached to another transaction',
            processed_at = now(),
            updated_at = now()
        where id = p_callback_event_id;

      return query
        select true, 'receipt_already_processed', v_receipt_transaction.id, to_jsonb(v_receipt_transaction);
      return;
    end if;
  end if;

  if v_transaction.callback_processed_at is not null then
    update public.callback_events
      set status = 'duplicate',
          transaction_id = v_transaction.id,
          attempts = attempts + 1,
          error_message = 'Callback already processed for checkout_request_id',
          processed_at = now(),
          updated_at = now()
      where id = p_callback_event_id;

    return query
      select true, 'checkout_already_processed', v_transaction.id, to_jsonb(v_transaction);
    return;
  end if;

  update public.transactions
    set status = p_status,
        result_code = p_result_code,
        merchant_request_id = coalesce(merchant_request_id, p_merchant_request_id),
        mpesa_receipt = p_mpesa_receipt,
        failure_reason = p_failure_reason,
        callback_payload = coalesce(p_callback_payload, '{}'::jsonb),
        callback_received_at = now(),
        callback_processed_at = now(),
        callback_attempts = callback_attempts + 1,
        reconciled_at = now(),
        reconciliation_attempts = reconciliation_attempts + 1,
        reconciliation_reason = 'callback',
        updated_at = now()
    where id = v_transaction.id
    returning * into v_transaction;

  update public.callback_events
    set status = 'processed',
        transaction_id = v_transaction.id,
        attempts = attempts + 1,
        error_message = null,
        processed_at = now(),
        updated_at = now()
    where id = p_callback_event_id;

  return query select false, null::text, v_transaction.id, to_jsonb(v_transaction);
end;
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.record_stk_callback_event(text, text, text, text, integer, jsonb) to service_role;
    grant execute on function public.apply_stk_callback(uuid, text, text, integer, text, text, text, jsonb) to service_role;
  end if;
end $$;

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
create unique index if not exists transactions_idempotency_key_unique_idx
  on public.transactions (idempotency_key)
  where idempotency_key is not null;
create index if not exists transactions_branch_created_idx
  on public.transactions (branch_id, created_at desc);
create index if not exists transactions_checkout_request_idx
  on public.transactions (checkout_request_id);
create unique index if not exists transactions_mpesa_receipt_unique_idx
  on public.transactions (mpesa_receipt)
  where mpesa_receipt is not null;
create index if not exists transactions_timeout_idx
  on public.transactions (timeout_at)
  where callback_processed_at is null
    and status in ('created', 'pending_pin', 'processing');
create index if not exists callback_events_checkout_request_idx
  on public.callback_events (checkout_request_id);
create index if not exists callback_events_transaction_idx
  on public.callback_events (transaction_id);
create index if not exists callback_events_reprocess_idx
  on public.callback_events (status, created_at)
  where status in ('received', 'orphan', 'error');
create index if not exists logs_transaction_idx on public.logs (transaction_id);

alter table public.users enable row level security;
alter table public.branches enable row level security;
alter table public.transactions enable row level security;
alter table public.callback_events enable row level security;
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
drop policy if exists "Admin full access to callback events" on public.callback_events;
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

create policy "Admin full access to callback events"
  on public.callback_events for all
  to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy "Admin full access to logs"
  on public.logs for all
  to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');
