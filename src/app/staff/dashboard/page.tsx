'use client';

import { useEffect, useState } from 'react';

interface DashboardStats {
    todayCheckIns: number;
    todayCheckOuts: number;
    pendingBookings: number;
    occupiedRooms: number;
    availableRooms: number;
    totalRooms: number;
    overdueCheckouts: number;
}

interface TodayBooking {
    id: string;
    guestName: string;
    room: string;
    checkIn?: string;
    checkOut?: string;
    status: string;
    type: 'check-in' | 'check-out';
}

const Icons = {
    checkIn: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
        </svg>
    ),
    checkOut: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
    ),
    rooms: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
    ),
    pending: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    refresh: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
    ),
    warning: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
    ),
};

export default function StaffDashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [todayBookings, setTodayBookings] = useState<TodayBooking[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/dashboard/stats');
            const data = await response.json();

            if (data.stats) {
                const s = data.stats;
                setStats({
                    todayCheckIns: s.todayCheckIns || 0,
                    todayCheckOuts: s.todayCheckOuts || 0,
                    pendingBookings: s.pendingBookings || 0,
                    occupiedRooms: s.roomStatus?.occupied || 0,
                    availableRooms: s.roomStatus?.available || 0,
                    totalRooms: s.totalRooms || 0,
                    overdueCheckouts: s.overdueCheckouts || 0,
                });
                const checkIns = (s.todayCheckInsList || []).map((b: any) => ({ ...b, type: 'check-in' as const }));
                const checkOuts = (s.todayCheckOutsList || []).map((b: any) => ({ ...b, type: 'check-out' as const }));
                setTodayBookings([...checkIns, ...checkOuts]);
            }
        } catch (err) {
            console.error('Failed to fetch dashboard data:', err);
        } finally {
            setLoading(false);
        }
    };

    const getTimeOfDay = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    const occupancyPct = stats && stats.totalRooms > 0
        ? Math.round((stats.occupiedRooms / stats.totalRooms) * 100)
        : 0;

    return (
        <div className="space-y-5">
            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-5 text-white flex items-center justify-between shadow-md">
                <div>
                    <p className="text-slate-400 text-sm font-medium mb-0.5">
                        {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                    <h1 className="text-xl font-bold">{getTimeOfDay()} 👋</h1>
                    <p className="text-slate-400 text-sm mt-1">Here's today's overview at Studio next</p>
                </div>
                <button
                    onClick={fetchDashboardData}
                    disabled={loading}
                    className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors disabled:opacity-50"
                    title="Refresh"
                >
                    <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            {/* Critical Alert - Overdue Checkouts */}
            {(stats?.overdueCheckouts ?? 0) > 0 && (
                <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200/60 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                            {Icons.warning}
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-red-900">URGENT: Overdue Check-outs</p>
                            <p className="text-sm text-red-700">
                                {stats?.overdueCheckouts} guest{(stats?.overdueCheckouts || 0) > 1 ? 's have' : ' has'} missed their scheduled check-out time. Please follow up immediately.
                            </p>
                        </div>
                        <a href="/staff/check-in-out" className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-rose-500 rounded-lg hover:from-red-600 hover:to-rose-600 transition-all shadow-sm">
                            Process Checkouts
                        </a>
                    </div>
                </div>
            )}

            {/* Actions Required */}
            {stats && (stats.pendingBookings > 0 || stats.todayCheckIns > 0 || stats.todayCheckOuts > 0) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-bold text-amber-900">Actions Required</h2>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-lg border border-amber-100 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold text-slate-500">Pending Bookings</p>
                                <p className={`text-2xl font-bold ${stats.pendingBookings > 0 ? 'text-amber-600' : 'text-slate-700'}`}>{stats.pendingBookings}</p>
                            </div>
                            {stats.pendingBookings > 0 && (
                                <a href="/staff/bookings" className="text-xs font-semibold text-amber-600 hover:text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg transition-colors border border-amber-100">Review →</a>
                            )}
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-amber-100 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold text-slate-500">Check-ins Today</p>
                                <p className={`text-2xl font-bold ${stats.todayCheckIns > 0 ? 'text-teal-600' : 'text-slate-700'}`}>{stats.todayCheckIns}</p>
                            </div>
                            {stats.todayCheckIns > 0 && (
                                <a href="/staff/check-in-out" className="text-xs font-semibold text-teal-600 hover:text-teal-700 bg-teal-50 px-2.5 py-1.5 rounded-lg transition-colors border border-teal-100">Process →</a>
                            )}
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-amber-100 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold text-slate-500">Check-outs Today</p>
                                <p className={`text-2xl font-bold ${stats.todayCheckOuts > 0 ? 'text-blue-600' : 'text-slate-700'}`}>{stats.todayCheckOuts}</p>
                            </div>
                            {stats.todayCheckOuts > 0 && (
                                <a href="/staff/check-in-out" className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors border border-blue-100">Process →</a>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { title: "Today's Check-ins", value: stats?.todayCheckIns, icon: Icons.checkIn },
                    { title: "Today's Check-outs", value: stats?.todayCheckOuts, icon: Icons.checkOut },
                    { title: 'Available Rooms', value: stats?.availableRooms, icon: Icons.rooms },
                    { title: 'Pending Bookings', value: stats?.pendingBookings, icon: Icons.pending },
                ].map(card => (
                    <div key={card.title} className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-4 hover:shadow-md transition-shadow">
                        <div className="stat-icon mb-3">
                            {card.icon}
                        </div>
                        {loading ? (
                            <div className="h-7 w-12 bg-slate-100 rounded animate-pulse mb-1" />
                        ) : (
                            <p className="text-2xl font-bold text-slate-800 tracking-tight">{card.value ?? 0}</p>
                        )}
                        <p className="text-xs text-slate-400 font-medium">{card.title}</p>
                    </div>
                ))}
            </div>

            {/* Room status + Today schedule */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Room Status */}
                <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5">
                    <p className="section-label mb-4">Room Status</p>

                    {/* Occupancy Bar */}
                    <div className="mb-4">
                        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                            <span>Occupancy</span>
                            <span className="font-semibold text-slate-700">{occupancyPct}%</span>
                        </div>
                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full transition-all duration-700"
                                style={{ width: `${occupancyPct}%` }}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                            <p className="text-xl font-bold text-emerald-600">{stats?.availableRooms ?? '—'}</p>
                            <p className="text-xs text-emerald-700 mt-0.5">Available</p>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                            <p className="text-xl font-bold text-blue-600">{stats?.occupiedRooms ?? '—'}</p>
                            <p className="text-xs text-blue-700 mt-0.5">Occupied</p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <p className="text-xl font-bold text-slate-600">{stats?.totalRooms ?? '—'}</p>
                            <p className="text-xs text-slate-500 mt-0.5">Total</p>
                        </div>
                    </div>

                    <a
                        href="/staff/calendar"
                        className="flex items-center justify-center gap-2 mt-4 text-xs font-semibold text-teal-600 hover:text-teal-700 p-2 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors border border-teal-100"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        View Calendar
                    </a>
                </div>

                {/* Today's Schedule */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                        <p className="section-label">Today's Schedule</p>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">
                            {todayBookings.length} events
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-100">
                                    <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Type</th>
                                    <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Guest</th>
                                    <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Room</th>
                                    <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading && (
                                    <tr>
                                        <td colSpan={4} className="px-5 py-10 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-6 h-6 border-2 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
                                                <span className="text-sm text-slate-400">Loading schedule...</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {!loading && todayBookings.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-5 py-12 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                                                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                    </svg>
                                                </div>
                                                <p className="text-sm text-slate-400 font-medium">No check-ins or check-outs today</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {!loading && todayBookings.map((booking) => (
                                    <tr key={`${booking.id}-${booking.type}`} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="px-5 py-3.5">
                                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                                booking.type === 'check-in'
                                                    ? 'bg-teal-50 text-teal-700 border border-teal-100'
                                                    : 'bg-orange-50 text-orange-700 border border-orange-100'
                                            }`}>
                                                {booking.type}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <p className="text-sm font-semibold text-slate-800">{booking.guestName}</p>
                                            <p className="text-xs text-slate-400 font-mono">{booking.id.slice(0, 8)}…</p>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className="text-sm font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg font-mono">
                                                {booking.room}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <a
                                                href="/staff/check-in-out"
                                                className="text-xs font-semibold text-teal-600 hover:text-teal-800 hover:underline underline-offset-2"
                                            >
                                                Process →
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div>
                <p className="section-label mb-3">Quick Actions</p>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    {[
                        { href: '/staff/bookings?new=true', label: 'New Walk-in', desc: 'Create a new booking', icon: (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                            </svg>
                        )},
                        { href: '/staff/check-in-out', label: 'Process Check-In', desc: 'Check in arriving guests', icon: Icons.checkIn },
                        { href: '/staff/calendar', label: 'Occupancy Calendar', desc: 'View room availability grid', icon: (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        )},
                        { href: '/staff/bookings', label: 'View Bookings', desc: 'Manage all reservations', icon: (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        )},
                        { href: '/staff/rooms', label: 'Room Status', desc: 'View room availability', icon: Icons.rooms },
                    ].map(action => (
                        <a
                            key={action.href}
                            href={action.href}
                            className="bg-white rounded-xl border border-slate-200/60 p-4 hover:border-teal-200 hover:shadow-md transition-all group flex items-start gap-4"
                        >
                            <div className="stat-icon flex-shrink-0 group-hover:bg-teal-100 group-hover:border-teal-200 group-hover:text-teal-700 transition-colors">
                                {action.icon}
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-slate-800 group-hover:text-teal-800 transition-colors">{action.label}</h3>
                                <p className="text-xs text-slate-400 mt-0.5">{action.desc}</p>
                            </div>
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
}
