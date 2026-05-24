import { NextRequest, NextResponse } from "next/server";
import { generateGraphData } from "@/lib/graph";

export async function POST(request: NextRequest) {
  const { wordbookId } = await request.json();

  if (!wordbookId) {
    return NextResponse.json(
      { success: false, error: "wordbookId is required" },
      { status: 400 }
    );
  }

  try {
    await generateGraphData(wordbookId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Graph generation failed:", error);
    return NextResponse.json(
      { success: false, error: "Graph generation failed" },
      { status: 500 }
    );
  }
}
