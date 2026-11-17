import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ShipmentStatus } from "@/generated/prisma/client";

// Statuses that count as "active" in-progress workload
const ACTIVE_STATUSES: ShipmentStatus[] = [
    ShipmentStatus.CREATED,
    ShipmentStatus.PICKED_UP,
    ShipmentStatus.IN_TRANSIT,
    ShipmentStatus.AT_WAREHOUSE,
    ShipmentStatus.OUT_FOR_DELIVERY,
    ShipmentStatus.DELIVERY_FAILED,
];

/**
 * Helper: Find matching riders by customer pincode & sort by active workload
 */
async function getMatchingRidersWithWorkload(pincode: string) {
    const riders = await prisma.rider.findMany({
        where: {
            isActive: true,
            pincode: pincode,
        },
        include: {
            _count: {
                select: {
                    shipments: {
                        where: {
                            status: {
                                in: ACTIVE_STATUSES,
                            },
                        },
                    },
                },
            },
        },
    });

    // Sort riders ascending by fewest active shipments
    return riders
        .map((rider) => ({
            id: rider.id,
            name: rider.name,
            PNo: rider.PNo,
            pincode: rider.pincode,
            activeShipmentsCount: rider._count.shipments,
        }))
        .sort((a, b) => a.activeShipmentsCount - b.activeShipmentsCount);
}

/**
 * GET /assign?shipmentId=<ID>
 * 
 * Step 1-4: Admin preview to find matching riders & compare workloads
 */
export async function GET(request: NextRequest) {
    try {
        const shipmentId = request.nextUrl.searchParams.get("shipmentId");

        if (!shipmentId) {
            return NextResponse.json(
                { message: "shipmentId query parameter is required" },
                { status: 400 }
            );
        }

        const shipment = await prisma.shipmentDetail.findUnique({
            where: { id: shipmentId },
            include: {
                customer: true,
                rider: true,
            },
        });

        if (!shipment) {
            return NextResponse.json(
                { message: "Shipment not found" },
                { status: 404 }
            );
        }

        const customerPincode = shipment.customer.pincode;

        // Find riders matching the customer's pincode and compare workloads
        const eligibleRiders = await getMatchingRidersWithWorkload(customerPincode);

        return NextResponse.json({
            shipment: {
                id: shipment.id,
                shipQR: shipment.shipQR,
                status: shipment.status,
                customerName: shipment.customer.name,
                customerPincode,
                currentRider: shipment.rider
                    ? { id: shipment.rider.id, name: shipment.rider.name }
                    : null,
            },
            matchingRidersCount: eligibleRiders.length,
            recommendedRider: eligibleRiders[0] ?? null,
            eligibleRiders,
        });
    } catch (error) {
        console.error("Assign recommendation error:", error);
        return NextResponse.json(
            { message: "Unable to retrieve rider recommendations" },
            { status: 500 }
        );
    }
}

/**
 * POST /assign
 * 
 * Step 5-6: Admin confirms assignment
 * Body: { shipmentId: string, riderId?: string }
 * If riderId is omitted, automatically assigns the rider with the fewest active shipments.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { shipmentId, riderId } = body;

        if (!shipmentId) {
            return NextResponse.json(
                { message: "shipmentId is required" },
                { status: 400 }
            );
        }

        // 1. Fetch shipment and customer pincode
        const shipment = await prisma.shipmentDetail.findUnique({
            where: { id: shipmentId },
            include: {
                customer: true,
            },
        });

        if (!shipment) {
            return NextResponse.json(
                { message: "Shipment not found" },
                { status: 404 }
            );
        }

        // Disallow assigning finalized shipments
        if (
            shipment.status === ShipmentStatus.DELIVERED ||
            shipment.status === ShipmentStatus.RETURNED ||
            shipment.status === ShipmentStatus.CANCELLED
        ) {
            return NextResponse.json(
                { message: `Cannot assign shipment in '${shipment.status}' status` },
                { status: 400 }
            );
        }

        let targetRiderId = riderId;

        // 2. If no riderId provided, auto-select the best matching rider
        if (!targetRiderId) {
            const eligibleRiders = await getMatchingRidersWithWorkload(
                shipment.customer.pincode
            );

            if (eligibleRiders.length === 0) {
                return NextResponse.json(
                    {
                        message: `No active riders found servicing pincode ${shipment.customer.pincode}`,
                    },
                    { status: 404 }
                );
            }

            // Pick the rider with the fewest active shipments
            targetRiderId = eligibleRiders[0].id;
        }

        // 3. Validate target rider
        const selectedRider = await prisma.rider.findUnique({
            where: { id: targetRiderId },
            include: {
                _count: {
                    select: {
                        shipments: {
                            where: { status: { in: ACTIVE_STATUSES } },
                        },
                    },
                },
            },
        });

        if (!selectedRider || !selectedRider.isActive) {
            return NextResponse.json(
                { message: "Selected rider is invalid or inactive" },
                { status: 400 }
            );
        }

        // 4. Execute assignment atomically in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // Update shipment with assigned rider
            const updatedShipment = await tx.shipmentDetail.update({
                where: { id: shipmentId },
                data: {
                    riderId: selectedRider.id,
                },
                include: {
                    customer: true,
                    rider: true,
                },
            });

            // Append audit log to tracking history
            await tx.trackUpdatesCustomer.create({
                data: {
                    shipmentId: shipment.id,
                    trackUpdate: shipment.status,
                    riderId: selectedRider.id,
                    driverName: selectedRider.name,
                    remarks: `Assigned to rider ${selectedRider.name} (Pincode: ${selectedRider.pincode})`,
                },
            });

            return updatedShipment;
        });

        return NextResponse.json({
            message: "Shipment successfully assigned to rider",
            shipment: result,
            assignedRider: {
                id: selectedRider.id,
                name: selectedRider.name,
                PNo: selectedRider.PNo,
                pincode: selectedRider.pincode,
                workloadBeforeAssignment: selectedRider._count.shipments,
            },
        });
    } catch (error) {
        console.error("Confirm assignment error:", error);
        return NextResponse.json(
            { message: "Unable to confirm shipment assignment" },
            { status: 500 }
        );
    }
}