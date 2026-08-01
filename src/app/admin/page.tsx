'use client';

import { useEffect, useState } from 'react';
import OccupancyCalendar from '@/components/OccupancyCalendar';

interface RoomStatus {
    available: number;
    occupied: number;
    maintenance: number;
    blocked: number;
}

interface DashboardStats {
    totalBookings: number;
    bookingsChange: number;
    todayCheckIns: number;
    todayCheckOuts: number;
    occupancyRate: number;
    revenue: number;
    revenueChange: number;
    totalRooms: number;
    roomStatus: RoomStatus;
    pendingBookings: number;
    totalGuests: number;
    upcomingCheckIns: number;
    overdueCheckouts: number;
}

interface RecentBooking {
    id: string;
    guestName: string;
    room: string;
    roomType: string;
    checkIn: string;
    checkOut: string;
    status: string;
    amount: number;
}

interface CheckInOut {
    id: string;
    guestName: string;
    room: string;
    status?: string;
}

// Icon components for cleaner UI
const Icons = {
    revenue: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    calendar: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
    ),
    hotel: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
    ),
    users: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
    ),
    refresh: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
    ),
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
    plus: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
    ),
    bed: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v11a1 1 0 001 1h16a1 1 0 001-1V7M3 7h18M7 11h2m6 0h2" />
        </svg>
    ),
    tag: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
    ),
    userGroup: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
    ),
    arrowUp: (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
    ),
    arrowDown: (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
    ),
    warning: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
    )
};

