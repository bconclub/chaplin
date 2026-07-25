# Pipeline Experiment Ground

Chaplin's Experiment Ground is a parallel creative-engineering environment. It
lets specialists tune one stage without editing the configuration used by creators.

## Safety boundary

- Production configuration lives in `pipeline_settings`.
- A test snapshots the active revision into `pipeline_experiments.variants`.
- The selected variant is passed to generation as an authenticated, request-scoped
  override. It is never saved as the active configuration during a test.
- Test jobs carry `pipeline_experiment_id` and
  `pipeline_experiment_variant_id`.
- Experiment outputs are persisted for comparison but are excluded from automatic
  creator-feed publishing.
- Promotion is a separate Super Admin action and requires a successful result from
  the selected winner.
- Promotion uses the existing versioned `savePipelineConfig` path, so the previous
  production revision remains archived.

## Workflow

1. Choose writing, voice, SFX, theme, image, or video.
2. Create an experiment from the current production revision.
3. Select one shared character/reference and one shared test input.
4. Edit Control or Challenger prompt, provider, model, and settings.
5. Inspect the compiled provider request.
6. Run both variants.
7. Compare the media/text output, cost, latency, and errors.
8. Add an engineer score and notes.
9. Select the winner.
10. Promote the tested winner to the next production revision.

## Data model

### `pipeline_experiments`

Stores the stage, common input/reference, baseline revision, variant snapshots,
status, winner, and promotion revision.

### `pipeline_experiment_results`

Stores each provider run's variant, generation job, output asset/text, status,
cost, latency, score, notes, and error.

### `generation_jobs`

The optional experiment and variant columns retain complete lineage in the normal
Admin generation logs and billing system.

## API

- `GET /api/admin/pipeline/experiments` - list experiments and results.
- `POST /api/admin/pipeline/experiments` - fork the active stage into a new test.
- `PATCH /api/admin/pipeline/experiments` - save, score, select, archive, or promote.
- `DELETE /api/admin/pipeline/experiments?id=...` - remove a non-promoted test.
- `POST /api/admin/pipeline/experiments/run` - run an isolated writing variant.
- `POST /api/generate` with `pipelineExperiment` - run isolated media variants.

Every endpoint and request-scoped override requires a confirmed Super Admin
session.
