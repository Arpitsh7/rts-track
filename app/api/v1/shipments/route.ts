import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

// GET: Fetch all shipments
export async function GET() {
  try {
    const shipments = await prisma.shipmentDetail.findMany({
      include: {
        customer: true,
        item: true,
        rider: true,
        trackingUpdates: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(shipments);
  } catch (error) {
    console.error("Fetch shipments error:", error);

    return NextResponse.json(
      { message: "Unable to fetch shipments" },
      { status: 500 }
    );
  }
}

// POST: Create a shipment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      warehouseName,
      warehousePincode,
      customerId,
      itemId,
      riderId,
    } = body;

    if (!warehouseName || !warehousePincode || !customerId || !itemId) {
      return NextResponse.json(
        { message: "Required shipment details are missing" },
        { status: 400 }
      );
    }

    if (riderId) {
      const rider = await prisma.rider.findUnique({
        where: { id: riderId },
      });
      if (!rider || !rider.isActive) {
        return NextResponse.json(
          { message: "Rider not found or inactive" },
          { status: 400 }
        );
      }
    }

    const shipment = await prisma.$transaction(async (tx) => {
      const createdShipment = await tx.shipmentDetail.create({
        data: {
          warehouseName,
          warehousePincode,
          customerId,
          itemId,
          riderId: riderId || null,
          shipQR: randomUUID(),
          status: "CREATED",
        },
        include: {
          customer: true,
          item: true,
          rider: true,
        },
      });

      await tx.trackUpdatesCustomer.create({
        data: {
          shipmentId: createdShipment.id,
          trackUpdate: "CREATED",
          riderId: riderId || null,
          remarks: "Shipment created",
        },
      });

      return createdShipment;
    });

    return NextResponse.json(shipment, { status: 201 });
  } catch (error) {
    console.error("Create shipment error:", error);

    return NextResponse.json(
      { message: "Unable to create shipment" },
      { status: 500 }
    );
  }
}
