import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseWordbook, detectFormat } from "@/lib/parser";
import { generateGraphData } from "@/lib/graph";

export async function GET() {
  const wordbooks = await prisma.wordbook.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { words: true } } },
  });

  return NextResponse.json({
    success: true,
    data: wordbooks.map((wb: { id: number; name: string; source: string; createdAt: Date; _count: { words: number } }) => ({
      id: wb.id,
      name: wb.name,
      source: wb.source,
      createdAt: wb.createdAt,
      wordCount: wb._count.words,
    })),
  });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File;
  const name = formData.get("name") as string;

  if (!file) {
    return NextResponse.json(
      { success: false, error: "No file provided" },
      { status: 400 }
    );
  }

  const content = await file.text();
  const format = detectFormat(file.name, content);
  const parsed = parseWordbook(format, content);

  const wordbook = await prisma.wordbook.create({
    data: {
      name: name || parsed.name || file.name,
      source: format,
      words: {
        create: parsed.words.map((w) => ({
          word: w.word,
          definition: w.definition,
          phonetic: w.phonetic,
        })),
      },
    },
    include: { _count: { select: { words: true } } },
  });

  // Trigger graph generation in background
  generateGraphData(wordbook.id).catch(console.error);

  return NextResponse.json({
    success: true,
    data: { ...wordbook, wordCount: wordbook._count.words },
  });
}
