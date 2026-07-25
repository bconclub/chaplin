update public.users
set
  image_url = case
    when id = 'u-admin' then '/avatars/chaplin-admin-ocelot.webp'
    when id = 'u-meera' then '/avatars/meera-caracal.webp'
    when id = 'u-arjun' then '/avatars/arjun-owl.webp'
    when id = 'u-priya' then '/avatars/priya-fox.webp'
    when id = 'u-kabir' then '/avatars/kabir-raven.webp'
    else (array[
      '/avatars/chaplin-admin-ocelot.webp',
      '/avatars/meera-caracal.webp',
      '/avatars/arjun-owl.webp',
      '/avatars/priya-fox.webp',
      '/avatars/kabir-raven.webp'
    ])[(1 + mod(abs(hashtextextended(id, 0)::numeric), 5))::integer]
  end,
  updated_at = now();
