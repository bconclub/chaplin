const SILENT_PLATE_LINE = /^AUDIO:.*$/gm;
const SILENT_PLATE_CLAUSE = /\s*Silent visual plate[^.]*\./gi;

function withoutSilentPlateDirection(prompt: string) {
  return prompt.replace(SILENT_PLATE_LINE, "").replace(SILENT_PLATE_CLAUSE, "").trim();
}

export function seedanceSupportsAudioReference(model: string) {
  return /dreamina-seedance-2-0/i.test(model);
}

export function prepareSeedanceAudioPrompt(input: {
  prompt: string;
  generateAudio: boolean;
  referenceAudioUrl?: string;
  dialogueText?: string;
}) {
  const referenceAudioUrl = input.referenceAudioUrl?.trim() ?? "";
  const dialogueText = input.dialogueText?.trim() ?? "";
  if (referenceAudioUrl && dialogueText) {
    const spokenLine = dialogueText.replaceAll('"', "'").trim();
    return `${withoutSilentPlateDirection(input.prompt)}\nPERFORMANCE AUDIO: The supplied reference audio is the actor's locked voice and exact performance timing. Synchronize the visible speaker's mouth, breath, expression, and pauses to this recording without changing its words or inventing another voice. The line is: "${spokenLine}". Generate only restrained location sound around it—room tone, cloth, footsteps, handled objects, machinery, or weather that is physically visible. No additional speech, narration, singing, or musical score. Chaplin adds the character theme and masters the original locked-voice recording separately.`;
  }
  if (!input.generateAudio) return input.prompt;
  return `${withoutSilentPlateDirection(input.prompt)}\nAUDIO: Record the location, not a soundtrack. Generate only diegetic sound that the visible frame would actually make—room tone, footsteps, cloth movement, handled objects, machinery, and weather. No spoken words, no lip-sync, no singing, and no musical score: the actor's locked voice and the character theme are recorded separately and mixed over this plate.`;
}
