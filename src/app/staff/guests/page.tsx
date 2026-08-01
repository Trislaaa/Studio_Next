'use client';

import { useEffect, useState } from 'react';

interface Guest {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    totalBookings: number;
    lastBooking?: string;
}

export default function StaffGuestsPage() {
    const [guests, setGuests] = useState<Guest[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchGuests();
    }, []);

    const fetchGuests = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/guests');
            const data = await response.json();

            if (data.guests) {
                setGuests(data.guests || []);
            }
        } catch (err) {
            console.error('Failed to fetch guests:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredGuests = guests.filter((guest) => {
        if (!search) return true;
        const searchLower = search.toLowerCase();
        return (
            guest.fullName?.toLowerCase().includes(searchLower) ||
            guest.email?.toLowerCase().includes(searchLower) ||
            guest.phone?.includes(search)
        );
    });

    return (
        <div className="space-y-6">
            {/* Search */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="relative">
                    <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search by name, email, or phone..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                    />
                </div>
            </div>

            {/* Guests List */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center">
                        <div className="inline-block w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-4 text-slate-600">Loading guests...</p>
                    </div>
                ) : filteredGuests.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">No guests found</h3>
                        <p className="text-slate-600">No guests match your search criteria.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left py-4 px-6 text-sm font-semibold text-slate-600">Guest</th>
                                    <th className="text-left py-4 px-6 text-sm font-semibold text-slate-600">Contact</th>
                                    <th className="text-left py-4 px-6 text-sm font-semibold text-slate-600">Bookings</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {filteredGuests.map((guest) => (
                                    <tr key={guest.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-600 to-teal-400 flex items-center justify-center text-white font-semibold">
                                                    {guest.fullName?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-900">{guest.fullName}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <p className="text-slate-900">{guest.email}</p>
                                            <p className="text-sm text-slate-500">{guest.phone}</p>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700">
                                                {guest.totalBookings || 0} booking(s)
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
