import { NextRequest, NextResponse } from "next/server";
import { VideoBriefInputSchema } from "@/lib/video-brief";
import { requireRequestIdentity } from "@/lib/server/auth";
import { createVideoBrief } from "@/lib/server/video-briefs";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const identity = await requireRequestIdentity(request);
    const brief = VideoBriefInputSchema.parse(await request.json());
    return NextResponse.json({ brief: await createVideoBrief(brief, identity.id) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create video brief.";
    return NextResponse.json({ error: message }, { status: /required|cannot|must|invalid|Sign in/i.test(message) ? 400 : 500 });
  }
}
