import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export type AllowedRole = 'ADMIN' | 'MANAGER' | 'RECEPTION' | 'STAFF';

/**
 * Verify the caller has a valid NextAuth session and (optionally) the required role.
 *
 * Usage inside a route handler:
 *   const guard = await requireAuth(request, ['ADMIN', 'MANAGER']);
 *   if (guard.error) return guard.error;   // returns a NextResponse with 401/403
 *   const user = guard.user;               // typed { id, email, name, role }
 *
 * @param _request - NextRequest (unused but kept for future IP-based checks)
 * @param allowedRoles - Optional list of roles that may access this endpoint.
 *                       If omitted, any authenticated user is allowed.
 */
export async function requireAuth(
    _request?: unknown,
    allowedRoles?: AllowedRole[]
): Promise<
    | { user: { id: string; email: string; name: string; role: string }; error?: never }
    | { user?: never; error: NextResponse }
> {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return {
            error: NextResponse.json(
                { error: 'Authentication required. Please log in.' },
                { status: 401 }
            ),
        };
    }

    const user = session.user as { id: string; email: string; name: string; role: string };

    if (allowedRoles && allowedRoles.length > 0) {
        if (!allowedRoles.includes(user.role as AllowedRole)) {
            return {
                error: NextResponse.json(
                    { error: `Access denied. Required role: ${allowedRoles.join(' or ')}` },
                    { status: 403 }
                ),
            };
        }
    }

    return { user };
}

/**
 * Quick helper — returns true when the environment is production.
 */
export function isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
}
