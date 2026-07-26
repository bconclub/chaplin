/**
 * Delivery loudness and ducking constants for the finished cut.
 *
 * Kept out of the route so the values are testable and stated once: two
 * pipelines assemble audio, and they must agree on how loud a delivered Chaplin
 * cut is and how far the theme drops under a speaking actor.
 */

/** -12dB, expressed as a linear gain multiplier. */
export const DUCK_UNDER_SPEECH = 10 ** (-12 / 20);

/** Integrated loudness target. -14 LUFS is the streaming reference. */
export const DELIVERY_LUFS = -14;

/** True-peak ceiling, leaving headroom for lossy encoders. */
export const DELIVERY_TRUE_PEAK_DB = -1.5;

/** Loudness range, wide enough to keep dynamics without pumping. */
export const DELIVERY_LOUDNESS_RANGE = 11;

export const DELIVERY_LOUDNESS_FILTER =
  `loudnorm=I=${DELIVERY_LUFS}:TP=${DELIVERY_TRUE_PEAK_DB}:LRA=${DELIVERY_LOUDNESS_RANGE}`;
