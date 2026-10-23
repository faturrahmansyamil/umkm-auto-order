#!/usr/bin/env bash
# Uji migrasi + seed + logika stok/kuota di Postgres lokal. Butuh: psql & akses superuser lokal.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=umkm_test
PSQL="sudo -n -u postgres psql -v ON_ERROR_STOP=1 -q"
sudo -n -u postgres dropdb --if-exists $DB; sudo -n -u postgres createdb $DB
for f in tests/_supabase_stub.sql migrations/0001_init.sql migrations/0002_stock_quota_zones.sql seed.sql tests/stock_quota_test.sql; do
  echo "== $f"; $PSQL -d $DB -f "$f" >/dev/null
done
echo "== concurrency: 20 order paralel x 1 Tumpeng Mini (stok 10, kuota 3/hari)"
$PSQL -d $DB -c "update products set stock=10, daily_quota=null where name='[DEMO] Tumpeng Mini'"
for i in $(seq 1 20); do
  $PSQL -d $DB -c "select create_order('11111111-1111-1111-1111-111111111111','web','cod','Paralel $i',null,null,null,'[{\"product_id\":\"22222222-0000-0000-0000-000000000006\",\"qty\":1}]',current_date+5,null)" >/dev/null 2>&1 &
done; wait
$PSQL -d $DB -tA -c "select 'stok='||stock||' orders='||(select count(*) from orders where customer_id in (select id from customers where name like 'Paralel%')) from products where name='[DEMO] Tumpeng Mini'"
echo "== concurrency: 15 order paralel x 1 Tumpeng (stok 100, kuota 4/hari) tanggal sama"
$PSQL -d $DB -c "update products set stock=100, daily_quota=4 where name='[DEMO] Tumpeng Mini'"
for i in $(seq 1 15); do
  $PSQL -d $DB -c "select create_order('11111111-1111-1111-1111-111111111111','web','cod','Kuota $i',null,null,null,'[{\"product_id\":\"22222222-0000-0000-0000-000000000006\",\"qty\":1}]',current_date+10,null)" >/dev/null 2>&1 &
done; wait
$PSQL -d $DB -tA -c "select 'stok='||stock||' orders='||(select count(*) from orders o where o.delivery_date=current_date+10) from products where name='[DEMO] Tumpeng Mini'"
sudo -n -u postgres dropdb $DB
echo OK
