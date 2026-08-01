'use client';

import { Suspense, useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

function AdminLoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionExpired, setSessionExpired] = useState(false);

    useEffect(() => {
        if (searchParams.get('expired') === 'true' || searchParams.get('error') === 'SessionRequired') {
            setSessionExpired(true);
        }
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSessionExpired(false);
        setIsLoading(true);

        try {
            // Get client IP hint (best-effort, only used for rate-limiting hint)
            let ip = 'unknown';
            try {
                const ipRes = await fetch('https://api.ipify.org?format=json');
                const ipData = await ipRes.json();
                ip = ipData.ip ?? 'unknown';
            } catch {
                // Ignore — rate limiting still works on server via headers
            }

            const result = await signIn('credentials', {
                email: formData.email.toLowerCase().trim(),
                password: formData.password,
                ip,
                redirect: false,
            });

            if (result?.ok) {
                router.push('/admin');
                router.refresh();
            } else if (result?.error === 'TOO_MANY_ATTEMPTS') {
                setError('Too many failed attempts. Please wait 15 minutes and try again.');
                setIsLoading(false);
            } else {
                setError('Invalid email or password. Please try again.');
                setIsLoading(false);
            }
        } catch {
            setError('An unexpected error occurred. Please try again.');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Session Expired Alert */}
                {sessionExpired && (
                    <div className="mb-6 bg-amber-500/20 border border-amber-500/50 rounded-xl p-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500/30 rounded-full flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-amber-300 font-medium">Session Expired</p>
                            <p className="text-amber-300/70 text-sm">Your session expired due to inactivity. Please log in again.</p>
                        </div>
                    </div>
                )}

                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <img src="/logo.png" alt="Studio next Logo" className="w-20 h-20 object-contain" />
                    </div>
                    <h1 className="text-4xl font-serif text-teal-400 tracking-[0.15em] mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                        Studio next
                    </h1>
                    <p className="text-teal-400/70 text-sm tracking-[0.3em] uppercase">HOTEL</p>
                    <p className="text-white/80 mt-3">Admin Dashboard</p>
                </div>

                {/* Login Card */}
                <div className="bg-slate-800/95 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-slate-700">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-white">Admin Login</h2>
                            <p className="text-slate-400 text-sm">Sign in with your admin credentials</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Email */}
                        <div>
                            <label className="block text-sm font-semibold text-white mb-2">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                                placeholder="Enter your email"
                                required
                                autoComplete="email"
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-semibold text-white mb-2">
                                Password
                            </label>
                            <input
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                                placeholder="Enter your password"
                                required
                                autoComplete="current-password"
                            />
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm flex items-center gap-2">
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-500 text-white font-semibold rounded-lg hover:from-teal-500 hover:to-teal-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    <span>Signing in...</span>
                                </>
                            ) : (
                                <span>Sign In →</span>
                            )}
                        </button>
                    </form>

                    {/* Contact info — no credentials shown here */}
                    <p className="mt-6 text-xs text-slate-500 text-center">
                        Forgot your password? Contact the hotel manager.
                    </p>
                </div>

                {/* Links */}
                <div className="flex items-center justify-between mt-6">
                    <a href="/" className="text-white/80 hover:text-white text-sm transition-colors">
                        ← Back to Website
                    </a>
                    <a href="/staff/login" className="text-teal-400/80 hover:text-teal-400 text-sm transition-colors">
                        Staff Login →
                    </a>
                </div>
            </div>
        </div>
    );
}

export default function AdminLoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center"><div className="text-white">Loading...</div></div>}>
            <AdminLoginContent />
        </Suspense>
    );
}
