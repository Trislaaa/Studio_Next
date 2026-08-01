'use client';

import { Suspense, useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

function StaffLoginContent() {
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
            const result = await signIn('credentials', {
                email: formData.email.toLowerCase().trim(),
                password: formData.password,
                ip: 'unknown',
                redirect: false,
            });

            if (result?.ok) {
                router.push('/staff/dashboard');
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
                    <p className="text-white/80 mt-3">Staff Portal</p>
                </div>

                {/* Login Card */}
                <div className="bg-slate-800/95 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-slate-700">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-white">Reception Login</h2>
                            <p className="text-slate-400 text-sm">Sign in with your staff credentials</p>
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

                        {/* Submit */}
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

                    <div className="mt-6 p-4 bg-teal-500/10 border border-teal-500/30 rounded-lg flex items-start gap-3">
                        <svg className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-xs text-teal-400/80">
                            Contact your administrator if you don&apos;t have login credentials or need a password reset.
                        </p>
                    </div>
                </div>

                {/* Links */}
                <div className="flex items-center justify-between mt-6">
                    <a href="/" className="text-white/80 hover:text-white text-sm transition-colors">
                        ← Back to Website
                    </a>
                    <a href="/admin/login" className="text-teal-400/80 hover:text-teal-400 text-sm transition-colors">
                        Admin Login →
                    </a>
                </div>
            </div>
        </div>
    );
}

export default function StaffLoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center"><div className="text-white">Loading...</div></div>}>
            <StaffLoginContent />
        </Suspense>
    );
}
