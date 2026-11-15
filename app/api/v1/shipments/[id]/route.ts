import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ShipmentStatus } from "@/generated/prisma/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const validStatuses = Object.values(ShipmentStatus);

// GET: Fetch one shipment
export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    const shipment = await prisma.shipmentDetail.findUnique({
      where: { id },
      include: {
        customer: true,
        item: true,
        rider: true,
        trackingUpdates: {
          orderBy: { createdAt: "asc" },
          include: { rider: true },
        },
        exceptions: true,
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { message: "Shipment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(shipment);
  } catch (error) {
    console.error("Fetch shipment error:", error);

    return NextResponse.json(
      { message: "Unable to fetch shipment" },
      { status: 500 }
    );
  }
}

// PATCH: Update shipment status or rider assignment
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { status, riderId } = body;

    if (status === undefined && riderId === undefined) {
      return NextResponse.json(
        { message: "Provide status or riderId to update" },
        { status: 400 }
      );
    }

    if (
      status !== undefined &&
      !validStatuses.includes(status)
    ) {
      return NextResponse.json(
        { message: "Invalid shipment status" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.shipmentDetail.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new Error("SHIPMENT_NOT_FOUND");
      }

      if (
        status !== undefined &&
        status !== existing.status
      ) {
        const allowedTransitions: Record<string, string[]> = {
          CREATED: ["PICKED_UP", "CANCELLED"],
          PICKED_UP: ["IN_TRANSIT", "CANCELLED"],
          IN_TRANSIT: ["AT_WAREHOUSE", "OUT_FOR_DELIVERY"],
          AT_WAREHOUSE: ["IN_TRANSIT", "OUT_FOR_DELIVERY"],
          OUT_FOR_DELIVERY: ["DELIVERED", "DELIVERY_FAILED"],
          DELIVERY_FAILED: ["OUT_FOR_DELIVERY", "RETURNED"],
          DELIVERED: [],
          RETURNED: [],
          CANCELLED: [],
        };

        if (!allowedTransitions[existing.status]?.includes(status)) {
          throw new Error("INVALID_STATUS_TRANSITION");
        }
      }

      if (riderId !== undefined && riderId !== null) {
        const rider = await tx.rider.findUnique({
          where: { id: riderId },
        });

        if (!rider || !rider.isActive) {
          throw new Error("INVALID_RIDER");
        }
      }

      const updated = await tx.shipmentDetail.update({
        where: { id },
        data: {
          ...(status !== undefined && { status }),
          ...(riderId !== undefined && { riderId }),
        },
        include: {
          customer: true,
          item: true,
          rider: true,
        },
      });

      if (status !== undefined && status !== existing.status) {
        await tx.trackUpdatesCustomer.create({
          data: {
            shipmentId: id,
            trackUpdate: status,
            riderId: riderId ?? existing.riderId,
            remarks: "Shipment status updated",
          },
        });
      }

      return updated;
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "SHIPMENT_NOT_FOUND") {
        return NextResponse.json(
          { message: "Shipment not found" },
          { status: 404 }
        );
      }

      if (error.message === "INVALID_STATUS_TRANSITION") {
        return NextResponse.json(
          { message: "This status transition is not allowed" },
          { status: 409 }
        );
      }

      if (error.message === "INVALID_RIDER") {
        return NextResponse.json(
          { message: "Rider not found or inactive" },
          { status: 400 }
        );
      }
    }

    console.error("Update shipment error:", error);

    return NextResponse.json(
      { message: "Unable to update shipment" },
      { status: 500 }
    );
  }
}

// DELETE: Cancel shipment (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    const shipment = await prisma.$transaction(async (tx) => {
      const existing = await tx.shipmentDetail.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new Error("SHIPMENT_NOT_FOUND");
      }

      if (
        ["DELIVERED", "RETURNED", "CANCELLED"].includes(existing.status)
      ) {
        throw new Error("SHIPMENT_CANNOT_BE_CANCELLED");
      }

      const updated = await tx.shipmentDetail.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      await tx.trackUpdatesCustomer.create({
        data: {
          shipmentId: id,
          trackUpdate: "CANCELLED",
          riderId: existing.riderId,
          remarks: "Shipment cancelled",
        },
      });

      return updated;
    });

    return NextResponse.json({
      message: "Shipment cancelled successfully",
      shipment,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "SHIPMENT_NOT_FOUND") {
        return NextResponse.json(
          { message: "Shipment not found" },
          { status: 404 }
        );
      }

      if (error.message === "SHIPMENT_CANNOT_BE_CANCELLED") {
        return NextResponse.json(
          { message: "Shipment cannot be cancelled in its current state" },
          { status: 409 }
        );
      }
    }

    console.error("Cancel shipment error:", error);

    return NextResponse.json(
      { message: "Unable to cancel shipment" },
      { status: 500 }
    );
  }
}