export default function AdminDashboard() {
    const [stats, setStats] = useState<DashboardStats>({
        totalBookings: 0,
        bookingsChange: 0,
        todayCheckIns: 0,
        todayCheckOuts: 0,
        occupancyRate: 0,
        revenue: 0,
        revenueChange: 0,
        totalRooms: 0,
        roomStatus: { available: 0, occupied: 0, maintenance: 0, blocked: 0 },
        pendingBookings: 0,
        totalGuests: 0,
        upcomingCheckIns: 0,
        overdueCheckouts: 0,
    });
    const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
    const [todayCheckInsList, setTodayCheckInsList] = useState<CheckInOut[]>([]);
    const [todayCheckOutsList, setTodayCheckOutsList] = useState<CheckInOut[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardStats();
    }, []);

    const fetchDashboardStats = async () => {
        try {
            const response = await fetch('/api/admin/dashboard/stats');
            if (!response.ok) throw new Error('Failed to fetch stats');

            const data = await response.json();
            setStats(data.stats);
            setRecentBookings(data.stats.recentBookings || []);
            setTodayCheckInsList(data.stats.todayCheckInsList || []);
            setTodayCheckOutsList(data.stats.todayCheckOutsList || []);
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return `₹${amount.toLocaleString('en-IN')}`;
    };

    const getChangeIndicator = (change: number) => {
        if (change > 0) return { icon: Icons.arrowUp, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' };
        if (change < 0) return { icon: Icons.arrowDown, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
        return { icon: null, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' };
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
                        <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-teal-500 border-t-transparent animate-spin"></div>
                    </div>
                    <p className="text-sm text-slate-500">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    const revenueIndicator = getChangeIndicator(stats.revenueChange);
    const bookingsIndicator = getChangeIndicator(stats.bookingsChange);

    return (
        <div className="space-y-6">
            {/* Date Info */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-slate-500">
                        {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <button 
                    onClick={fetchDashboardStats} 
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all"
                >
                    {Icons.refresh}
                    Refresh
                </button>
            </div>

            {/* Critical Alert - Overdue Checkouts */}
            {stats && (stats.overdueCheckouts ?? 0) > 0 && (
                <div className="bg-linear-to-r from-red-50 to-rose-50 border border-red-200/60 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                            {Icons.warning}
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-red-900">URGENT: Overdue Check-outs</p>
                            <p className="text-sm text-red-700">
                                {stats.overdueCheckouts} guest{stats.overdueCheckouts > 1 ? 's have' : ' has'} missed their scheduled check-out time. Please verify with the front desk.
                            </p>
                        </div>
                        <a href="/admin/bookings" className="px-4 py-2 text-sm font-medium text-white bg-linear-to-r from-red-500 to-rose-500 rounded-lg hover:from-red-600 hover:to-rose-600 transition-all shadow-sm">
                            Resolve Now
                        </a>
                    </div>
                </div>
            )}

            {/* Alert Banner - Pending Actions */}
            {(stats.pendingBookings > 0 || stats.todayCheckIns > 0 || stats.todayCheckOuts > 0) && (
                <div className="bg-linear-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                            {Icons.warning}
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-amber-900">Actions Required</p>
                            <p className="text-sm text-amber-700">
                                {[
                                    stats.pendingBookings > 0 && `${stats.pendingBookings} pending booking${stats.pendingBookings > 1 ? 's' : ''} to confirm`,
                                    stats.todayCheckIns > 0 && `${stats.todayCheckIns} check-in${stats.todayCheckIns > 1 ? 's' : ''} today`,
                                    stats.todayCheckOuts > 0 && `${stats.todayCheckOuts} check-out${stats.todayCheckOuts > 1 ? 's' : ''} today`,
                                ].filter(Boolean).join(' • ')}
                            </p>
                        </div>
                        <a href="/admin/bookings" className="px-4 py-2 text-sm font-medium text-white bg-linear-to-r from-amber-500 to-orange-500 rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm">
                            View Bookings
                        </a>
                    </div>
                </div>
            )}

            {/* Key Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Revenue */}
                <div className="bg-white rounded-xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <div className="stat-icon">
                            {Icons.revenue}
                        </div>
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${revenueIndicator.bg} ${revenueIndicator.color} border ${revenueIndicator.border}`}>
                            {revenueIndicator.icon} {Math.abs(stats.revenueChange)}%
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800 tracking-tight">{formatCurrency(stats.revenue)}</p>
                    <p className="text-xs text-slate-400 mt-1 font-medium">Net revenue this month</p>
                </div>

                {/* Bookings */}
                <div className="bg-white rounded-xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <div className="stat-icon">
                            {Icons.calendar}
                        </div>
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${bookingsIndicator.bg} ${bookingsIndicator.color} border ${bookingsIndicator.border}`}>
                            {bookingsIndicator.icon} {Math.abs(stats.bookingsChange)}%
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800 tracking-tight">{stats.totalBookings}</p>
                    <p className="text-xs text-slate-400 mt-1 font-medium">Bookings this month</p>
                </div>

                {/* Occupancy */}
                <div className="bg-white rounded-xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <div className="stat-icon">
                            {Icons.hotel}
                        </div>
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200">
                            {stats.roomStatus.occupied}/{stats.totalRooms} rooms
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800 tracking-tight">{stats.occupancyRate}%</p>
                    <p className="text-xs text-slate-400 mt-1 font-medium">Current occupancy</p>
                </div>

                {/* Guests */}
                <div className="bg-white rounded-xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <div className="stat-icon">
                            {Icons.users}
                        </div>
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200">
                            +{stats.upcomingCheckIns} upcoming
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800 tracking-tight">{stats.totalGuests}</p>
                    <p className="text-xs text-slate-400 mt-1 font-medium">Total guests</p>
                </div>
            </div>

            {/* Room Status Breakdown */}
            <div className="bg-white rounded-xl p-6 border border-slate-200/60 shadow-sm">
                <p className="section-label mb-5">Room Status</p>
                <div className="grid grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-linear-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-100">
                        <p className="text-3xl font-bold text-emerald-600">{stats.roomStatus.available}</p>
                        <p className="text-xs font-medium text-emerald-700 mt-1">Available</p>
                    </div>
                    <div className="text-center p-4 bg-linear-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                        <p className="text-3xl font-bold text-blue-600">{stats.roomStatus.occupied}</p>
                        <p className="text-xs font-medium text-blue-700 mt-1">Occupied</p>
                    </div>
                    <div className="text-center p-4 bg-linear-to-br from-amber-50 to-yellow-50 rounded-xl border border-amber-100">
                        <p className="text-3xl font-bold text-amber-600">{stats.roomStatus.maintenance}</p>
                        <p className="text-xs font-medium text-amber-700 mt-1">Maintenance</p>
                    </div>
                    <div className="text-center p-4 bg-linear-to-br from-red-50 to-rose-50 rounded-xl border border-red-100">
                        <p className="text-3xl font-bold text-red-600">{stats.roomStatus.blocked}</p>
                        <p className="text-xs font-medium text-red-700 mt-1">Blocked</p>
                    </div>
                </div>
            </div>

            {/* Today's Operations & Recent Bookings */}
            <div className="grid lg:grid-cols-3 gap-6">
                {/* Today's Check-ins */}
                <div className="bg-white rounded-xl p-5 border border-slate-200/60 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-teal-50 border border-teal-100 rounded-lg flex items-center justify-center text-teal-600">
                                {Icons.checkIn}
                            </div>
                            <h3 className="text-sm font-semibold text-slate-700">Today's Check-ins</h3>
                        </div>
                        <span className="text-lg font-bold text-emerald-600">{stats.todayCheckIns}</span>
                    </div>
                    {todayCheckInsList.length > 0 ? (
                        <div className="space-y-2">
                            {todayCheckInsList.map((item) => (
                                <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                                    <div>
                                        <p className="text-sm font-medium text-slate-800">{item.guestName}</p>
                                        <p className="text-xs text-slate-500">Room {item.room}</p>
                                    </div>
                                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${item.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                                        {item.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-400">
                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="text-sm">No check-ins today</p>
                        </div>
                    )}
                </div>

                {/* Today's Check-outs */}
                <div className="bg-white rounded-xl p-5 border border-slate-200/60 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-teal-50 border border-teal-100 rounded-lg flex items-center justify-center text-teal-600">
                                {Icons.checkOut}
                            </div>
                            <h3 className="text-sm font-semibold text-slate-700">Today's Check-outs</h3>
                        </div>
                        <span className="text-lg font-bold text-orange-600">{stats.todayCheckOuts}</span>
                    </div>
                    {todayCheckOutsList.length > 0 ? (
                        <div className="space-y-2">
                            {todayCheckOutsList.map((item) => (
                                <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                                    <div>
                                        <p className="text-sm font-medium text-slate-800">{item.guestName}</p>
                                        <p className="text-xs text-slate-500">Room {item.room}</p>
                                    </div>
                                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-100 text-amber-700 border border-amber-200">
                                        CHECK-OUT DUE
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-400">
                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="text-sm">No check-outs today</p>
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-xl p-5 border border-slate-200/60 shadow-sm">
                    <p className="section-label mb-4">Quick Actions</p>
                    <div className="space-y-2">
                        <a href="/admin/bookings" className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-teal-50 rounded-lg transition-all border border-slate-100 hover:border-teal-100 group">
                            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                                {Icons.plus}
                            </div>
                            <span className="text-sm font-medium text-slate-700 group-hover:text-teal-800">New Booking</span>
                        </a>
                        <a href="/admin/rooms" className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-teal-50 rounded-lg transition-all border border-slate-100 hover:border-teal-100 group">
                            <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                                {Icons.bed}
                            </div>
                            <span className="text-sm font-medium text-slate-700 group-hover:text-teal-800">Manage Rooms</span>
                        </a>
                        <a href="/admin/rates" className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-teal-50 rounded-lg transition-all border border-slate-100 hover:border-teal-100 group">
                            <div className="w-8 h-8 bg-slate-600 rounded-lg flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                                {Icons.tag}
                            </div>
                            <span className="text-sm font-medium text-slate-700 group-hover:text-teal-800">Update Rates</span>
                        </a>
                        <a href="/admin/guests" className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-teal-50 rounded-lg transition-all border border-slate-100 hover:border-teal-100 group">
                            <div className="w-8 h-8 bg-slate-500 rounded-lg flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                                {Icons.userGroup}
                            </div>
                            <span className="text-sm font-medium text-slate-700 group-hover:text-teal-800">Guest Directory</span>
                        </a>
                    </div>
                </div>
            </div>

            {/* Recent Bookings */}
            <div className="bg-white rounded-xl p-6 border border-slate-200/60 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                    <p className="section-label">Recent Bookings</p>
                    <a href="/admin/bookings" className="text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors">View All →</a>
                </div>

                {recentBookings.length > 0 ? (
                    <div className="overflow-x-auto -mx-6">
                        <table className="w-full min-w-150">
                            <thead>
                                <tr className="text-left border-b border-slate-100">
                                    <th className="px-6 pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Booking</th>
                                    <th className="px-4 pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Guest</th>
                                    <th className="px-4 pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Room</th>
                                    <th className="px-4 pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Dates</th>
                                    <th className="px-4 pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                                    <th className="px-6 pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentBookings.map((booking, idx) => (
                                    <tr key={booking.id} className={`text-sm hover:bg-slate-50 transition-colors ${idx !== recentBookings.length - 1 ? 'border-b border-slate-50' : ''}`}>
                                        <td className="px-6 py-4 font-mono text-xs text-slate-400">{booking.id.slice(0, 8)}</td>
                                        <td className="px-4 py-4 font-medium text-slate-800">{booking.guestName}</td>
                                        <td className="px-4 py-4 text-slate-600">{booking.room}</td>
                                        <td className="px-4 py-4 text-slate-600">
                                            {new Date(booking.checkIn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — {new Date(booking.checkOut).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        </td>
                                        <td className="px-4 py-4 font-semibold text-slate-800">₹{booking.amount.toLocaleString('en-IN')}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                                booking.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                                booking.status === 'PENDING' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                                booking.status === 'CHECKED_IN' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                                booking.status === 'CHECKED_OUT' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                                                'bg-red-100 text-red-700 border border-red-200'
                                            }`}>
                                                {booking.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-12 text-slate-400">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <p className="font-medium text-slate-500">No bookings yet</p>
                        <p className="text-sm text-slate-400 mt-1">Bookings will appear here once created</p>
                    </div>
                )}
            </div>

            {/* Occupancy Calendar */}
            <div className="bg-white rounded-xl p-6 border border-slate-200/60 shadow-sm">
                <OccupancyCalendar />
            </div>
        </div>
    );
}
