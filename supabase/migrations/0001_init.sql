-- Sistem Auto-Order UMKM — skema awal (mengikuti diagrams/erd.puml)
create extension if not exists pgcrypto;

create type public.order_status as enum ('menunggu','dibayar','diproses','dikirim','selesai','batal');

create table public.sellers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  store_name text not null,
  whatsapp_number text not null,
  telegram_chat_id bigint,
  qris_image_url text,
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  name text not null,
  phone text,
  telegram_user_id bigint,
  address text,
  created_at timestamptz not null default now()
);
create unique index customers_seller_tg_uidx on public.customers(seller_id, telegram_user_id) where telegram_user_id is not null;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  name text not null,
  price integer not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  channel text not null check (channel in ('telegram','web')),
  payment_method text not null check (payment_method in ('qris','cod')),
  status public.order_status not null default 'menunggu',
  total integer not null check (total >= 0),
  payment_proof_url text,
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  qty integer not null check (qty > 0),
  unit_price integer not null check (unit_price >= 0)
);

create index on public.products(seller_id);
create index on public.customers(seller_id);
create index on public.orders(seller_id, created_at desc);
create index on public.order_items(order_id);

-- ===== RLS =====
alter table public.sellers enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create or replace function public.current_seller_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.sellers where auth_user_id = auth.uid()
$$;

-- Produk aktif boleh dibaca publik (katalog)
create policy products_public_read on public.products for select to anon, authenticated using (is_active);
-- Penjual kelola produknya sendiri
create policy products_seller_all on public.products for all to authenticated
  using (seller_id = public.current_seller_id()) with check (seller_id = public.current_seller_id());

create policy sellers_self_read on public.sellers for select to authenticated using (auth_user_id = auth.uid());
create policy sellers_self_update on public.sellers for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

create policy customers_seller_read on public.customers for select to authenticated using (seller_id = public.current_seller_id());

create policy orders_seller_read on public.orders for select to authenticated using (seller_id = public.current_seller_id());
create policy orders_seller_update on public.orders for update to authenticated
  using (seller_id = public.current_seller_id()) with check (seller_id = public.current_seller_id());

create policy order_items_seller_read on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.seller_id = public.current_seller_id()));

-- Tidak ada policy INSERT untuk orders/customers/order_items: insert hanya lewat
-- service role (server) memakai fungsi create_order di bawah.

-- ===== Fungsi pembuatan order (atomik, cek stok di server) =====
create or replace function public.create_order(
  p_seller_id uuid, p_channel text, p_payment_method text,
  p_customer_name text, p_customer_phone text, p_customer_address text,
  p_telegram_user_id bigint, p_items jsonb  -- [{"product_id": "...", "qty": 1}]
) returns table(order_id uuid, total integer)
language plpgsql security definer set search_path = public as $$
declare
  v_customer uuid; v_order uuid; v_total integer := 0; it jsonb; p record;
begin
  if jsonb_array_length(p_items) = 0 then raise exception 'EMPTY_ITEMS'; end if;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into p from products
      where id = (it->>'product_id')::uuid and seller_id = p_seller_id and is_active
      for update;
    if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
    if p.stock < (it->>'qty')::int then raise exception 'OUT_OF_STOCK:%', p.name; end if;
    v_total := v_total + p.price * (it->>'qty')::int;
  end loop;

  if p_telegram_user_id is not null then
    insert into customers(seller_id, name, telegram_user_id)
      values (p_seller_id, p_customer_name, p_telegram_user_id)
      on conflict (seller_id, telegram_user_id) where telegram_user_id is not null
      do update set name = excluded.name
      returning id into v_customer;
  else
    insert into customers(seller_id, name, phone, address)
      values (p_seller_id, p_customer_name, p_customer_phone, p_customer_address)
      returning id into v_customer;
  end if;

  insert into orders(seller_id, customer_id, channel, payment_method, status, total)
    values (p_seller_id, v_customer, p_channel, p_payment_method, 'menunggu', v_total)
    returning id into v_order;

  insert into order_items(order_id, product_id, qty, unit_price)
    select v_order, (x->>'product_id')::uuid, (x->>'qty')::int, pr.price
    from jsonb_array_elements(p_items) x join products pr on pr.id = (x->>'product_id')::uuid;

  return query select v_order, v_total;
end $$;

revoke all on function public.create_order(uuid,text,text,text,text,text,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.create_order(uuid,text,text,text,text,text,bigint,jsonb) to service_role;
