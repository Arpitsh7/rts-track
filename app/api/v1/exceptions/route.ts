import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ExceptionType } from "@/generated/prisma/client";

const validTypes = Object.values(ExceptionType);

export async function GET(request: NextRequest) {
    try {
        const shipmentId = request.nextUrl.searchParams.get("shipmentId");

        const exceptions = await prisma.shipmentException.findMany({
            where: shipmentId ? { shipmentId } : undefined,
            include: {
                shipment: {
                    select: {
                        id: true,
                        shipQR: true,
                        status: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return NextResponse.json(
            { exceptions },
            { status: 200 }
        );
    } catch (error) {
        console.error("Fetch exceptions error:", error);

        return NextResponse.json(
            { message: "Unable to fetch exceptions" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const { shipmentId, type, description } = body;

        if (!shipmentId || !type || !description) {
            return NextResponse.json(
                { message: "shipmentId, type and description are required" },
                { status: 400 }
            );
        }

        if (!validTypes.includes(type as ExceptionType)) {
            return NextResponse.json(
                { message: "Invalid exception type" },
                { status: 400 }
            );
        }

        const shipment = await prisma.shipmentDetail.findUnique({
            where: { id: shipmentId },
        });

        if (!shipment) {
            return NextResponse.json(
                { message: "Shipment not found" },
                { status: 404 }
            );
        }

        const exception = await prisma.shipmentException.create({
            data: {
                shipmentId,
                type: type as ExceptionType,
                description,
            },
        });

        return NextResponse.json(
            {
                message: "Exception reported successfully",
                exception,
            },
            { status: 201 }
        );

    } catch (error) {
        console.error("Create exception error:", error);

        return NextResponse.json(
            { message: "Unable to create exception" },
            { status: 500 }
        );
    }
}
