-- Product identities and typed video briefs share Chaplin's existing shot/take/QC path.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references public.users(id) on delete cascade,
  brand_name text not null,
  product_name text not null,
  reference_images uuid[] not null check (cardinality(reference_images) >= 1),
  identity_block text not null,
  must_preserve jsonb not null default '[]'::jsonb,
  negative_prompt text not null,
  claims_allowed jsonb not null default '[]'::jsonb,
  handling_notes text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_owner_idx on public.products(owner_id, updated_at desc);
alter table public.products enable row level security;

create table if not exists public.video_briefs (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references public.users(id) on delete cascade,
  video_type text not null check (video_type in ('character_punch', 'character_reel', 'episode', 'ugc_ad', 'product_hero', 'brand_spot')),
  title text not null,
  character_id text references public.characters(id) on delete set null,
  product_id uuid references public.products(id) on delete restrict,
  duration_seconds integer not null check (duration_seconds between 5 and 60),
  shot_count integer not null check (shot_count between 1 and 12),
  aspect_ratio text not null check (aspect_ratio in ('9:16', '16:9', '1:1')),
  intake jsonb not null default '{}'::jsonb,
  status text not null default 'planned' check (status in ('planned', 'production', 'assembled', 'published', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (video_type = 'product_hero' and product_id is not null and character_id is null)
    or (video_type in ('ugc_ad', 'brand_spot') and product_id is not null and character_id is not null)
    or (video_type in ('character_punch', 'character_reel', 'episode') and character_id is not null)
  )
);

create index if not exists video_briefs_owner_idx on public.video_briefs(owner_id, updated_at desc);
alter table public.video_briefs enable row level security;

-- Reuse episode_shots and episode_shot_takes as the one durable shot primitive.
alter table public.episode_shots alter column episode_id drop not null;
alter table public.episode_shots add column if not exists video_brief_id uuid references public.video_briefs(id) on delete cascade;
alter table public.episode_shots drop constraint if exists episode_shots_episode_id_shot_number_key;
create unique index if not exists episode_shots_episode_number_unique on public.episode_shots(episode_id, shot_number) where episode_id is not null;
create unique index if not exists episode_shots_video_brief_number_unique on public.episode_shots(video_brief_id, shot_number) where video_brief_id is not null;
create index if not exists episode_shots_video_brief_idx on public.episode_shots(video_brief_id, shot_number);

alter table public.media_assets add column if not exists product_id uuid references public.products(id) on delete set null;
alter table public.generation_jobs add column if not exists product_id uuid references public.products(id) on delete set null;
alter table public.generation_jobs add column if not exists video_brief_id uuid references public.video_briefs(id) on delete set null;
alter table public.generation_jobs add column if not exists video_type text;
alter table public.generation_jobs drop constraint if exists generation_jobs_video_type_check;
alter table public.generation_jobs add constraint generation_jobs_video_type_check check (video_type is null or video_type in ('character_punch', 'character_reel', 'episode', 'ugc_ad', 'product_hero', 'brand_spot'));
create index if not exists generation_jobs_product_video_idx on public.generation_jobs(product_id, video_brief_id, created_at desc);
create index if not exists generation_jobs_video_type_idx on public.generation_jobs(video_type, created_at desc);

alter table public.media_pipeline_runs drop constraint if exists media_pipeline_runs_scope_type_check;
alter table public.media_pipeline_runs add constraint media_pipeline_runs_scope_type_check check (scope_type in ('actor', 'shot', 'episode', 'spot', 'brief'));
alter table public.media_pipeline_runs drop constraint if exists media_pipeline_runs_output_type_check;
alter table public.media_pipeline_runs add constraint media_pipeline_runs_output_type_check check (output_type in (
  'identity_still', 'gallery_still', 'poster', 'spark', 'punch', 'shot', 'episode', 'spot', 'trailer', 'delivery_package',
  'character_punch', 'character_reel', 'ugc_ad', 'product_hero', 'brand_spot'
));
