-- Character Card v2 is additive. Existing prose production_bible rows remain
-- valid and use the legacy prompt path until a validated card is present.
alter table public.characters
  add column if not exists card_v2 jsonb;

alter table public.characters
  add column if not exists card_version integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'characters_card_v2_version_check'
  ) then
    alter table public.characters
      add constraint characters_card_v2_version_check
      check (card_version is null or card_version = 2) not valid;
  end if;
end $$;

create index if not exists characters_card_v2_idx
  on public.characters ((card_version))
  where card_v2 is not null;
