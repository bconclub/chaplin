import { z } from "zod";

export const SignatureSfxTimelineItemSchema = z.object({
  assetId: z.string().min(1),
  startMs: z.number().int().min(0).max(4999),
  gainDb: z.number().min(-24).max(12),
});

export type SignatureSfxTimelineItem = z.infer<typeof SignatureSfxTimelineItemSchema>;

export const SignatureSfxTimelineSchema = z.array(SignatureSfxTimelineItemSchema).min(2).max(4);

/** FFmpeg input zero is the five-second silent bed; event inputs begin at one. */
export function buildSignatureSfxFilterGraph(input: SignatureSfxTimelineItem[]) {
  const timeline = SignatureSfxTimelineSchema.parse(input);
  const eventFilters = timeline.map((item, index) =>
    `[${index + 1}:a]asetpts=PTS-STARTPTS,volume=${item.gainDb}dB,adelay=${item.startMs}:all=1[event${index}]`
  );
  const streams = ["[0:a]", ...timeline.map((_, index) => `[event${index}]`)].join("");
  return [
    ...eventFilters,
    `${streams}amix=inputs=${timeline.length + 1}:duration=first:dropout_transition=0:normalize=0,atrim=0:5[aout]`,
  ].join(";");
}
