'use client';

import { useEffect, useState, useMemo } from 'react';

interface Room {
    id: string;
    roomNumber: string;
    type: string;
    status: string;
}

interface Booking {
    id: string;
    roomId: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
    status: string;
}

interface Block {
    id: string;
    roomId: string;
    startDate: string;
    endDate: string;
    reason: string;
}

type CellStatus = 'available' | 'booked' | 'checkin' | 'checkout' | 'blocked' | 'maintenance' | 'past';

export default function OccupancyCalendar() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [rooms, setRooms] = useState<Room[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ roomId: '', start: '', end: '', reason: '' });
    const [submitting, setSubmitting] = useState(false);
    const [hoveredCell, setHoveredCell] = useState<{ roomId: string; date: string } | null>(null);
    const [unblocking, setUnblocking] = useState<string | null>(null);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthName = currentDate.toLocaleString('default', { month: 'long' });

    // Generate dates for the month
    const dates = useMemo(() => {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const result: Date[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
            result.push(new Date(year, month, d));
        }
        return result;
    }, [year, month]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const formatDateKey = (date: Date) => date.toISOString().split('T')[0];

    // Fetch data
    const fetchData = async () => {
        setLoading(true);
        try {
            // Calculate start and end of the current month for blocks query
            const startOfMonth = new Date(year, month, 1).toISOString().split('T')[0];
            const endOfMonth = new Date(year, month + 1, 0).toISOString().split('T')[0];
            
            const [roomsRes, bookingsRes, blocksRes] = await Promise.all([
                fetch('/api/admin/rooms'),
                fetch(`/api/admin/bookings`),
                fetch(`/api/admin/room-blocks?start=${startOfMonth}&end=${endOfMonth}`),
            ]);

            if (roomsRes.ok) {
                const data = await roomsRes.json();
                setRooms(data.rooms || []);
            }
            if (bookingsRes.ok) {
                const data = await bookingsRes.json();
                // Map booking data to include roomId
                setBookings((data.bookings || []).map((b: any) => ({
                    id: b.id,
                    roomId: b.roomId || '',
                    guestName: b.guestName,
                    checkIn: b.checkIn,
                    checkOut: b.checkOut,
                    status: b.status,
                })));
            }
            if (blocksRes.ok) {
                const data = await blocksRes.json();
                setBlocks(data.blocks || []);
            }
        } catch (e) {
            console.error('Failed to fetch calendar data', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [year, month]);

    // Realtime updates
    useEffect(() => {
        let pusher: any;
        let channel: any;
        (async () => {
            try {
                const { default: Pusher } = await import('pusher-js');
                const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
                const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
                if (!key || !cluster) return;
                pusher = new Pusher(key, { cluster });
                channel = pusher.subscribe('inventory');
                channel.bind('update', fetchData);
            } catch {}
        })();
        return () => {
            try {
                if (channel) channel.unbind_all();
                if (pusher) pusher.unsubscribe('inventory');
            } catch {}
        };
    }, [year, month]);

    // Get cell status for a room on a specific date
    const getCellStatus = (room: Room, date: Date): { status: CellStatus; booking?: Booking; block?: Block } => {
        const dateKey = formatDateKey(date);
        const dateObj = new Date(dateKey);

        // Check if date is in the past
        if (dateObj < today) {
            const booking = bookings.find(b => {
                const checkIn = new Date(b.checkIn);
                const checkOut = new Date(b.checkOut);
                return b.roomId === room.id && dateObj >= checkIn && dateObj < checkOut;
            });
            if (booking) return { status: 'past', booking };
            return { status: 'past' };
        }

        // Check for blocks
        const block = blocks.find(b => {
            const start = new Date(b.startDate);
            const end = new Date(b.endDate);
            return b.roomId === room.id && dateObj >= start && dateObj <= end;
        });
        if (block) return { status: 'blocked', block };

        // Check for bookings
        const booking = bookings.find(b => {
            if (b.roomId !== room.id) return false;
            if (b.status === 'CANCELLED') return false;
            const checkIn = new Date(b.checkIn);
            const checkOut = new Date(b.checkOut);
            return dateObj >= checkIn && dateObj < checkOut;
        });

        if (booking) {
            const checkIn = new Date(booking.checkIn);
            const checkOut = new Date(booking.checkOut);
            if (formatDateKey(checkIn) === dateKey) return { status: 'checkin', booking };
            if (formatDateKey(checkOut) === dateKey) return { status: 'checkout', booking };
            return { status: 'booked', booking };
        }

        // Room maintenance
        if (room.status === 'MAINTENANCE') return { status: 'maintenance' };

        return { status: 'available' };
    };

    const getCellColor = (status: CellStatus) => {
        switch (status) {
            case 'available': return 'bg-emerald-50 hover:bg-emerald-100 border-emerald-100';
            case 'booked': return 'bg-blue-100 border-blue-200';
            case 'checkin': return 'bg-emerald-400 border-emerald-500';
            case 'checkout': return 'bg-orange-300 border-orange-400';
            case 'blocked': return 'bg-red-100 border-red-200';
            case 'maintenance': return 'bg-amber-100 border-amber-200';
            case 'past': return 'bg-slate-50 border-slate-100';
            default: return 'bg-white border-slate-100';
        }
    };

    const getCellIcon = (status: CellStatus) => {
        switch (status) {
            case 'checkin': return '→';
            case 'checkout': return '←';
            case 'blocked': return '✕';
            case 'maintenance': return '⚙';
            default: return '';
        }
    };

    const getRoomTypeLabel = (type: string) => {
        switch (type) {
            case 'DELUXE': return 'DLX';
            case 'SUITE': return 'STE';
            case 'FAMILY': return 'FAM';
            case 'STANDARD': return 'STD';
            default: return type.slice(0, 3).toUpperCase();
        }
    };

    const goToPreviousMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const goToNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const goToToday = () => setCurrentDate(new Date());

    const submitBlock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.roomId || !form.start || !form.end) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/admin/room-blocks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId: form.roomId,
                    startDate: form.start,
                    endDate: form.end,
                    reason: form.reason || 'Blocked',
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create block');
            }
            setForm({ roomId: '', start: '', end: '', reason: '' });
            await fetchData();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to create block');
        } finally {
            setSubmitting(false);
        }
    };

    const unblockRoom = async (blockId: string) => {
        if (!confirm('Are you sure you want to unblock this room?')) return;
        setUnblocking(blockId);
        try {
            const res = await fetch(`/api/admin/room-blocks/${blockId}`, {
                method: 'DELETE',
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to unblock');
            }
            await fetchData();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to unblock');
        } finally {
            setUnblocking(null);
        }
    };

    // Sort rooms: Alphanumeric prefixes (B1, B2) first, then numeric-only (01, 101)
    const sortedRooms = useMemo(() => {
        return [...rooms].sort((a, b) => {
            const aNum = a.roomNumber;
            const bNum = b.roomNumber;
            
            // Check if room number starts with a letter
            const aHasLetter = /^[A-Za-z]/.test(aNum);
            const bHasLetter = /^[A-Za-z]/.test(bNum);
            
            // Rooms with letter prefixes come first
            if (aHasLetter && !bHasLetter) return -1;
            if (!aHasLetter && bHasLetter) return 1;
            
            // If both have letters or both don't, sort naturally
            return aNum.localeCompare(bNum, undefined, { numeric: true, sensitivity: 'base' });
        });
    }, [rooms]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full border-4 border-slate-200"></div>
                        <div className="absolute top-0 left-0 w-10 h-10 rounded-full border-4 border-teal-500 border-t-transparent animate-spin"></div>
                    </div>
                    <p className="text-sm text-slate-500">Loading calendar...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-slate-800">{monthName} {year}</h3>
                    <p className="text-sm text-slate-500">Room availability grid</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={goToPreviousMonth} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
                        ← Prev
                    </button>
                    <button onClick={goToToday} className="px-3 py-1.5 text-sm bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors">
                        Today
                    </button>
                    <button onClick={goToNextMonth} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
                        Next →
                    </button>
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 bg-emerald-50 border border-emerald-100 rounded"></div>
                    <span className="text-slate-600">Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded"></div>
                    <span className="text-slate-600">Booked</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 bg-emerald-400 border border-emerald-500 rounded"></div>
                    <span className="text-slate-600">Check-in</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 bg-orange-300 border border-orange-400 rounded"></div>
                    <span className="text-slate-600">Check-out</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 bg-red-100 border border-red-200 rounded"></div>
                    <span className="text-slate-600">Blocked</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 bg-amber-100 border border-amber-200 rounded"></div>
                    <span className="text-slate-600">Maintenance</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 bg-slate-50 border border-slate-100 rounded"></div>
                    <span className="text-slate-600">Past</span>
                </div>
            </div>

            {/* Grid */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-max">
                        <thead>
                            <tr className="bg-slate-50">
                                {/* Room column header */}
                                <th className="sticky left-0 z-10 bg-slate-100 border-b border-r border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide min-w-[120px]">
                                    Room
                                </th>
                                {/* Date headers */}
                                {dates.map((date) => {
                                    const isToday = formatDateKey(date) === formatDateKey(today);
                                    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                    return (
                                        <th
                                            key={formatDateKey(date)}
                                            className={`border-b border-r border-slate-200 px-1 py-2 text-center min-w-[40px] ${
                                                isToday ? 'bg-teal-500 text-white' : isWeekend ? 'bg-slate-100' : 'bg-slate-50'
                                            }`}
                                        >
                                            <div className={`text-[10px] font-medium ${isToday ? 'text-teal-100' : 'text-slate-500'}`}>{dayName}</div>
                                            <div className={`text-sm font-bold ${isToday ? 'text-white' : 'text-slate-700'}`}>
                                                {date.getDate()}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedRooms.map((room) => (
                                <tr key={room.id} className="hover:bg-slate-50/50">
                                    {/* Room info */}
                                    <td className="sticky left-0 z-10 bg-white border-b border-r border-slate-100 px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <div>
                                                <div className="text-sm font-semibold text-slate-800">
                                                    {room.roomNumber}
                                                </div>
                                                <div className="text-[10px] text-slate-500">
                                                    {getRoomTypeLabel(room.type)}
                                                </div>
                                            </div>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                                room.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-700' :
                                                room.status === 'OCCUPIED' ? 'bg-blue-100 text-blue-700' :
                                                room.status === 'MAINTENANCE' ? 'bg-amber-100 text-amber-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>
                                                {room.status.slice(0, 3)}
                                            </span>
                                        </div>
                                    </td>
                                    {/* Date cells */}
                                    {dates.map((date) => {
                                        const { status, booking, block } = getCellStatus(room, date);
                                        const dateKey = formatDateKey(date);
                                        const isHovered = hoveredCell?.roomId === room.id && hoveredCell?.date === dateKey;

                                        return (
                                            <td
                                                key={dateKey}
                                                className={`border-b border-r border-slate-100 p-0 relative ${getCellColor(status)}`}
                                                onMouseEnter={() => setHoveredCell({ roomId: room.id, date: dateKey })}
                                                onMouseLeave={() => setHoveredCell(null)}
                                            >
                                                <div className="h-8 flex items-center justify-center text-xs font-medium text-slate-600">
                                                    {getCellIcon(status)}
                                                </div>

                                                {/* Tooltip */}
                                                {isHovered && (booking || block) && (
                                                    <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-1 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                                                        {booking && (
                                                            <div>
                                                                <div className="font-medium">{booking.guestName}</div>
                                                                <div className="text-slate-300 text-[10px]">
                                                                    {booking.checkIn} → {booking.checkOut}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {block && (
                                                            <div>
                                                                <div className="font-medium">Blocked</div>
                                                                <div className="text-slate-300 text-[10px] mb-2">{block.reason}</div>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        unblockRoom(block.id);
                                                                    }}
                                                                    disabled={unblocking === block.id}
                                                                    className="w-full px-2 py-1 text-[10px] font-medium bg-red-500 hover:bg-red-600 text-white rounded transition-colors disabled:opacity-50"
                                                                >
                                                                    {unblocking === block.id ? 'Unblocking...' : 'Unblock'}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Quick Block Form */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Quick Block Dates</h4>
                <form onSubmit={submitBlock} className="grid md:grid-cols-5 gap-3">
                    <select
                        value={form.roomId}
                        onChange={(e) => setForm({ ...form, roomId: e.target.value })}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 bg-white"
                        required
                    >
                        <option value="">Select Room</option>
                        {sortedRooms.map((r) => (
                            <option key={r.id} value={r.id}>
                                Room {r.roomNumber}
                            </option>
                        ))}
                    </select>
                    <input
                        type="date"
                        value={form.start}
                        onChange={(e) => setForm({ ...form, start: e.target.value })}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 bg-white"
                        required
                    />
                    <input
                        type="date"
                        value={form.end}
                        onChange={(e) => setForm({ ...form, end: e.target.value })}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 bg-white"
                        required
                    />
                    <input
                        type="text"
                        placeholder="Reason (optional)"
                        value={form.reason}
                        onChange={(e) => setForm({ ...form, reason: e.target.value })}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 bg-white"
                    />
                    <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-teal-500 rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50">
                        {submitting ? 'Blocking...' : 'Block'}
                    </button>
                </form>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-4 gap-3">
                <div className="bg-white rounded-xl p-4 text-center border border-slate-200/60 shadow-sm">
                    <div className="text-2xl font-bold text-slate-800">{rooms.length}</div>
                    <div className="text-xs text-slate-500">Total Rooms</div>
                </div>
                <div className="bg-white rounded-xl p-4 text-center border border-slate-200/60 shadow-sm">
                    <div className="text-2xl font-bold text-emerald-600">
                        {rooms.filter(r => r.status === 'AVAILABLE').length}
                    </div>
                    <div className="text-xs text-slate-500">Available Today</div>
                </div>
                <div className="bg-white rounded-xl p-4 text-center border border-slate-200/60 shadow-sm">
                    <div className="text-2xl font-bold text-blue-600">
                        {rooms.filter(r => r.status === 'OCCUPIED').length}
                    </div>
                    <div className="text-xs text-slate-500">Occupied</div>
                </div>
                <div className="bg-white rounded-xl p-4 text-center border border-slate-200/60 shadow-sm">
                    <div className="text-2xl font-bold text-red-600">{blocks.length}</div>
                    <div className="text-xs text-slate-500">Active Blocks</div>
                </div>
            </div>

            {/* Active Blocks List */}
            {blocks.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                        <h4 className="text-sm font-semibold text-slate-700">Active Blocks</h4>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {blocks.map((block) => {
                            const room = rooms.find(r => r.id === block.roomId);
                            return (
                                <div key={block.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                                            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                            </svg>
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-slate-800">
                                                Room {room?.roomNumber || 'Unknown'}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {new Date(block.startDate).toLocaleDateString()} - {new Date(block.endDate).toLocaleDateString()}
                                            </div>
                                        </div>
                                        {block.reason && (
                                            <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-lg">
                                                {block.reason}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => unblockRoom(block.id)}
                                        disabled={unblocking === block.id}
                                        className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                                    >
                                        {unblocking === block.id ? 'Removing...' : 'Unblock'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
