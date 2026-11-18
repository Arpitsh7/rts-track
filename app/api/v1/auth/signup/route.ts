import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { Role } from "@/generated/prisma/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, role = Role.CUSTOMER, name, PNo, pincode, Address } = body;

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and password are required" },
        { status: 400 }
      );
    }

    if (!Object.values(Role).includes(role as Role)) {
      return NextResponse.json(
        { message: `Invalid role. Allowed roles: ${Object.values(Role).join(", ")}` },
        { status: 400 }
      );
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role },
      },
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { message: authError?.message || "Failed to create auth account" },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    const createdUser = await prisma.$transaction(async (tx) => {
      let riderId: string | null = null;
      let customerId: string | null = null;

      if (role === Role.RIDER) {
        const rider = await tx.rider.create({
          data: {
            name: name || email.split("@")[0],
            PNo: PNo || "0000000000",
            pincode: pincode || "000000",
            isActive: true,
          },
        });
        riderId = rider.id;
      } else if (role === Role.CUSTOMER) {
        const customer = await tx.customerDetail.create({
          data: {
            name: name || email.split("@")[0],
            PNo: PNo || "0000000000",
            pincode: pincode || "000000",
            Address: Address || "Address not provided",
          },
        });
        customerId = customer.id;
      }

      return tx.user.create({
        data: {
          id: userId,
          email,
          role: role as Role,
          riderId,
          customerId,
        },
        include: {
          rider: true,
          customer: true,
        },
      });
    });

    return NextResponse.json(
      {
        message: "User registered successfully",
        user: createdUser,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Sign up error:", error);
    return NextResponse.json(
      { message: "Unable to complete registration" },
      { status: 500 }
    );
  }
}
