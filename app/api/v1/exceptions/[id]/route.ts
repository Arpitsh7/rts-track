import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ExceptionStatus } from "@/generated/prisma/client";

type RouteContext = {
    params: Promise<{ id: string }>;
};

const validStatuses = Object.values(ExceptionStatus);

export async function GET(
    request: NextRequest,
    { params }: RouteContext
) {
    try {
        const { id } = await params;

        const exception = await prisma.shipmentException.findUnique({
            where: { id },
            include: {
                shipment: {
                    select: {
                        id: true,
                        shipQR: true,
                        status: true,
                    },
                },
            },
        });

        if (!exception) {
            return NextResponse.json(
                { message: "Exception not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ exception }, { status: 200 });

    } catch (error) {
        console.error("Fetch exception error:", error);

        return NextResponse.json(
            { message: "Unable to fetch exception" },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: RouteContext
) {
    try {
        const { id } = await params;
        const body = await request.json();

        const { status, resolution } = body;

        if (!status || !validStatuses.includes(status as ExceptionStatus)) {
            return NextResponse.json(
                { message: "Invalid exception status" },
                { status: 400 }
            );
        }

        const existingException = await prisma.shipmentException.findUnique({
            where: { id },
        });

        if (!existingException) {
            return NextResponse.json(
                { message: "Exception not found" },
                { status: 404 }
            );
        }

        if (existingException.status === "RESOLVED") {
            return NextResponse.json(
                { message: "This exception is already resolved" },
                { status: 400 }
            );
        }

        if (status === "RESOLVED" && !resolution) {
            return NextResponse.json(
                { message: "A resolution description is required" },
                { status: 400 }
            );
        }

        const updatedException = await prisma.shipmentException.update({
            where: { id },
            data: {
                status: status as ExceptionStatus,
                ...(resolution !== undefined && { resolution }),
                ...(status === "RESOLVED" && {
                    resolvedAt: new Date(),
                }),
            },
        });

        return NextResponse.json(
            {
                message: "Exception updated successfully",
                exception: updatedException,
            },
            { status: 200 }
        );

    } catch (error) {
        console.error("Update exception error:", error);

        return NextResponse.json(
            { message: "Unable to update exception" },
            { status: 500 }
        );
    }
}
