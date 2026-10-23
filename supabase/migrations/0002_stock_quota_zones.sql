-- 0002: stok berkurang atomik, kembalikan stok saat batal, pre-order + kuota harian,
--       zona antar, alias produk, channel 'chat' (Tempel chat jadi order).

-- ===== Produk: kuota harian, pre-order, alias =====
alter table public.products
  add column daily_quota integer check (daily_quota is null or daily_quota > 0),   -- null = tanpa kuota
  add column preorder_lead_days integer not null default 0 check (preorder_lead_days between 0 and 30),
  add column aliases text[] not null default '{}';

-- ===== Zona antar =====
create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  fee integer not null check (fee between 0 and 10000000),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.delivery_zones(seller_id);
alter table public.delivery_zones enable row level security;
create policy zones_public_read on public.delivery_zones for select to anon, authenticated using (is_active);
create policy zones_seller_all on public.delivery_zones for all to authenticated
  using (seller_id = public.current_seller_id()) with check (seller_id = public.current_seller_id());

-- ===== Order: tanggal kirim, zona, ongkir, subtotal, channel chat =====
alter table public.orders drop constraint orders_channel_check;
alter table public.orders add constraint orders_channel_check check (channel in ('telegram','web','chat'));
alter table public.orders
  add column delivery_date date not null default ((now() at time zone 'Asia/Jakarta')::date),
  add column delivery_zone_id uuid references public.delivery_zones(id),
  add column delivery_fee integer not null default 0 check (delivery_fee >= 0),
  add column subtotal integer not null default 0 check (subtotal >= 0);
update public.orders set subtotal = total where subtotal = 0;
create index on public.orders(seller_id, delivery_date);
create index on public.order_items(product_id);

-- ===== create_order baru =====
drop function public.create_order(uuid,text,text,text,text,text,bigint,jsonb);

create or replace function public.create_order(
  p_seller_id uuid, p_channel text, p_payment_method text,
  p_customer_name text, p_customer_phone text, p_customer_address text,
  p_telegram_user_id bigint, p_items jsonb,          -- [{"product_id": "...", "qty": 1}]
  p_delivery_date date, p_delivery_zone_id uuid      -- p_delivery_date null = tanggal paling awal yang diizinkan
) returns table(order_id uuid, total integer, delivery_date date)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_date date; v_customer uuid; v_order uuid; v_subtotal integer := 0; v_fee integer := 0;
  v_max_lead integer := 0; v_used integer; it record; p record;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_ITEMS';
  end if;

  -- Kunci baris produk dalam urutan id yang tetap (hindari deadlock) & gabungkan item duplikat.
  -- Kunci FOR UPDATE membuat order bersamaan untuk produk yang sama berjalan berurutan,
  -- sehingga cek stok + kuota di bawah tidak bisa oversell.
  create temp table if not exists _ci(product_id uuid primary key, qty int not null, price int, name text) on commit drop;
  delete from _ci;
  insert into _ci(product_id, qty)
    select (x->>'product_id')::uuid, sum((x->>'qty')::int)
    from jsonb_array_elements(p_items) x group by 1;
  if exists (select 1 from _ci where qty <= 0 or qty > 999) then raise exception 'INVALID_QTY'; end if;

  for it in select c.product_id, c.qty from _ci c order by c.product_id loop
    select * into p from products
      where id = it.product_id and seller_id = p_seller_id and is_active
      for update;
    if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
    if p.stock < it.qty then raise exception 'OUT_OF_STOCK:%', p.name; end if;
    v_max_lead := greatest(v_max_lead, p.preorder_lead_days);
    update _ci set price = p.price, name = p.name where product_id = it.product_id;
    v_subtotal := v_subtotal + p.price * it.qty;
  end loop;

  v_date := coalesce(p_delivery_date, v_today + v_max_lead);
  if v_date < v_today + v_max_lead then raise exception 'LEAD_TIME:%', v_today + v_max_lead; end if;
  if v_date > v_today + 30 then raise exception 'DATE_TOO_FAR'; end if;

  -- Kuota produksi harian (dihitung setelah kunci didapat => melihat order yang sudah commit)
  for it in select c.product_id, c.qty, c.name from _ci c order by c.product_id loop
    select pr.daily_quota into p from products pr where pr.id = it.product_id;
    if p.daily_quota is not null then
      select coalesce(sum(oi.qty), 0) into v_used
        from order_items oi join orders o on o.id = oi.order_id
        where oi.product_id = it.product_id and o.delivery_date = v_date and o.status <> 'batal';
      if v_used + it.qty > p.daily_quota then raise exception 'QUOTA_FULL:%', it.name; end if;
    end if;
  end loop;

  if p_delivery_zone_id is not null then
    select fee into v_fee from delivery_zones
      where id = p_delivery_zone_id and seller_id = p_seller_id and is_active;
    if not found then raise exception 'ZONE_NOT_FOUND'; end if;
  end if;

  -- Kurangi stok (guard stock >= qty sebagai pengaman kedua)
  update products pr set stock = pr.stock - c.qty from _ci c where pr.id = c.product_id and pr.stock >= c.qty;

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

  insert into orders(seller_id, customer_id, channel, payment_method, status, subtotal, delivery_fee, total,
                     delivery_date, delivery_zone_id)
    values (p_seller_id, v_customer, p_channel, p_payment_method, 'menunggu', v_subtotal, v_fee, v_subtotal + v_fee,
            v_date, p_delivery_zone_id)
    returning id into v_order;

  insert into order_items(order_id, product_id, qty, unit_price)
    select v_order, c.product_id, c.qty, c.price from _ci c;

  return query select v_order, v_subtotal + v_fee, v_date;
end $$;

revoke all on function public.create_order(uuid,text,text,text,text,text,bigint,jsonb,date,uuid) from public, anon, authenticated;
grant execute on function public.create_order(uuid,text,text,text,text,text,bigint,jsonb,date,uuid) to service_role;

-- ===== Kembalikan stok saat order dibatalkan; order batal tidak bisa diaktifkan lagi =====
create or replace function public.orders_status_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.status = 'batal' and new.status <> 'batal' then
    raise exception 'ORDER_CANCELLED_FINAL';
  end if;
  if new.status = 'batal' and old.status <> 'batal' then
    update products pr set stock = pr.stock + oi.qty
      from (select product_id, sum(qty) qty from order_items where order_id = new.id group by product_id) oi
      where pr.id = oi.product_id;
  end if;
  return new;
end $$;
create trigger orders_status_guard before update of status on public.orders
  for each row execute function public.orders_status_guard();

-- Penjual hanya boleh mengubah status lewat dashboard: cegah ubah total/ongkir/item lewat API.
revoke update on public.orders from authenticated;
grant update (status, payment_proof_url) on public.orders to authenticated;

-- ===== Sisa kuota per produk untuk tanggal tertentu (dipakai form order) =====
create or replace function public.quota_remaining(p_seller_id uuid, p_date date)
returns table(product_id uuid, remaining integer)
language sql stable security definer set search_path = public, pg_temp as $$
  select pr.id,
         case when pr.daily_quota is null then null
              else greatest(pr.daily_quota - coalesce((
                select sum(oi.qty) from order_items oi join orders o on o.id = oi.order_id
                where oi.product_id = pr.id and o.delivery_date = p_date and o.status <> 'batal'), 0), 0)::int
         end
  from products pr where pr.seller_id = p_seller_id and pr.is_active
$$;
revoke all on function public.quota_remaining(uuid,date) from public, anon, authenticated;
grant execute on function public.quota_remaining(uuid,date) to service_role;
