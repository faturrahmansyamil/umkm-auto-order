-- Assertion test untuk 0002 (dijalankan oleh tests/run.sh)
do $$
declare s uuid := '11111111-1111-1111-1111-111111111111';
  risol uuid := '22222222-0000-0000-0000-000000000001';
  tumpeng uuid := '22222222-0000-0000-0000-000000000006';
  teh uuid := '22222222-0000-0000-0000-000000000005';
  zone uuid; r record; st int; ok boolean;
  today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  -- seed sudah memotong stok risol 10
  select stock into st from products where id = risol; assert st = 190, 'seed decrement risol: '||st;

  -- decrement + ongkir
  select id into zone from delivery_zones where fee = 15000;
  select * into r from create_order(s,'web','cod','T1',null,null,null,
    jsonb_build_array(jsonb_build_object('product_id',risol,'qty',3), jsonb_build_object('product_id',risol,'qty',2)), today+1, zone);
  assert r.total = 5*5000 + 15000, 'total+fee: '||r.total;
  select stock into st from products where id = risol; assert st = 185, 'decrement: '||st;
  assert (select subtotal from orders where id = r.order_id) = 25000;
  assert (select count(*) from order_items where order_id = r.order_id) = 1, 'duplicates merged';

  -- batal => stok kembali, dan tidak bisa diaktifkan lagi
  update orders set status = 'batal' where id = r.order_id;
  select stock into st from products where id = risol; assert st = 190, 'restore: '||st;
  update orders set status = 'batal' where id = r.order_id;  -- batal -> batal: tidak dobel
  select stock into st from products where id = risol; assert st = 190, 'no double restore: '||st;
  ok := false; begin update orders set status = 'menunggu' where id = r.order_id; exception when others then ok := sqlerrm = 'ORDER_CANCELLED_FINAL'; end;
  assert ok, 'uncancel blocked';

  -- stok habis
  ok := false; begin perform create_order(s,'web','cod','T2',null,null,null,
    jsonb_build_array(jsonb_build_object('product_id',teh,'qty',81)), today, null);
    exception when others then ok := sqlerrm like 'OUT_OF_STOCK:%'; end;
  assert ok, 'out of stock';

  -- lead time: tumpeng butuh H+3
  ok := false; begin perform create_order(s,'web','cod','T3',null,null,null,
    jsonb_build_array(jsonb_build_object('product_id',tumpeng,'qty',1)), today+1, null);
    exception when others then ok := sqlerrm like 'LEAD_TIME:%'; end;
  assert ok, 'lead time';
  -- null date => tanggal paling awal
  select * into r from create_order(s,'web','cod','T4',null,null,null,
    jsonb_build_array(jsonb_build_object('product_id',tumpeng,'qty',1)), null, null);
  assert r.delivery_date = today+3, 'earliest date: '||r.delivery_date;

  -- kuota 3/hari: sudah 1, tambah 2 ok, tambah 1 lagi gagal
  perform create_order(s,'web','cod','T5',null,null,null, jsonb_build_array(jsonb_build_object('product_id',tumpeng,'qty',2)), today+3, null);
  ok := false; begin perform create_order(s,'web','cod','T6',null,null,null,
    jsonb_build_array(jsonb_build_object('product_id',tumpeng,'qty',1)), today+3, null);
    exception when others then ok := sqlerrm like 'QUOTA_FULL:%'; end;
  assert ok, 'quota full';
  assert (select remaining from quota_remaining(s, today+3) where product_id = tumpeng) = 0;
  assert (select remaining from quota_remaining(s, today+4) where product_id = tumpeng) = 3;
  assert (select remaining from quota_remaining(s, today+4) where product_id = teh) is null;

  -- order gagal tidak memotong stok
  select stock into st from products where id = tumpeng; assert st = 7, 'tumpeng stock: '||st;

  -- terlalu jauh, zona salah, qty invalid
  ok := false; begin perform create_order(s,'web','cod','T7',null,null,null, jsonb_build_array(jsonb_build_object('product_id',teh,'qty',1)), today+31, null);
    exception when others then ok := sqlerrm = 'DATE_TOO_FAR'; end; assert ok, 'too far';
  ok := false; begin perform create_order(s,'web','cod','T8',null,null,null, jsonb_build_array(jsonb_build_object('product_id',teh,'qty',1)), today, gen_random_uuid());
    exception when others then ok := sqlerrm = 'ZONE_NOT_FOUND'; end; assert ok, 'zone';
  ok := false; begin perform create_order(s,'web','cod','T9',null,null,null, jsonb_build_array(jsonb_build_object('product_id',teh,'qty',0)), today, null);
    exception when others then ok := sqlerrm = 'INVALID_QTY'; end; assert ok, 'qty';

  -- hak akses: anon/authenticated tidak bisa panggil create_order
  assert not has_function_privilege('anon', 'create_order(uuid,text,text,text,text,text,bigint,jsonb,date,uuid)', 'execute');
  assert not has_function_privilege('authenticated', 'create_order(uuid,text,text,text,text,text,bigint,jsonb,date,uuid)', 'execute');
  assert not has_column_privilege('authenticated', 'orders', 'total', 'update');
  assert has_column_privilege('authenticated', 'orders', 'status', 'update');
  raise notice 'stock_quota_test: ALL PASSED';
end $$;
