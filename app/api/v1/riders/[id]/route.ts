import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET: Fetch a particular rider
export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    const rider = await prisma.rider.findUnique({
      where: { id },
    });

    if (!rider) {
      return NextResponse.json(
        { message: "Rider not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(rider);
  } catch (error) {
    console.error("Fetch rider error:", error);
    return NextResponse.json(
      { message: "Unable to fetch rider" },
      { status: 500 }
    );
  }
}

// PATCH: Update rider details
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existingRider = await prisma.rider.findUnique({
      where: { id },
    });

    if (!existingRider) {
      return NextResponse.json(
        { message: "Rider not found" },
        { status: 404 }
      );
    }

    const { name, PNo, pincode, isActive } = body;

    const rider = await prisma.rider.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(PNo !== undefined && { PNo }),
        ...(pincode !== undefined && { pincode }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(rider);
  } catch (error) {
    console.error("Update rider error:", error);
    return NextResponse.json(
      { message: "Unable to update rider" },
      { status: 500 }
    );
  }
}

// DELETE: Deactivate rider
export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    const existingRider = await prisma.rider.findUnique({
      where: { id },
    });

    if (!existingRider) {
      return NextResponse.json(
        { message: "Rider not found" },
        { status: 404 }
      );
    }

    const rider = await prisma.rider.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({
      message: "Rider deactivated successfully",
      rider,
    });
  } catch (error) {
    console.error("Deactivate rider error:", error);
    return NextResponse.json(
      { message: "Unable to deactivate rider" },
      { status: 500 }
    );
  }
}
