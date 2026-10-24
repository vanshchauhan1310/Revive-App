-- Local development seed (runs on `supabase db reset`). Never run against production.
-- Creates two confirmed demo users (password: ecoshare-demo) and a few listings.
do $$
declare
  ana uuid := '0b9e1b0c-6a55-4d0e-9a39-1f4f4a1d0001';
  ravi uuid := '0b9e1b0c-6a55-4d0e-9a39-1f4f4a1d0002';
  u record;
begin
  for u in select * from (values (ana, 'ana@ecoshare.test', 'Ana'), (ravi, 'ravi@ecoshare.test', 'Ravi')) as t(id, email, name) loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
            extensions.crypt('ecoshare-demo', extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', jsonb_build_object('name', u.name), now(), now(), '', '', '', '')
    on conflict (id) do nothing;
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now())
    on conflict do nothing;
  end loop;

  update public.profiles set neighborhood = 'Sector 21, Gurugram', lat = 28.51, lng = 77.07 where id in (ana, ravi);

  insert into public.listings (owner_id, title, description, kind, category, exchange_mode, price_credits,
                               quantity_label, allergens, dietary_tags, expires_at, pickup_start, pickup_end, neighborhood, lat, lng)
  values
    (ana, 'Vegetable pulao, 3 portions', 'Made at lunch, kept in the fridge.', 'food', 'cooked_meal', 'free', 0,
     '3 portions', '{dairy}', '{vegetarian}', now() + interval '18 hours', now(), now() + interval '10 hours', 'Sector 21, Gurugram', 28.51, 77.07),
    (ana, 'Sourdough loaf', 'Baked this morning, too much for us.', 'food', 'baked_goods', 'free', 0,
     '1 loaf', '{gluten}', '{vegan}', now() + interval '2 days', now(), now() + interval '1 day', 'Sector 21, Gurugram', 28.512, 77.071);

  insert into public.listings (owner_id, title, description, kind, category, condition, exchange_mode, price_credits, neighborhood, lat, lng)
  values
    (ravi, 'Kids bicycle, 16 inch', 'Outgrown, brakes work well.', 'non_food', 'sports', 'good', 'credits', 40, 'Sector 22, Gurugram', 28.515, 77.068),
    (ravi, 'Set of 12 picture books', 'Ages 3-6, gently used.', 'non_food', 'books', 'like_new', 'free', 0, 'Sector 22, Gurugram', 28.515, 77.068);
end $$;
