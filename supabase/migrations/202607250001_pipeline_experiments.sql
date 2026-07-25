-- Isolated A/B testing for creative pipeline stages. Experiment outputs are
-- never production defaults and never enter the public feed until explicitly
-- selected and promoted by Super Admin.

create table if not exists public.pipeline_experiments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 120),
  stage text not null check (stage in ('writing', 'voice', 'sfx', 'theme', 'image', 'video')),
  status text not null default 'draft' check (status in ('draft', 'testing', 'review', 'promoted', 'archived')),
  input_prompt text not null default '',
  character_id text references public.characters(id) on delete set null,
  reference_image_url text,
  baseline_revision integer not null check (baseline_revision > 0),
  variants jsonb not null default '[]'::jsonb,
  winner_variant_id text,
  promoted_revision integer,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  promoted_at timestamptz
);

create table if not exists public.pipeline_experiment_results (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.pipeline_experiments(id) on delete cascade,
  variant_id text not null,
  generation_job_id uuid unique references public.generation_jobs(id) on delete set null,
  output_asset_id uuid references public.media_assets(id) on delete set null,
  output_text text,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  provider text not null,
  model text not null,
  cost_usd numeric(16,8),
  latency_ms integer,
  error_message text,
  score smallint check (score between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.generation_jobs
  add column if not exists pipeline_experiment_id uuid references public.pipeline_experiments(id) on delete set null;

alter table public.generation_jobs
  add column if not exists pipeline_experiment_variant_id text;

create index if not exists pipeline_experiments_stage_idx
  on public.pipeline_experiments(stage, updated_at desc);

create index if not exists pipeline_experiment_results_experiment_idx
  on public.pipeline_experiment_results(experiment_id, created_at desc);

create index if not exists generation_jobs_pipeline_experiment_idx
  on public.generation_jobs(pipeline_experiment_id, created_at desc);

alter table public.pipeline_experiments enable row level security;
alter table public.pipeline_experiment_results enable row level security;

revoke all on public.pipeline_experiments from anon, authenticated;
revoke all on public.pipeline_experiment_results from anon, authenticated;
