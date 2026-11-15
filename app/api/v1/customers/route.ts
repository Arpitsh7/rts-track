import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const customers = await prisma.customerDetail.findMany();
        return NextResponse.json(customers);
    } catch (error) {
        console.error("Fetch customers error:", error);

        return NextResponse.json(
            { message: "Unable to fetch customers" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, PNo, pincode, Address } = body;
        if (!name || !PNo || !pincode || !Address) {
            return NextResponse.json(
                { message: "All customer fields are required" },
                { status: 400 }
            );
        }
        const customer = await prisma.customerDetail.create({
            data: {
                name,
                PNo,
                pincode,
                Address,
            },
        });
        return NextResponse.json(customer, { status: 201 });
    } catch (error) {
        console.error("Create customer error:", error);
        return NextResponse.json(
            { message: "Unable to create customer" },
            { status: 500 }
        );
    }
}
