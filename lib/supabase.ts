import { createClient } from "@supabase/supabase-js";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables in .env");
}
// Base Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export function createAuthenticatedSupabaseClient(bearerToken: string) {
    return createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: {
                Authorization: `Bearer ${bearerToken}`,
            },
        },
    });
}