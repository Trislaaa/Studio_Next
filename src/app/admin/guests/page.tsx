'use client';

import { useState, useEffect } from 'react';
import GuestDetailsDrawer from '@/components/admin/GuestDetailsDrawer';

interface GuestBooking {
    id: string;
    checkIn: string;
    checkOut: string;
    status: string;
    totalAmount: number;
    roomNumber: string;
    roomType: string;
}

interface Guest {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    address: Record<string, string> | null;
    idProof: Record<string, string> | null;
    totalBookings: number;
    completedBookings: number;
    totalSpend: number;
    lastVisit: string | null;
    status: string;
    createdAt: string;
    bookings: GuestBooking[];
}

interface Stats {
    total: number;
    vip: number;
    regular: number;
    new: number;
}

export default function GuestsManagementPage() {
    const [guests, setGuests] = useState<Guest[]>([]);
    const [stats, setStats] = useState<Stats>({ total: 0, vip: 0, regular: 0, new: 0 });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchGuests = async (search?: string) => {
        setLoading(true);
        setError(null);
        try {
            const url = search
                ? `/api/admin/guests?search=${encodeURIComponent(search)}`
                : '/api/admin/guests';
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to fetch guests');
            const data = await res.json();
            setGuests(data.guests || []);
            setStats(data.stats || { total: 0, vip: 0, regular: 0, new: 0 });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to fetch guests');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGuests();
    }, []);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchGuests(searchTerm || undefined);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'VIP':
                return 'bg-amber-100 text-amber-700 border border-amber-200';
            case 'Regular':
                return 'bg-blue-100 text-blue-700 border border-blue-200';
            case 'New':
                return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
            default:
                return 'bg-slate-100 text-slate-600 border border-slate-200';
        }
    };

    if (loading && guests.length === 0) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
                        <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-teal-500 border-t-transparent animate-spin"></div>
                    </div>
                    <p className="text-sm text-slate-500">Loading guests...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <p className="text-slate-500">View and manage guest information</p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm flex items-center gap-3">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                </div>
            )}

            {/* Stats */}
            <div className="grid md:grid-cols-4 gap-5">
                <div className="bg-white rounded-xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 bg-gradient-to-br from-slate-400 to-slate-500 rounded-lg flex items-center justify-center text-white mb-3">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    </div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Total Guests</p>
                    <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                </div>
                <div className="bg-white rounded-xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center text-white mb-3">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                    </div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">VIP Guests</p>
                    <p className="text-2xl font-bold text-amber-600">{stats.vip}</p>
                    <p className="text-xs text-slate-400 mt-1">5+ completed bookings</p>
                </div>
                <div className="bg-white rounded-xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center text-white mb-3">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Regular Guests</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.regular}</p>
                    <p className="text-xs text-slate-400 mt-1">1-4 completed bookings</p>
                </div>
                <div className="bg-white rounded-xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center text-white mb-3">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                    </div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">New Guests</p>
                    <p className="text-2xl font-bold text-emerald-600">{stats.new}</p>
                    <p className="text-xs text-slate-400 mt-1">No completed bookings yet</p>
                </div>
            </div>

            {/* Search */}
            <div className="bg-white rounded-xl p-5 border border-slate-200/60 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search by name, email, or phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all"
                        />
                    </div>
                    {loading && (
                        <div className="relative">
                            <div className="w-5 h-5 rounded-full border-2 border-slate-200"></div>
                            <div className="absolute top-0 left-0 w-5 h-5 rounded-full border-2 border-teal-500 border-t-transparent animate-spin"></div>
                        </div>
                    )}
                </div>
            </div>

            {/* Guests Table */}
            <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Guest
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Contact
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Bookings
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Total Spend
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Last Visit
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {guests.map((guest, idx) => (
                                <tr
                                    key={guest.id}
                                    className={`hover:bg-slate-50/50 transition-colors ${idx !== guests.length - 1 ? 'border-b border-slate-100' : ''}`}
                                >
                                    <td className="px-6 py-4">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800">
                                                {guest.fullName}
                                            </p>
                                            <p className="text-xs text-slate-500">{guest.email}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {guest.phone}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div>
                                            <span className="text-sm font-semibold text-slate-800">
                                                {guest.totalBookings}
                                            </span>
                                            <span className="text-xs text-slate-500 ml-1">
                                                ({guest.completedBookings} completed)
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                                        ₹{guest.totalSpend.toLocaleString('en-IN')}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {guest.lastVisit
                                            ? new Date(guest.lastVisit).toLocaleDateString('en-IN')
                                            : 'Never'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span
                                            className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                                guest.status
                                            )}`}
                                        >
                                            {guest.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => setSelectedGuest(guest)}
                                            className="text-teal-600 hover:text-teal-700 text-sm font-medium transition-colors"
                                        >
                                            View Details
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {guests.length === 0 && !loading && (
                    <div className="p-16 text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">
                            No guests found
                        </h3>
                        <p className="text-slate-500 text-sm">
                            {searchTerm
                                ? 'Try adjusting your search term'
                                : 'Guests will appear here when bookings are made'}
                        </p>
                    </div>
                )}
            </div>

            {/* Guest Details Drawer */}
            {selectedGuest && (
                <GuestDetailsDrawer
                    guest={selectedGuest}
                    onClose={() => setSelectedGuest(null)}
                />
            )}
        </div>
    );
}
