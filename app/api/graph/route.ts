import { NextRequest, NextResponse } from "next/server";
import { getGraphData } from "@/lib/graph";
import type { EdgeType } from "@/lib/types";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const wordbookId = searchParams.get("wordbook_id");
  const typesParam = searchParams.get("types");

  if (!wordbookId) {
    return NextResponse.json(
      { success: false, error: "wordbook_id is required" },
      { status: 400 }
    );
  }

  const types = typesParam
    ? (typesParam.split(",") as EdgeType[])
    : undefined;

  const data = await getGraphData(parseInt(wordbookId), types);

  return NextResponse.json({ success: true, data });
}
