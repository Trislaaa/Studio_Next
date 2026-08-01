'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { BookingDetailsDrawer } from '@/components/admin/BookingDetailsDrawer';
import NewBookingModal from '@/components/admin/NewBookingModal';

interface Booking {
    id: string;
    bookingReference: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    guestIdProof?: {
        type?: string;
        number?: string;
        image_url?: string;
    } | null;
    room: string;
    roomType: string;
    checkIn: string;
    checkOut: string;
    status: string;
    totalAmount: number;
    taxAmount: number;
    discountAmount: number;
    baseAmount: number;
    paidAmount: number;
    refundAmount: number;
    guests: number;
    pmsBookingId: string | null;
    cancellationAudit: {
        actor: string | null;
        cancelledAt: string | null;
        refundAmount: number;
        refundPercentage: number;
        refundGatewayId: string | null;
        policyWindow: string | null;
        cancellationReason: string | null;
    } | null;
}

export default function BookingsManagementPage() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [newModalOpen, setNewModalOpen] = useState(false);
    const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [summary, setSummary] = useState<Record<string, number>>({ all: 0 });
    const initialFetchDone = useRef(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const fetchBookings = useCallback(async (options?: { append?: boolean; cursor?: string | null }) => {
        const append = options?.append ?? false;

        if (append) {
            setLoadingMore(true);
        } else if (!initialFetchDone.current) {
            setLoading(true);
        } else {
            setIsSearching(true);
        }
        try {
            const params = new URLSearchParams();
            if (filter !== 'all') params.append('status', filter);
            if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
            params.append('limit', '100');
            if (options?.cursor) params.append('cursor', options.cursor);

            const response = await fetch(`/api/admin/bookings?${params}`);
            if (!response.ok) throw new Error('Failed to fetch bookings');

            const data = await response.json();
            setBookings((prev) => (append ? [...prev, ...(data.bookings ?? [])] : data.bookings));
            setSummary(data.summary ?? { all: 0 });
            setHasMore(Boolean(data.pagination?.hasMore));
            setNextCursor(data.pagination?.nextCursor ?? null);
        } catch (error) {
            console.error('Error fetching bookings:', error);
            alert('Failed to load bookings');
        } finally {
            if (append) {
                setLoadingMore(false);
            } else {
                setLoading(false);
                setIsSearching(false);
                initialFetchDone.current = true;
            }
        }
    }, [filter, debouncedSearchTerm]);

    useEffect(() => {
        fetchBookings();
    }, [fetchBookings]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchBookings();
    };

    const handleLoadMore = () => {
        if (!hasMore || !nextCursor || loadingMore) return;
        fetchBookings({ append: true, cursor: nextCursor });
    };

    const handleStatusChange = async (bookingId: string, newStatus: string, bookingRef: string) => {
        let cancellationReason = '';
        if (newStatus === 'CANCELLED') {
            cancellationReason = prompt('Please enter cancellation reason:') || '';
            if (!cancellationReason) return;
        }

        const confirmMessages: Record<string, string> = {
            CHECKED_IN: 'Mark this booking as checked-in?',
            CHECKED_OUT: 'Mark this booking as checked-out?',
            CANCELLED: `Cancel booking ${bookingRef}?`,
            CONFIRMED: 'Confirm this booking?',
        };

        if (!confirm(confirmMessages[newStatus] || 'Update booking status?')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/bookings/${bookingId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: newStatus,
                    ...(cancellationReason && { cancellationReason }),
                }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(payload?.error || 'Failed to update status');

            await fetchBookings();

            if (newStatus === 'CANCELLED' && payload?.cancellation) {
                const refundAmount = Number(payload.cancellation.refundAmount || 0);
                const charge = Number(payload.cancellation.cancellationCharge || 0);
                alert(
                    `Booking cancelled successfully.\nRefund: ₹${refundAmount.toLocaleString('en-IN')}\nCancellation Charge: ₹${charge.toLocaleString('en-IN')}`
                );
            } else {
                alert('Booking status updated successfully!');
            }
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Failed to update booking status');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'CONFIRMED':
                return 'bg-blue-100 text-blue-700 border border-blue-200';
            case 'CHECKED_IN':
                return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
            case 'CHECKED_OUT':
                return 'bg-slate-100 text-slate-600 border border-slate-200';
            case 'PENDING':
                return 'bg-amber-100 text-amber-700 border border-amber-200';
            case 'CANCELLED':
                return 'bg-red-100 text-red-700 border border-red-200';
            default:
                return 'bg-slate-100 text-slate-600 border border-slate-200';
        }
    };

    const statusCounts = {
        all: summary.all ?? bookings.length,
        PENDING: summary.PENDING ?? 0,
        CONFIRMED: summary.CONFIRMED ?? 0,
        CHECKED_IN: summary.CHECKED_IN ?? 0,
        CHECKED_OUT: summary.CHECKED_OUT ?? 0,
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
                        <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-teal-500 border-t-transparent animate-spin"></div>
                    </div>
                    <p className="text-sm text-slate-500">Loading bookings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <p className="text-slate-500">View and manage all bookings</p>
                <div className="flex items-center gap-3">
                    <button
                        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all shadow-sm"
                        onClick={async () => {
                            try {
                                const res = await fetch('/api/admin/export');
                                if (!res.ok) throw new Error('Export failed');
                                const blob = await res.blob();
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `Studio next_Hotel_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
                                a.click();
                                URL.revokeObjectURL(url);
                            } catch {
                                alert('Failed to export report');
                            }
                        }}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export Excel
                    </button>
                    <button 
                        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-linear-to-r from-teal-500 to-emerald-500 rounded-lg hover:from-teal-600 hover:to-emerald-600 transition-all shadow-sm"
                        onClick={() => setNewModalOpen(true)}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        New Booking
                    </button>
                </div>
            </div>

            {/* Search & Filter */}
            <div className="bg-white rounded-xl p-5 border border-slate-200/60 shadow-sm">
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Search */}
                    <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                        <div className="relative flex-1">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search by booking ref, guest name, or room..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all"
                            />
                        </div>
                        <button type="submit" className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2">
                            {isSearching ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                                    <span>Searching...</span>
                                </>
                            ) : (
                                <span>Search</span>
                            )}
                        </button>
                    </form>

                    {/* Status Filter */}
                    <div className="flex flex-wrap gap-2">
                        {[
                            { key: 'all', label: 'All', count: statusCounts.all },
                            { key: 'PENDING', label: 'Pending', count: statusCounts.PENDING },
                            { key: 'CONFIRMED', label: 'Confirmed', count: statusCounts.CONFIRMED },
                            { key: 'CHECKED_IN', label: 'Checked In', count: statusCounts.CHECKED_IN },
                            { key: 'CHECKED_OUT', label: 'Checked Out', count: statusCounts.CHECKED_OUT },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setFilter(tab.key)}
                                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${filter === tab.key
                                    ? 'bg-teal-500 text-white shadow-sm'
                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                                    }`}
                            >
                                {tab.label} <span className="ml-1 opacity-70">({tab.count})</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bookings Table */}
            <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Booking Ref
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Guest
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Room
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Check-in
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Check-out
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Amount
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
                            {bookings.map((booking, idx) => (
                                <tr key={booking.id} className={`hover:bg-slate-50/50 transition-colors ${idx !== bookings.length - 1 ? 'border-b border-slate-100' : ''}`}>
                                    <td className="px-6 py-4 text-sm font-mono text-slate-700">
                                        {booking.bookingReference}
                                        {booking.pmsBookingId && (
                                            <span className="ml-2 inline-flex items-center text-xs text-emerald-600" title="Synced to PMS">
                                                <svg className="w-3 h-3 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                                PMS
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-slate-800">{booking.guestName}</div>
                                        <div className="text-xs text-slate-500">{booking.guestPhone}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-700">{booking.room}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {new Date(booking.checkIn).toLocaleDateString('en-IN')}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {new Date(booking.checkOut).toLocaleDateString('en-IN')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-semibold text-slate-800">
                                            ₹{booking.totalAmount.toLocaleString('en-IN')}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            Paid: ₹{booking.paidAmount.toLocaleString('en-IN')}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                                            {booking.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-1.5">
                                            <button
                                                onClick={() => { setActiveBooking(booking); setDrawerOpen(true); }}
                                                className="text-xs px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors font-medium"
                                            >
                                                View
                                            </button>
                                            {booking.status === 'PENDING' && (
                                                <button
                                                    onClick={() => handleStatusChange(booking.id, 'CONFIRMED', booking.bookingReference)}
                                                    className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors font-medium"
                                                >
                                                    Confirm
                                                </button>
                                            )}
                                            {booking.status === 'CONFIRMED' && (
                                                <button
                                                    onClick={() => handleStatusChange(booking.id, 'CHECKED_IN', booking.bookingReference)}
                                                    className="text-xs px-3 py-1.5 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors font-medium"
                                                >
                                                    Check-in
                                                </button>
                                            )}
                                            {booking.status === 'CHECKED_IN' && (
                                                <button
                                                    onClick={() => handleStatusChange(booking.id, 'CHECKED_OUT', booking.bookingReference)}
                                                    className="text-xs px-3 py-1.5 bg-slate-500 text-white rounded-md hover:bg-slate-600 transition-colors font-medium"
                                                >
                                                    Check-out
                                                </button>
                                            )}
                                            {!['CANCELLED', 'CHECKED_OUT'].includes(booking.status) && (
                                                <button
                                                    onClick={() => handleStatusChange(booking.id, 'CANCELLED', booking.bookingReference)}
                                                    className="text-xs px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors font-medium"
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {bookings.length === 0 && (
                    <div className="p-16 text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">No bookings found</h3>
                        <p className="text-slate-500 text-sm">
                            {searchTerm
                                ? 'Try adjusting your search term'
                                : bookings.length === 0
                                    ? 'No bookings yet. Bookings will appear here once guests make reservations.'
                                    : 'No bookings match the selected filter'}
                        </p>
                    </div>
                )}
            </div>

            {bookings.length > 0 && (
                <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Loaded {bookings.length} bookings</span>
                    {hasMore ? (
                        <button
                            type="button"
                            onClick={handleLoadMore}
                            disabled={loadingMore}
                            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {loadingMore ? 'Loading more...' : 'Load More'}
                        </button>
                    ) : (
                        <span>End of results</span>
                    )}
                </div>
            )}

            {/* Details Drawer */}
            <BookingDetailsDrawer
                open={drawerOpen}
                booking={activeBooking}
                onClose={() => setDrawerOpen(false)}
                onChangeStatus={handleStatusChange}
            />

            {/* New Booking Modal */}
            <NewBookingModal
                open={newModalOpen}
                onClose={() => setNewModalOpen(false)}
                onCreated={fetchBookings}
            />
        </div>
    );
}
