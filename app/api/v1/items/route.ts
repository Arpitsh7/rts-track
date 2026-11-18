import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const items = await prisma.itemDetail.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error("Fetch items error:", error);
    return NextResponse.json(
      { message: "Unable to fetch items" },
      { status: 500 }
    );
  }
}
