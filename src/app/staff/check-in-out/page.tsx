'use client';

import { useEffect, useState, useCallback } from 'react';

interface Booking {
    id: string;
    bookingReference: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    roomNumber: string;
    roomType: string;
    checkIn: string;
    checkOut: string;
    status: string;
    totalAmount: number;
    numberOfGuests: number;
}

const CHECKOUT_HOUR_IST = 10; // 10 AM
const CHECKIN_HOUR_IST = 11;   // 11 AM
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function nowIST() {
    return new Date(Date.now() + IST_OFFSET_MS);
}

function isPastCheckoutTime() {
    const ist = nowIST();
    return ist.getUTCHours() >= CHECKOUT_HOUR_IST;
}

function minutesUntilCheckout() {
    const ist = nowIST();
    const checkoutMinuteOfDay = CHECKOUT_HOUR_IST * 60;
    const currentMinuteOfDay = ist.getUTCHours() * 60 + ist.getUTCMinutes();
    return checkoutMinuteOfDay - currentMinuteOfDay;
}

export default function StaffCheckInOutPage() {
    const [todayCheckIns, setTodayCheckIns] = useState<Booking[]>([]);
    const [todayCheckOuts, setTodayCheckOuts] = useState<Booking[]>([]);
    const [overdueCheckOuts, setOverdueCheckOuts] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);
    const [autoChecking, setAutoChecking] = useState(false);
    const [pastCheckout, setPastCheckout] = useState(isPastCheckoutTime());
    const [minsLeft, setMinsLeft] = useState(minutesUntilCheckout());

    // Clock updater
    useEffect(() => {
        const timer = setInterval(() => {
            setPastCheckout(isPastCheckoutTime());
            setMinsLeft(minutesUntilCheckout());
        }, 30000);
        return () => clearInterval(timer);
    }, []);

    const fetchTodayBookings = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/bookings');
            const data = await response.json();

            if (data.bookings) {
                const today = new Date(Date.now() + IST_OFFSET_MS).toISOString().split('T')[0];
                const bookings = data.bookings || [];

                const mapToInternal = (b: any): Booking => ({
                    id: b.id,
                    bookingReference: b.bookingReference,
                    guestName: b.guestName,
                    guestEmail: b.guestEmail,
                    guestPhone: b.guestPhone,
                    roomNumber: b.room,
                    roomType: b.roomType,
                    checkIn: b.checkIn,
                    checkOut: b.checkOut,
                    status: b.status,
                    totalAmount: b.totalAmount,
                    numberOfGuests: b.guests,
                });

                // Today's arrivals
                setTodayCheckIns(
                    bookings.filter((b: any) =>
                        b.checkIn === today && (b.status === 'CONFIRMED' || b.status === 'PENDING')
                    ).map(mapToInternal)
                );

                // Today's departures (still checked in)
                setTodayCheckOuts(
                    bookings.filter((b: any) =>
                        b.checkOut === today && b.status === 'CHECKED_IN'
                    ).map(mapToInternal)
                );

                // Overdue — checked in but checkOut is BEFORE today (e.g. yesterday)
                setOverdueCheckOuts(
                    bookings.filter((b: any) =>
                        b.checkOut < today && b.status === 'CHECKED_IN'
                    ).map(mapToInternal)
                );
            }
        } catch (err) {
            console.error('Failed to fetch bookings:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchTodayBookings(); }, [fetchTodayBookings]);

    const handleCheckIn = async (bookingId: string) => {
        try {
            setProcessing(bookingId);
            const res = await fetch(`/api/admin/bookings/${bookingId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'CHECKED_IN' }),
            });
            if (res.ok) fetchTodayBookings();
            else { const e = await res.json(); alert(e.error || 'Failed to check in'); }
        } finally { setProcessing(null); }
    };

    const handleCheckOut = async (bookingId: string) => {
        try {
            setProcessing(bookingId);
            const res = await fetch(`/api/admin/bookings/${bookingId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'CHECKED_OUT' }),
            });
            if (res.ok) fetchTodayBookings();
            else { const e = await res.json(); alert(e.error || 'Failed to check out'); }
        } finally { setProcessing(null); }
    };

    const handleAutoCheckout = async () => {
        if (!confirm('Run auto-checkout for all overdue rooms now?')) return;
        setAutoChecking(true);
        try {
            // Call through admin API which verifies session server-side
            const res = await fetch('/api/admin/auto-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await res.json();
            if (res.ok) {
                alert(`Auto-checkout complete: ${data.checkedOut} room(s) checked out.`);
            } else {
                alert(data.error || 'Auto-checkout failed.');
            }
            fetchTodayBookings();
        } catch {
            alert('Auto-checkout failed. Please check out rooms manually.');
        } finally {
            setAutoChecking(false);
        }
    };

    const allDepartures = [...overdueCheckOuts, ...todayCheckOuts];

    return (
        <div className="space-y-5">
            {/* Policy Banner */}
            <div className="bg-white border border-slate-200/60 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="stat-icon">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-800">Hotel Policy</p>
                        <p className="text-xs text-slate-400">
                            <span className="text-orange-600 font-semibold">Checkout: 10:00 AM</span>
                            <span className="mx-2 text-slate-300">|</span>
                            <span className="text-teal-600 font-semibold">Check-in: 11:00 AM</span>
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4 text-right">
                    <button 
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-teal-500 to-emerald-500 rounded-lg hover:from-teal-600 hover:to-emerald-600 transition-all shadow-sm"
                        onClick={() => window.location.href = '/staff/bookings?new=true'}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Walk-in Booking
                    </button>
                    {!pastCheckout ? (
                        <div className="text-xs text-orange-600 font-semibold bg-orange-50 border border-orange-100 px-3 py-1.5 rounded-lg whitespace-nowrap">
                            ⏳ Checkout in {Math.floor(minsLeft / 60)}h {minsLeft % 60}m
                        </div>
                    ) : (
                        <div className="text-xs text-emerald-600 font-semibold bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg whitespace-nowrap">
                            ✓ Past checkout time
                        </div>
                    )}
                </div>
            </div>

            {/* Overdue Alert */}
            {(overdueCheckOuts.length > 0 || (todayCheckOuts.length > 0 && pastCheckout)) && (
                <div className={`rounded-xl border p-4 flex items-center justify-between ${
                    overdueCheckOuts.length > 0
                        ? 'bg-red-50 border-red-200'
                        : 'bg-orange-50 border-orange-200'
                }`}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-red-100 border border-red-200 flex items-center justify-center text-red-600 flex-shrink-0">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-red-800">
                                {overdueCheckOuts.length > 0
                                    ? `${overdueCheckOuts.length} overdue checkout(s) — past deadline`
                                    : `${todayCheckOuts.length} room(s) past 10 AM checkout deadline`}
                            </p>
                            <p className="text-xs text-red-600">Rooms cannot be rebooked until checked out</p>
                        </div>
                    </div>
                    <button
                        onClick={handleAutoCheckout}
                        disabled={autoChecking}
                        className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                        {autoChecking ? 'Running...' : 'Auto-Checkout All'}
                    </button>
                </div>
            )}

            {loading ? (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                    <div className="inline-block w-7 h-7 border-2 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
                    <p className="mt-3 text-slate-400 text-sm">Loading today's bookings...</p>
                </div>
            ) : (
                <div className="grid lg:grid-cols-2 gap-5">
                    {/* Today's Check-Ins */}
                    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                            <div className="w-8 h-8 bg-teal-50 border border-teal-100 rounded-lg flex items-center justify-center text-teal-600">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 16l-4-4m0 0l4-4m-4 4h14" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800">Today's Check-Ins</p>
                                <p className="text-xs text-slate-400">Available from 11:00 AM · {todayCheckIns.length} arrival{todayCheckIns.length !== 1 ? 's' : ''}</p>
                            </div>
                        </div>

                        {todayCheckIns.length === 0 ? (
                            <div className="p-10 text-center">
                                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <p className="text-sm text-slate-400">No check-ins pending for today</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {todayCheckIns.map((booking) => (
                                    <div key={booking.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <p className="font-semibold text-slate-800 text-sm">{booking.guestName}</p>
                                                <p className="text-xs text-slate-400 font-mono">{booking.bookingReference}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg font-mono text-sm">
                                                    Room {booking.roomNumber}
                                                </p>
                                                <p className="text-xs text-slate-400 mt-1">{booking.roomType}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-slate-500">
                                                {booking.numberOfGuests} guest(s) ·{' '}
                                                {Math.ceil((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / 86400000)} night(s)
                                            </span>
                                            <button
                                                onClick={() => handleCheckIn(booking.id)}
                                                disabled={processing === booking.id}
                                                className="px-4 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
                                            >
                                                {processing === booking.id ? 'Processing…' : 'Check In →'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Today's Check-Outs */}
                    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                            <div className="w-8 h-8 bg-orange-50 border border-orange-100 rounded-lg flex items-center justify-center text-orange-600">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800">Today's Check-Outs</p>
                                <p className="text-xs text-slate-400">Deadline: 10:00 AM · {allDepartures.length} departure{allDepartures.length !== 1 ? 's' : ''}</p>
                            </div>
                        </div>

                        {allDepartures.length === 0 ? (
                            <div className="p-10 text-center">
                                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <p className="text-sm text-slate-400">No check-outs pending</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {allDepartures.map((booking) => {
                                    const isOverdue = booking.checkOut < new Date(Date.now() + IST_OFFSET_MS).toISOString().split('T')[0];
                                    return (
                                        <div key={booking.id} className={`p-4 hover:bg-slate-50/50 transition-colors ${isOverdue ? 'border-l-2 border-red-400' : ''}`}>
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-semibold text-slate-800 text-sm">{booking.guestName}</p>
                                                        {isOverdue && (
                                                            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded uppercase">Overdue</span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-400 font-mono">{booking.bookingReference}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg font-mono text-sm">
                                                        Room {booking.roomNumber}
                                                    </p>
                                                    <p className="text-xs text-slate-400 mt-1">{booking.roomType}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-slate-500">
                                                    ₹{booking.totalAmount?.toLocaleString('en-IN')} total
                                                    {isOverdue && <span className="ml-1 text-red-500">· Was due {booking.checkOut}</span>}
                                                </span>
                                                <button
                                                    onClick={() => handleCheckOut(booking.id)}
                                                    disabled={processing === booking.id}
                                                    className="px-4 py-1.5 bg-orange-600 text-white text-xs font-semibold rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
                                                >
                                                    {processing === booking.id ? 'Processing…' : 'Check Out →'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
