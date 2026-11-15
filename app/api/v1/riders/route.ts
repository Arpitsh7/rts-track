import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const riders = await prisma.rider.findMany({
            orderBy: {
                createdAt: "desc",
            },
        });
        return NextResponse.json(riders);
    } catch (error) {
        console.error("Fetch riders error:", error);
        return NextResponse.json(
            { message: "Unable to fetch riders" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, PNo, pincode } = body;
        if (!name || !PNo || !pincode) {
            return NextResponse.json(
                { message: "name, PNo, and pincode are required" },
                { status: 400 }
            );
        }
        const rider = await prisma.rider.create({
            data: {
                name,
                PNo,
                pincode,
            },
        });
        return NextResponse.json(
            { message: "Rider created successfully", rider },
            { status: 201 }
        );
    } catch (error) {
        console.error("Create rider error:", error);
        return NextResponse.json(
            { message: "Unable to create rider" },
            { status: 500 }
        );
    }
}
