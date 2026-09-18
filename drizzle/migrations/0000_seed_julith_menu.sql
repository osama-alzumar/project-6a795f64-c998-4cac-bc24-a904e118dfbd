insert into public.categories (name, sort_order) values ('القهوة الساخنة', 1), ('القهوة الباردة', 2), ('الحلى', 3), ('القهوة بالقالون', 4);

insert into public.products (category_id, name, price, image_url, sort_order, is_available)
select c.id, v.name, v.price, v.img, v.so, true from public.categories c
join (values
 ('القهوة الساخنة','فلات وايت', 14, '/__l5e/assets-v1/2584312f-4208-45dd-850c-c3359b62d8a5/flat-white.jpg', 1),
 ('القهوة الساخنة','لاتيه', 15, '/__l5e/assets-v1/be15dcec-cb8f-47ba-9c90-5fdcbefd9be1/latte.jpg', 2),
 ('القهوة الساخنة','كورتادو', 13, '/__l5e/assets-v1/e15e1cb0-0087-4bca-a4e2-5c0a9fda5655/cortado.jpg', 3),
 ('القهوة الساخنة','إسبريسو', 10, '/__l5e/assets-v1/9e72b852-24d0-423b-a02d-c344eee3b6d6/espresso.jpg', 4),
 ('القهوة الساخنة','أمريكانو حار', 12, '/__l5e/assets-v1/fbb08d5e-41c0-4a51-9a99-263e6d538ae5/americano-hot.jpg', 5),
 ('القهوة الساخنة','قهوة عربية', 10, '/__l5e/assets-v1/8845d5be-7c0d-4bbd-9d93-6017814ad47d/arabic-coffee.jpg', 6),
 ('القهوة الباردة','أمريكانو مثلج', 14, '/__l5e/assets-v1/b4852c77-716c-4520-8645-cf55fcf1219e/americano-iced.jpg', 1),
 ('القهوة الباردة','آيس لاتيه', 16, '/__l5e/assets-v1/ee41cc7f-8d51-4ee9-93b6-918fb53ae350/iced-latte.jpg', 2),
 ('الحلى','كرانجي كاسة', 15, '/__l5e/assets-v1/6d8015a8-740e-4b19-ad6c-83c0b52747d7/cranchy-cup.jpg', 1),
 ('الحلى','كرانجي علبة', 35, '/__l5e/assets-v1/22b6b793-453b-4a28-bc2e-6b9db1874e02/cranchy-box.jpg', 2),
 ('القهوة بالقالون','قهوة قالون', 120, '/__l5e/assets-v1/32031c3a-09f3-4bf2-a400-597fd715c88c/gallon-coffee.jpg', 1)
) as v(cat, name, price, img, so) on v.cat = c.name;