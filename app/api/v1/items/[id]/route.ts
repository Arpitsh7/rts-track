import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET: Fetch single item details by id or itemNumber
export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    const item = await prisma.itemDetail.findFirst({
      where: {
        OR: [{ id }, { itemNumber: id }],
      },
      include: {
        _count: {
          select: { shipments: true },
        },
        shipments: {
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            shipQR: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json(
        { message: "Item not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: item.id,
      name: item.name,
      itemNumber: item.itemNumber,
      qty: item.qty,
      totalShipmentsCount: item._count.shipments,
      recentShipments: item.shipments,
      createdAt: item.createdAt,
    });
  } catch (error) {
    console.error("Fetch item error:", error);
    return NextResponse.json(
      { message: "Unable to fetch item" },
      { status: 500 }
    );
  }
}

// PATCH: Update item details or manage inventory quantity (set qty or relative adjustment)
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, itemNumber, qty, qtyAdjustment } = body;

    const existing = await prisma.itemDetail.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Item not found" },
        { status: 404 }
      );
    }

    // Validate SKU uniqueness if updating itemNumber
    if (itemNumber && itemNumber.trim() !== existing.itemNumber) {
      const duplicate = await prisma.itemDetail.findUnique({
        where: { itemNumber: itemNumber.trim() },
      });
      if (duplicate) {
        return NextResponse.json(
          { message: `Item with itemNumber '${itemNumber}' already exists` },
          { status: 409 }
        );
      }
    }

    // Calculate new quantity
    let updatedQty = existing.qty;

    if (qty !== undefined) {
      if (!Number.isInteger(qty) || qty < 0) {
        return NextResponse.json(
          { message: "Quantity must be a non-negative integer" },
          { status: 400 }
        );
      }
      updatedQty = Number(qty);
    } else if (qtyAdjustment !== undefined) {
      if (!Number.isInteger(qtyAdjustment)) {
        return NextResponse.json(
          { message: "qtyAdjustment must be an integer" },
          { status: 400 }
        );
      }
      updatedQty = existing.qty + Number(qtyAdjustment);
      if (updatedQty < 0) {
        return NextResponse.json(
          {
            message: `Insufficient inventory: current stock is ${existing.qty}, adjustment was ${qtyAdjustment}`,
          },
          { status: 400 }
        );
      }
    }

    const updatedItem = await prisma.itemDetail.update({
      where: { id },
      data: {
        ...(name && typeof name === "string" && { name: name.trim() }),
        ...(itemNumber && typeof itemNumber === "string" && { itemNumber: itemNumber.trim() }),
        qty: updatedQty,
      },
    });

    return NextResponse.json({
      message: "Item updated successfully",
      item: updatedItem,
      previousQty: existing.qty,
      updatedQty: updatedItem.qty,
    });
  } catch (error) {
    console.error("Update item error:", error);
    return NextResponse.json(
      { message: "Unable to update item" },
      { status: 500 }
    );
  }
}

// DELETE: Delete an item (prevent deletion if linked to shipments)
export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    const existing = await prisma.itemDetail.findUnique({
      where: { id },
      include: {
        _count: {
          select: { shipments: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Item not found" },
        { status: 404 }
      );
    }

    if (existing._count.shipments > 0) {
      return NextResponse.json(
        {
          message: `Cannot delete item '${existing.name}' (${existing.itemNumber}) because it is associated with ${existing._count.shipments} shipment(s).`,
        },
        { status: 400 }
      );
    }

    await prisma.itemDetail.delete({
      where: { id },
    });

    return NextResponse.json({
      message: `Item '${existing.name}' (${existing.itemNumber}) deleted successfully`,
    });
  } catch (error) {
    console.error("Delete item error:", error);
    return NextResponse.json(
      { message: "Unable to delete item" },
      { status: 500 }
    );
  }
}
