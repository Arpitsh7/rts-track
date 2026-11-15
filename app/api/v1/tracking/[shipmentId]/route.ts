import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
    params: Promise<{ shipmentId: string }>;
};

export async function GET(
    request: NextRequest,
    { params }: RouteContext
) {
    try {
        const { shipmentId } = await params;

        // Accept either the internal shipment ID or the QR tracking code.
        const shipment = await prisma.shipmentDetail.findFirst({
            where: {
                OR: [
                    { id: shipmentId },
                    { shipQR: shipmentId },
                ],
            },
            select: {
                id: true,
                shipQR: true,
                status: true,
                warehouseName: true,
                warehousePincode: true,
                createdAt: true,
                updatedAt: true,

                customer: {
                    select: {
                        name: true,
                        pincode: true,
                    },
                },

                item: {
                    select: {
                        name: true,
                        itemNumber: true,
                    },
                },

                rider: {
                    select: {
                        name: true,
                        PNo: true,
                    },
                },

                trackingUpdates: {
                    orderBy: {
                        createdAt: "asc",
                    },
                    select: {
                        trackUpdate: true,
                        driverName: true,
                        rider: {
                            select: {
                                name: true,
                            },
                        },
                        remarks: true,
                        createdAt: true,
                    },
                },

                exceptions: {
                    orderBy: {
                        createdAt: "desc",
                    },
                    select: {
                        id: true,
                        type: true,
                        description: true,
                        status: true,
                        resolution: true,
                        resolvedAt: true,
                        createdAt: true,
                    },
                },
            },
        });

        if (!shipment) {
            return NextResponse.json(
                { message: "Shipment not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(
            {
                message: "Tracking details fetched successfully",
                tracking: shipment,
            },
            { status: 200 }
        );

    } catch (error) {
        console.error("Tracking API error:", error);

        return NextResponse.json(
            { message: "Unable to fetch tracking details" },
            { status: 500 }
        );
    }
}
