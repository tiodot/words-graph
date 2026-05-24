import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";

export async function GET() {
  const settings = await prisma.userSettings.findFirst();

  return NextResponse.json({
    success: true,
    data: settings
      ? {
          provider: settings.provider,
          model: settings.model,
          hasApiKey: !!settings.apiKey,
        }
      : null,
  });
}

export async function PUT(request: NextRequest) {
  const { provider, apiKey, model } = await request.json();

  const encryptedKey = apiKey ? encrypt(apiKey) : null;

  const existing = await prisma.userSettings.findFirst();

  if (existing) {
    await prisma.userSettings.update({
      where: { id: existing.id },
      data: { provider, apiKey: encryptedKey, model },
    });
  } else {
    await prisma.userSettings.create({
      data: { provider, apiKey: encryptedKey, model },
    });
  }

  return NextResponse.json({ success: true });
}
