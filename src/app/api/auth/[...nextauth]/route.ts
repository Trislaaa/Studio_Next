import NextAuth, { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

// ---------------------------------------------------------------------------
// Rate-limit store (in-memory, per process — good enough for a single host)
// ---------------------------------------------------------------------------
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = loginAttempts.get(ip);

    if (!entry || now - entry.firstAttempt > WINDOW_MS) {
        loginAttempts.set(ip, { count: 1, firstAttempt: now });
        return false;
    }

    if (entry.count >= MAX_ATTEMPTS) return true;

    entry.count++;
    return false;
}

function resetRateLimit(ip: string) {
    loginAttempts.delete(ip);
}

// ---------------------------------------------------------------------------
// NextAuth configuration
// ---------------------------------------------------------------------------
export const authOptions: AuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
                ip: { label: '', type: 'text' }, // passed from login page
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;

                // Rate limiting
                const ip = credentials.ip || 'unknown';
                if (isRateLimited(ip)) {
                    throw new Error('TOO_MANY_ATTEMPTS');
                }

                // Fetch admin user
                const user = await prisma.adminUser.findUnique({
                    where: { email: credentials.email.toLowerCase().trim() },
                    select: {
                        id: true,
                        email: true,
                        passwordHash: true,
                        fullName: true,
                        role: true,
                        isActive: true,
                    },
                });

                if (!user || !user.isActive) return null;

                const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
                if (!isValid) return null;

                // Reset rate limit on successful login
                resetRateLimit(ip);

                return {
                    id: user.id,
                    email: user.email,
                    name: user.fullName,
                    role: user.role,
                };
            },
        }),
    ],

    session: {
        strategy: 'jwt',
        maxAge: 60 * 60, // 1 hour
    },

    jwt: {
        maxAge: 60 * 60, // 1 hour
    },

    pages: {
        signIn: '/admin/login',
        error: '/admin/login',
    },

    callbacks: {
        async jwt({ token, user }) {
            // On first sign-in, attach role to the JWT
            if (user) {
                token.role = (user as { role?: string }).role ?? '';
                token.id = user.id ?? '';
            }
            return token;
        },
        async session({ session, token }) {
            // Expose minimal data to the client via session
            if (session.user) {
                session.user.role = (token.role ?? '') as string;
                session.user.id = (token.id ?? '') as string;
            }
            return session;
        },
    },

    // Cookies are HttpOnly + Secure by default in production
    useSecureCookies: process.env.NODE_ENV === 'production',
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
