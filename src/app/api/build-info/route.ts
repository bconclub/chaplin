import { chaplinBuildInfo } from "@/lib/version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(chaplinBuildInfo(), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
