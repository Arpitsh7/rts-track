import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma"
import { supabase, createAuthenticatedSupabaseClient } from "@/lib/supabase";
import { Role } from "@/generated/prisma/client";
export type AuthUser = {
    id: string,
    email: string,
    role: Role,
    riderId: string | null,
    customerId: string | null,
    rider?: any,
    customer?: any;
}
export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
    const authHeader = request.headers.get("authorization");
    let token = authHeader?.startsWith("Bearer") ? authHeader.slice(7) : null;
    if (!token) {
        const tokenCookie = request.cookies.get("sb-access-token")?.value;
        if (tokenCookie) token = tokenCookie;
    }
    if (!token) {
        return null;
    }
    const client = createAuthenticatedSupabaseClient(token);
    const { data: { user: authUser }, error } = await client.auth.getUser();
    if (error || !authUser) {
        return null;
    }
    const user = await prisma.user.findUnique({
        where: { id: authUser.id },
        include: {
            rider: true,
            customer: true
        }
    })
    if (!user) {
        return null;
    }
    return {
        id: user.id,
        email: user.email,
        role: user.role,
        riderId: user.riderId,
        customerId: user.customerId,
        rider: user.rider,
        customer: user.customer,
    };
}
export async function requireRole(
    request: NextRequest,
    allowedRoles: Role[]
): Promise<{ user: AuthUser } | { response: NextResponse }> {
    const user = await getAuthUser(request);
    if (!user) {
        return {
            response: NextResponse.json(
                { message: "Authentication required. Provide a valid Bearer token." },
                { status: 401 }
            ),
        };
    }
    if (!allowedRoles.includes(user.role)) {
        return {
            response: NextResponse.json(
                {
                    message: `Access denied. Role '${user.role}' is not authorized for this resource.`,
                    requiredRoles: allowedRoles,
                },
                { status: 403 }
            ),
        };
    }
    return { user };
}