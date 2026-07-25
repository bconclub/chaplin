import { AGNI_MAYA_CARD_V2 } from "@/lib/character-card-fixtures";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

async function main() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("characters")
    .select("id,name")
    .ilike("name", "Agni Maya")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Find Agni Maya: ${error.message}`);
  if (!data) throw new Error("Agni Maya was not found. Seed or create her before running this migration.");

  const update = await supabase
    .from("characters")
    .update({ card_v2: AGNI_MAYA_CARD_V2, card_version: 2, updated_at: new Date().toISOString() })
    .eq("id", data.id);
  if (update.error) throw new Error(`Write Character Card v2: ${update.error.message}`);
  console.log(`Migrated ${data.name} (${data.id}) to Character Card v2.`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
