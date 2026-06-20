-- 기존 라무라무/발로라 삭제 후 ristonia/ludibrium 으로 교체
delete from public.items where name in ('라무라무', '발로라');

insert into public.items (name, category, price, asset_url) values
  ('리스토니아', 'background', 0, '/background/ristonia.png'),
  ('루디브리엄', 'background', 0, '/background/ludibrium.png');
