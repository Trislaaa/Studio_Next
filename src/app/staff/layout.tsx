'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';

export default function StaffLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { data: session, status } = useSession();

    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Redirect unauthenticated users away from staff pages
    useEffect(() => {
        if (pathname === '/staff/login') return;
        if (status === 'unauthenticated') {
            router.push('/staff/login');
        }
    }, [status, pathname, router]);

    const handleLogout = useCallback(async () => {
        await signOut({ callbackUrl: '/staff/login' });
    }, []);

    // Don't show layout on login page
    if (pathname === '/staff/login') {
        return <>{children}</>;
    }

    // Show spinner while session is resolving
    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400" />
            </div>
        );
    }

    // Don't render if unauthenticated (redirect in progress)
    if (status === 'unauthenticated') return null;

    const navigation = [
        { name: 'Dashboard', href: '/staff/dashboard', icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
        )},
        { name: 'Calendar', href: '/staff/calendar', icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
        )},
        { name: 'Bookings', href: '/staff/bookings', icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
        )},
        { name: 'Check-In/Out', href: '/staff/check-in-out', icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
        )},
        { name: 'Room Status', href: '/staff/rooms', icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
        )},
        { name: 'Guests', href: '/staff/guests', icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
        )},
    ];

    const currentPage = navigation.find((item) => item.href === pathname)?.name || 'Dashboard';
    const staffName = session?.user?.name ?? 'Staff';
    const staffInitial = staffName[0].toUpperCase();
    const staffRole = session?.user?.role ?? 'RECEPTION';

    return (
        <div className="staff-root min-h-screen bg-slate-50">
            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed left-0 top-0 h-full bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 z-50 transition-all duration-300 flex flex-col ${
                sidebarCollapsed ? 'w-20' : 'w-72'
            } ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
                {/* Branding */}
                <div className="py-5 px-4 border-b border-white/10">
                    {!sidebarCollapsed && (
                        <div className="flex items-center gap-3">
                            <Image
                                src="/logo.png"
                                alt="Studio next Logo"
                                width={40}
                                height={40}
                                className="flex-shrink-0 drop-shadow-sm"
                            />
                            <div>
                                <h1 className="text-[#C9A66B] font-serif text-lg tracking-wide leading-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Studio next</h1>
                                <p className="text-[#C9A66B]/60 text-[10px] tracking-widest uppercase">Reception</p>
                            </div>
                        </div>
                    )}
                    {sidebarCollapsed && (
                        <div className="flex justify-center">
                            <Image
                                src="/logo.png"
                                alt="Studio next Logo"
                                width={36}
                                height={36}
                                className="drop-shadow-sm"
                            />
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 overflow-y-auto">
                    <p className={`text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 ${sidebarCollapsed ? 'hidden' : ''}`}>Menu</p>
                    <ul className="space-y-1.5">
                        {navigation.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <li key={item.name}>
                                    <Link
                                        href={item.href}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                                            isActive
                                                ? 'bg-teal-500/20 text-teal-400'
                                                : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                        }`}
                                        title={sidebarCollapsed ? item.name : undefined}
                                    >
                                        <span className={`flex-shrink-0 ${isActive ? 'text-teal-400' : 'group-hover:text-white'}`}>
                                            {item.icon}
                                        </span>
                                        {!sidebarCollapsed && (
                                            <span className="font-medium text-sm">{item.name}</span>
                                        )}
                                        {isActive && !sidebarCollapsed && (
                                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                                        )}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {/* User Info & Logout */}
                <div className="p-4 border-t border-white/10 space-y-2 mt-auto">
                    {!sidebarCollapsed && (
                        <div className="px-3 py-2 mb-2">
                            <p className="text-white text-sm font-medium truncate">{staffName}</p>
                            <p className="text-slate-400 text-xs truncate">{session?.user?.email}</p>
                        </div>
                    )}
                    <button
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <svg className={`w-5 h-5 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                        </svg>
                        {!sidebarCollapsed && <span className="text-sm">Collapse</span>}
                    </button>
                    <button
                        onClick={handleLogout}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
                        title={sidebarCollapsed ? 'Logout' : undefined}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        {!sidebarCollapsed && <span className="font-medium text-sm">Logout</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'}`}>
                {/* Top Bar */}
                <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30">
                    <div className="h-full px-4 lg:px-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setMobileMenuOpen(true)}
                                className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </button>
                            <div>
                                <h2 className="page-title">{currentPage}</h2>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Link
                                href="/staff/check-in-out"
                                className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14" />
                                </svg>
                                <span>Check-In</span>
                            </Link>
                            <div className="hidden md:block text-sm text-slate-500 px-3 py-1.5 bg-slate-50 rounded-lg">
                                {new Date().toLocaleDateString('en-IN', {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'short',
                                })}
                            </div>
                            {/* Profile */}
                            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white text-sm font-semibold">
                                    {staffInitial}
                                </div>
                                <div className="hidden sm:block">
                                    <p className="text-sm font-semibold text-slate-900 leading-tight">{staffName}</p>
                                    <p className="text-xs text-slate-400 capitalize">{staffRole.toLowerCase()}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="p-4 lg:p-6">{children}</div>
            </main>
        </div>
    );
}
