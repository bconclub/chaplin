create table if not exists public.character_social_metrics (
  id uuid primary key default gen_random_uuid(),
  character_id text not null references public.characters(id) on delete cascade,
  platform text not null,
  external_post_id text not null,
  impressions_count bigint not null default 0 check (impressions_count >= 0),
  views_count bigint not null default 0 check (views_count >= 0),
  likes_count bigint not null default 0 check (likes_count >= 0),
  shares_count bigint not null default 0 check (shares_count >= 0),
  published_at timestamptz,
  last_synced_at timestamptz not null default now(),
  metadata jsonb not null default '{}',
  unique (platform, external_post_id)
);

create index if not exists character_social_metrics_character_idx
  on public.character_social_metrics(character_id, last_synced_at desc);
