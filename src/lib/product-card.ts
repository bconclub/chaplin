import { z } from "zod";

const trimmed = (max: number, label: string) => z.string()
  .trim()
  .min(1, `${label} is required.`)
  .max(max, `${label} is too long.`);

export const ProductCardSchema = z.object({
  id: z.string().uuid().optional(),
  owner_id: z.string().min(1).max(120).optional(),
  brand_name: trimmed(160, "Brand name"),
  product_name: trimmed(160, "Product name"),
  reference_images: z.array(z.string().uuid()).min(1, "Add at least one product reference image.").max(8),
  identity_block: trimmed(6000, "Product identity block"),
  must_preserve: z.array(trimmed(500, "Preservation rule")).max(24).default([]),
  negative_prompt: trimmed(3000, "Product negative prompt"),
  claims_allowed: z.array(trimmed(500, "Approved claim")).max(30).default([]),
  handling_notes: trimmed(3000, "Handling notes"),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type ProductCard = z.infer<typeof ProductCardSchema>;

export function productIdentityLock(product: ProductCard) {
  return [
    `PRODUCT IDENTITY BLOCK — VERBATIM: ${product.identity_block}`,
    `PRODUCT REFERENCE ASSETS — binding: ${product.reference_images.join(", ")}.`,
    `MUST PRESERVE: ${product.must_preserve.join("; ") || "exact product identity and proportions"}.`,
    `HANDLING: ${product.handling_notes}`,
  ].join("\n");
}
