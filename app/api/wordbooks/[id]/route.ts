import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id);

  const wordbook = await prisma.wordbook.findUnique({
    where: { id },
    include: { _count: { select: { words: true } } },
  });

  if (!wordbook) {
    return NextResponse.json(
      { success: false, error: "Wordbook not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { ...wordbook, wordCount: wordbook._count.words },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id);

  await prisma.wordbook.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
