"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { VIDEO_TYPES, VideoType, type VideoBriefInputData } from "@/lib/video-brief";
import type { ProductCard } from "@/lib/product-card";
import { useChaplinStore } from "@/lib/store";

const field = "min-w-0 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-1 focus:ring-accent/40";

function lines(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

type ProductDraft = {
  brand_name: string;
  product_name: string;
  identity_block: string;
  must_preserve: string;
  negative_prompt: string;
  claims_allowed: string;
  handling_notes: string;
};

const emptyProduct: ProductDraft = {
  brand_name: "",
  product_name: "",
  identity_block: "",
  must_preserve: "",
  negative_prompt: "no warped text, no invented labels, no extra variants, no changed proportions",
  claims_allowed: "",
  handling_notes: "",
};

const typeDescription: Record<VideoType, string> = {
  [VideoType.CharacterPunch]: "One actor, one five-second beat.",
  [VideoType.CharacterReel]: "A three-shot vertical character reel.",
  [VideoType.Episode]: "A 12-shot ensemble episode.",
  [VideoType.UgcAd]: "A creator-led ad with a product and clear CTA.",
  [VideoType.ProductHero]: "A product-only macro reveal. No humans.",
  [VideoType.BrandSpot]: "A six-shot narrative where product and actor share the frame.",
};

export default function NewVideoPage() {
  const router = useRouter();
  const characters = useChaplinStore((state) => state.characters);
  const [videoType, setVideoType] = useState<VideoType>(VideoType.UgcAd);
  const [title, setTitle] = useState("");
  const [characterIds, setCharacterIds] = useState<string[]>([]);
  const [productId, setProductId] = useState("");
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [duration, setDuration] = useState("15");
  const [ratio, setRatio] = useState<"9:16" | "16:9" | "1:1">("9:16");
  const [persona, setPersona] = useState<"casual" | "expert" | "excited">("casual");
  const [hook, setHook] = useState("");
  const [cta, setCta] = useState("");
  const [platform, setPlatform] = useState<"reels" | "shorts" | "tiktok">("reels");
  const [narrativeBeat, setNarrativeBeat] = useState<"problem" | "ritual" | "reveal">("ritual");
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [productDraft, setProductDraft] = useState<ProductDraft>(emptyProduct);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const definition = VIDEO_TYPES[videoType];
  const required = definition.required_inputs;
  const wantsEnsemble = required.includes("character_ids");
  const wantsActor = wantsEnsemble || required.includes("character_id");
  const characterId = characterIds[0] ?? "";
  const wantsProduct = required.includes("product_id");
  const selectedProduct = useMemo(() => products.find((product) => product.id === productId), [products, productId]);
  const durationRange = typeof definition.duration === "number" ? undefined : definition.duration;

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/products", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ products?: ProductCard[] }> : { products: [] })
      .then((data) => { if (!cancelled) setProducts(data.products ?? []); })
      .catch(() => { if (!cancelled) setProducts([]); });
    return () => { cancelled = true; };
  }, []);

  function validate() {
    if (!title.trim()) return "Give this video a title.";
    for (const input of required) {
      const value = input === "character_id" ? characterId : input === "character_ids" ? characterIds : input === "product_id" ? productId || creatingProduct : input === "persona_style" ? persona : input === "hook_text" ? hook : input === "cta_text" ? cta : input === "platform" ? platform : narrativeBeat;
      if (!value || (typeof value === "string" && !value.trim())) return `${input.replaceAll("_", " ")} is required for ${definition.label}.`;
    }
    if (videoType === VideoType.ProductHero && characterIds.length) return "Product Hero is product-only; remove the actor.";
    if (creatingProduct) {
      if (!productDraft.brand_name.trim()) return "Brand name is required for the product identity.";
      if (!productDraft.product_name.trim()) return "Product name is required for the product identity.";
      if (!productDraft.identity_block.trim()) return "Add the product identity block exactly as printed.";
      if (!productDraft.negative_prompt.trim()) return "Add a product negative prompt.";
      if (!productDraft.handling_notes.trim()) return "Add handling notes for the product.";
      if (referenceFiles.length < 1) return "Add at least one product reference image (two or three angles are recommended).";
    }
    return "";
  }

  function selectVideoType(next: VideoType) {
    const nextDefinition = VIDEO_TYPES[next];
    setVideoType(next);
    setRatio(nextDefinition.aspect_ratio_default);
    setDuration(String(typeof nextDefinition.duration === "number" ? nextDefinition.duration : nextDefinition.duration[0]));
    // Switching to a product-only grammar must never retain an actor or product from another brief.
    if (!nextDefinition.required_inputs.includes("character_id") && !nextDefinition.required_inputs.includes("character_ids")) setCharacterIds([]);
    if (!nextDefinition.required_inputs.includes("product_id")) setProductId("");
  }

  async function createProduct() {
    if (!referenceFiles.length) throw new Error("Add at least one product reference image.");
    const assetIds: string[] = [];
    for (const file of referenceFiles) {
      const form = new FormData();
      form.set("file", file);
      const upload = await fetch("/api/products/reference", { method: "POST", body: form });
      const uploadData = await upload.json() as { assetId?: string; error?: string };
      if (!upload.ok || !uploadData.assetId) throw new Error(uploadData.error || `Could not upload ${file.name}.`);
      assetIds.push(uploadData.assetId);
    }
    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...productDraft,
        reference_images: assetIds,
        must_preserve: lines(productDraft.must_preserve),
        claims_allowed: lines(productDraft.claims_allowed),
      }),
    });
    const data = await response.json() as { product?: ProductCard; error?: string };
    if (!response.ok || !data.product) throw new Error(data.error || "Could not save product identity.");
    setProducts((current) => [data.product!, ...current]);
    setProductId(data.product.id ?? "");
    setCreatingProduct(false);
    return data.product.id;
  }

  async function submit() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const validationError = validate();
      if (validationError) throw new Error(validationError);
      const effectiveProductId = wantsProduct && !productId ? await createProduct() : productId || undefined;
      if (wantsProduct && !effectiveProductId) throw new Error("Select or create a product identity.");
      const body: VideoBriefInputData = {
        video_type: videoType,
        title: title.trim(),
        character_id: !wantsEnsemble && wantsActor ? characterId || undefined : undefined,
        character_ids: wantsEnsemble ? characterIds : undefined,
        product_id: wantsProduct ? effectiveProductId : undefined,
        duration_seconds: Number(duration),
        aspect_ratio: ratio,
        persona_style: videoType === VideoType.UgcAd ? persona : undefined,
        hook_text: videoType === VideoType.UgcAd ? hook.trim() : undefined,
        cta_text: videoType === VideoType.UgcAd ? cta.trim() : undefined,
        platform: videoType === VideoType.UgcAd ? platform : undefined,
        narrative_beat: videoType === VideoType.BrandSpot ? narrativeBeat : undefined,
      };
      const response = await fetch("/api/videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as { brief?: { id: string }; error?: string };
      if (!response.ok || !data.brief) throw new Error(data.error || "Could not create typed video.");
      setMessage("Typed brief and shot plan created. Opening the production board…");
      router.push(`/admin?videoBrief=${data.brief.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not create typed video.");
    } finally {
      setBusy(false);
    }
  }

  function updateProduct<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setProductDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
      <Link href="/create" className="text-xs font-semibold text-grey hover:text-accent">← Create</Link>
      <header className="mt-5 max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-accent">Typed video intake</p>
        <h1 className="marquee-title mt-2 text-4xl sm:text-5xl">START WITH THE VIDEO, NOT A SCENE</h1>
        <p className="mt-3 text-sm leading-6 text-grey">Choose the production grammar first. Chaplin will create the same durable shot, take, review, and assembly path for every format.</p>
      </header>

      <section className="poster-card mt-8 rounded-2xl p-5 sm:p-7">
        <div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Step 1</p><h2 className="reel-title mt-1 text-2xl">Pick a video type</h2></div><span className="text-xs text-grey">{definition.prompt_grammar_id}</span></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.values(VIDEO_TYPES).map((type) => {
            const active = videoType === type.type;
            const durationLabel = Array.isArray(type.duration) ? `${type.duration[0]}–${type.duration[1]}s` : `${type.duration}s`;
            const shotLabel = Array.isArray(type.shot_count) ? `${type.shot_count[0]}–${type.shot_count[1]} shots` : `${type.shot_count} shots`;
            return <button key={type.type} type="button" onClick={() => selectVideoType(type.type)} aria-pressed={active} className={`rounded-xl border p-4 text-left transition ${active ? "border-accent bg-accent/10 shadow-[0_0_0_1px_rgba(255,70,115,0.3)]" : "border-line hover:border-accent/50"}`}><div className="flex items-center justify-between gap-2"><strong className="text-sm">{type.label}</strong><span className="text-[10px] uppercase tracking-wide text-grey">{durationLabel}</span></div><span className="mt-2 block text-xs leading-5 text-grey">{typeDescription[type.type]}</span><span className="mt-2 block text-[10px] uppercase tracking-wide text-accent">{shotLabel} · {type.aspect_ratio_default}</span></button>;
          })}
        </div>
      </section>

      <section className="poster-card mt-5 rounded-2xl p-5 sm:p-7">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Step 2</p><h2 className="reel-title mt-1 text-2xl">Required intake</h2><p className="mt-1 text-xs text-grey">Fields change with the selected grammar. Asterisked inputs are checked before anything is written.</p></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-xs font-semibold">Video title <em className="text-accent not-italic">*</em></span><input className={field} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Morning ritual — 15s" /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold">Aspect ratio</span><select className={field} value={ratio} onChange={(event) => setRatio(event.target.value as typeof ratio)}><option value="9:16">9:16 vertical</option><option value="16:9">16:9 landscape</option><option value="1:1">1:1 square</option></select></label>
          {durationRange && <label className="block"><span className="mb-1.5 block text-xs font-semibold">Duration <em className="text-accent not-italic">*</em></span><select className={field} value={duration} onChange={(event) => setDuration(event.target.value)}>{Array.from({ length: durationRange[1] - durationRange[0] + 1 }, (_, index) => durationRange[0] + index).filter((seconds) => seconds % 5 === 0).map((seconds) => <option key={seconds} value={seconds}>{seconds} seconds</option>)}</select></label>}
          {wantsActor && !wantsEnsemble && <label className="block"><span className="mb-1.5 block text-xs font-semibold">Actor <em className="text-accent not-italic">*</em></span><select className={field} value={characterId} onChange={(event) => setCharacterIds(event.target.value ? [event.target.value] : [])}><option value="">Select an actor</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name} · {character.archetype}</option>)}</select></label>}
          {wantsEnsemble && <fieldset className="block sm:col-span-2"><legend className="mb-2 block text-xs font-semibold">Ensemble actors <em className="text-accent not-italic">*</em> <span className="font-normal text-grey">({characterIds.length}/6 selected)</span></legend><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{characters.map((character) => { const selected = characterIds.includes(character.id); return <button key={character.id} type="button" aria-pressed={selected} onClick={() => setCharacterIds((current) => selected ? current.filter((id) => id !== character.id) : current.length < 6 ? [...current, character.id] : current)} className={`rounded-lg border px-3 py-2 text-left text-xs transition ${selected ? "border-accent bg-accent/10" : "border-line hover:border-accent/50"}`}><span className="block font-semibold">{character.name}</span><span className="mt-0.5 block text-[10px] text-grey">{character.archetype}</span></button>; })}</div></fieldset>}
        </div>

        {wantsProduct && <div className="mt-5 rounded-xl border border-line p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold">Product identity <em className="text-accent not-italic">*</em></p><p className="mt-1 max-w-xl text-xs leading-5 text-grey">Reference images, exact label text, preservation locks, approved claims, and handling notes travel with every shot prompt.</p></div><button type="button" className="text-xs font-semibold text-accent hover:text-accent-light" onClick={() => { setCreatingProduct((value) => !value); setProductId(""); }}>{creatingProduct ? "Use an existing product" : "+ Create product inline"}</button></div>
          {!creatingProduct ? <label className="mt-4 block"><span className="sr-only">Select product</span><select className={field} value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Select a saved product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.brand_name} · {product.product_name}</option>)}</select>{!products.length && <span className="mt-2 block text-xs text-grey">No saved product identities yet. Create one inline to continue.</span>}</label> : <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-xs font-semibold">Brand name <em className="text-accent not-italic">*</em></span><input className={field} value={productDraft.brand_name} onChange={(event) => updateProduct("brand_name", event.target.value)} placeholder="Brand" /></label><label className="block"><span className="mb-1.5 block text-xs font-semibold">Product name <em className="text-accent not-italic">*</em></span><input className={field} value={productDraft.product_name} onChange={(event) => updateProduct("product_name", event.target.value)} placeholder="Product" /></label><label className="block sm:col-span-2"><span className="mb-1.5 block text-xs font-semibold">Reference images <em className="text-accent not-italic">*</em></span><input className={field} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => setReferenceFiles(Array.from(event.target.files ?? []).slice(0, 8))} /><span className="mt-1 block text-[10px] text-grey">Upload 2–3 angles when possible (up to 8).</span></label><label className="block sm:col-span-2"><span className="mb-1.5 block text-xs font-semibold">Identity block <em className="text-accent not-italic">*</em></span><textarea className={field} rows={3} value={productDraft.identity_block} onChange={(event) => updateProduct("identity_block", event.target.value)} placeholder="Verbatim shape, materials, colors, exact label/logo text, cap or closure details" /></label><label className="block"><span className="mb-1.5 block text-xs font-semibold">Must preserve</span><textarea className={field} rows={3} value={productDraft.must_preserve} onChange={(event) => updateProduct("must_preserve", event.target.value)} placeholder="One lock per line — label text exactly…" /></label><label className="block"><span className="mb-1.5 block text-xs font-semibold">Negative prompt <em className="text-accent not-italic">*</em></span><textarea className={field} rows={3} value={productDraft.negative_prompt} onChange={(event) => updateProduct("negative_prompt", event.target.value)} placeholder="No warped text…" /></label><label className="block"><span className="mb-1.5 block text-xs font-semibold">Approved claims</span><textarea className={field} rows={3} value={productDraft.claims_allowed} onChange={(event) => updateProduct("claims_allowed", event.target.value)} placeholder="Only claims the brand approved, one per line" /></label><label className="block"><span className="mb-1.5 block text-xs font-semibold">Handling notes <em className="text-accent not-italic">*</em></span><textarea className={field} rows={3} value={productDraft.handling_notes} onChange={(event) => updateProduct("handling_notes", event.target.value)} placeholder="How it is held, opened, or used" /></label></div>}
          {selectedProduct && <p className="mt-3 rounded-lg bg-accent/5 p-3 text-xs text-grey">Using <strong className="text-ink">{selectedProduct.brand_name} · {selectedProduct.product_name}</strong>. Its approved claims and preservation locks will be injected into every shot.</p>}
        </div>}

        {videoType === VideoType.UgcAd && <div className="mt-5 rounded-xl border border-line p-4 sm:p-5"><p className="text-sm font-semibold">UGC direction</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-xs font-semibold">Persona style <em className="text-accent not-italic">*</em></span><select className={field} value={persona} onChange={(event) => setPersona(event.target.value as typeof persona)}><option value="casual">Casual</option><option value="expert">Expert</option><option value="excited">Excited</option></select></label><label className="block"><span className="mb-1.5 block text-xs font-semibold">Platform <em className="text-accent not-italic">*</em></span><select className={field} value={platform} onChange={(event) => setPlatform(event.target.value as typeof platform)}><option value="reels">Instagram Reels</option><option value="shorts">YouTube Shorts</option><option value="tiktok">TikTok</option></select></label><label className="block"><span className="mb-1.5 block text-xs font-semibold">Hook text <em className="text-accent not-italic">*</em></span><textarea className={field} rows={2} value={hook} onChange={(event) => setHook(event.target.value)} placeholder="Product must be visible in the first second" /></label><label className="block"><span className="mb-1.5 block text-xs font-semibold">CTA text <em className="text-accent not-italic">*</em></span><textarea className={field} rows={2} value={cta} onChange={(event) => setCta(event.target.value)} placeholder="Approved call to action" /></label></div></div>}
        {videoType === VideoType.BrandSpot && <label className="mt-5 block rounded-xl border border-line p-4 sm:p-5"><span className="mb-1.5 block text-sm font-semibold">Narrative beat <em className="text-accent not-italic">*</em></span><span className="mb-3 block text-xs text-grey">The product enters by shot two; choose the emotional spine for the six-shot spot.</span><select className={field} value={narrativeBeat} onChange={(event) => setNarrativeBeat(event.target.value as typeof narrativeBeat)}><option value="problem">Problem — establish the tension</option><option value="ritual">Ritual — show the repeated behavior</option><option value="reveal">Reveal — make the product the turn</option></select></label>}
      </section>

      {error && <p role="alert" className="mt-5 rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
      {message && <p role="status" className="mt-5 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm">{message}</p>}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4"><p className="max-w-xl text-xs leading-5 text-grey">Creating a typed video writes the brief and shot list, then opens the existing approval-gated production board.</p><button type="button" onClick={submit} disabled={busy} className="accent-btn rounded-full px-6 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Creating pipeline…" : "Create typed video pipeline"}</button></div>
    </main>
  );
}
