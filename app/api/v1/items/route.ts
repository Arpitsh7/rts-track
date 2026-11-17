import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Fetch all items / inventory with optional search and stock filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search")?.trim();
    const inStock = searchParams.get("inStock");

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { itemNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    if (inStock === "true") {
      where.qty = { gt: 0 };
    } else if (inStock === "false") {
      where.qty = { equals: 0 };
    }

    const items = await prisma.itemDetail.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        _count: {
          select: { shipments: true },
        },
      },
    });

    return NextResponse.json({
      count: items.length,
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        itemNumber: item.itemNumber,
        qty: item.qty,
        shipmentsCount: item._count.shipments,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    console.error("Fetch items error:", error);
    return NextResponse.json(
      { message: "Unable to fetch items" },
      { status: 500 }
    );
  }
}

// POST: Register a new item / SKU
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, itemNumber, qty } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { message: "Item name is required" },
        { status: 400 }
      );
    }

    if (!itemNumber || typeof itemNumber !== "string" || !itemNumber.trim()) {
      return NextResponse.json(
        { message: "Item number (SKU) is required" },
        { status: 400 }
      );
    }

    const parsedQty = Number.isInteger(qty) ? Number(qty) : 0;
    if (parsedQty < 0) {
      return NextResponse.json(
        { message: "Quantity cannot be negative" },
        { status: 400 }
      );
    }

    // Check for duplicate SKU
    const existing = await prisma.itemDetail.findUnique({
      where: { itemNumber: itemNumber.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { message: `Item with itemNumber '${itemNumber}' already exists` },
        { status: 409 }
      );
    }

    const newItem = await prisma.itemDetail.create({
      data: {
        name: name.trim(),
        itemNumber: itemNumber.trim(),
        qty: parsedQty,
      },
    });

    return NextResponse.json(
      {
        message: "Item registered successfully",
        item: newItem,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create item error:", error);
    return NextResponse.json(
      { message: "Unable to create item" },
      { status: 500 }
    );
  }
}
