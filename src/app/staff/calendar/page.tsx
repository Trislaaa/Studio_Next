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

export default function StaffCalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [rooms, setRooms] = useState<Room[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [loading, setLoading] = useState(true);
    const [hoveredCell, setHoveredCell] = useState<{ roomId: string; date: string } | null>(null);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthName = currentDate.toLocaleString('default', { month: 'long' });

    const dates = useMemo(() => {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const result: Date[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
            result.push(new Date(year, month, d));
        }
        return result;
    }, [year, month]);

    const today = useMemo(() => {
        const t = new Date();
        t.setHours(0, 0, 0, 0);
        return t;
    }, []);

    const formatDateKey = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const startOfMonth = new Date(year, month, 1).toISOString().split('T')[0];
            const endOfMonth = new Date(year, month + 1, 0).toISOString().split('T')[0];

            const [roomsRes, bookingsRes, blocksRes] = await Promise.all([
                fetch('/api/admin/rooms'),
                fetch('/api/admin/bookings'),
                fetch(`/api/admin/room-blocks?start=${startOfMonth}&end=${endOfMonth}`),
            ]);

            if (roomsRes.ok) {
                const data = await roomsRes.json();
                setRooms(data.rooms || []);
            }
            if (bookingsRes.ok) {
                const data = await bookingsRes.json();
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

    useEffect(() => { fetchData(); }, [year, month]);

    const getCellStatus = (room: Room, date: Date): { status: CellStatus; booking?: Booking; block?: Block } => {
        const dateKey = formatDateKey(date);
        const dateObj = new Date(dateKey);

        if (dateObj < today) {
            const booking = bookings.find(b => {
                const ci = new Date(b.checkIn);
                const co = new Date(b.checkOut);
                return b.roomId === room.id && dateObj >= ci && dateObj < co;
            });
            return booking ? { status: 'past', booking } : { status: 'past' };
        }

        const block = blocks.find(b => {
            const start = new Date(b.startDate);
            const end = new Date(b.endDate);
            return b.roomId === room.id && dateObj >= start && dateObj <= end;
        });
        if (block) return { status: 'blocked', block };

        const booking = bookings.find(b => {
            if (b.roomId !== room.id || b.status === 'CANCELLED') return false;
            const ci = new Date(b.checkIn);
            const co = new Date(b.checkOut);
            return dateObj >= ci && dateObj < co;
        });

        if (booking) {
            const ci = new Date(booking.checkIn);
            const co = new Date(booking.checkOut);
            if (formatDateKey(ci) === dateKey) return { status: 'checkin', booking };
            if (formatDateKey(co) === dateKey) return { status: 'checkout', booking };
            return { status: 'booked', booking };
        }

        if (room.status === 'MAINTENANCE') return { status: 'maintenance' };
        return { status: 'available' };
    };

    const getCellColor = (status: CellStatus) => {
        switch (status) {
            case 'available': return 'bg-emerald-50 hover:bg-emerald-100 border-emerald-100 cursor-default';
            case 'booked': return 'bg-blue-100 border-blue-200 cursor-default';
            case 'checkin': return 'bg-teal-400 border-teal-500 cursor-default';
            case 'checkout': return 'bg-orange-300 border-orange-400 cursor-default';
            case 'blocked': return 'bg-red-100 border-red-200 cursor-default';
            case 'maintenance': return 'bg-amber-100 border-amber-200 cursor-default';
            case 'past': return 'bg-slate-50 border-slate-100 opacity-60 cursor-default';
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

    const sortedRooms = useMemo(() => {
        return [...rooms].sort((a, b) => {
            const aHasLetter = /^[A-Za-z]/.test(a.roomNumber);
            const bHasLetter = /^[A-Za-z]/.test(b.roomNumber);
            if (aHasLetter && !bHasLetter) return -1;
            if (!aHasLetter && bHasLetter) return 1;
            return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: 'base' });
        });
    }, [rooms]);

    // Compute today's stats
    const todayKey = formatDateKey(today);
    const todayCheckIns = bookings.filter(b => formatDateKey(new Date(b.checkIn)) === todayKey && b.status !== 'CANCELLED').length;
    const todayCheckOuts = bookings.filter(b => formatDateKey(new Date(b.checkOut)) === todayKey && b.status !== 'CANCELLED').length;
    const availableRooms = rooms.filter(r => r.status === 'AVAILABLE').length;
    const occupiedRooms = rooms.filter(r => r.status === 'OCCUPIED').length;

    return (
        <div className="space-y-5">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Occupancy Calendar</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Room availability view for {monthName} {year}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                        className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
                    >
                        ← Prev
                    </button>
                    <button
                        onClick={() => setCurrentDate(new Date())}
                        className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
                    >
                        Today
                    </button>
                    <button
                        onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                        className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
                    >
                        Next →
                    </button>
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors disabled:opacity-50"
                        title="Refresh"
                    >
                        <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Today Quick Stats */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: "Today's Check-ins", value: todayCheckIns, color: 'text-teal-600', bg: 'bg-teal-50 border-teal-100' },
                    { label: "Today's Check-outs", value: todayCheckOuts, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100' },
                    { label: 'Available Rooms', value: availableRooms, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
                    { label: 'Occupied Rooms', value: occupiedRooms, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
                ].map(stat => (
                    <div key={stat.label} className={`bg-white rounded-xl p-4 border ${stat.bg} shadow-sm`}>
                        <p className={`text-2xl font-bold ${stat.color} tracking-tight`}>
                            {loading ? <span className="inline-block w-8 h-7 bg-slate-100 rounded animate-pulse" /> : stat.value}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 font-medium">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="bg-white rounded-xl border border-slate-200/60 px-4 py-3 shadow-sm">
                <div className="flex flex-wrap gap-4 text-xs">
                    {[
                        { label: 'Available', bg: 'bg-emerald-50 border-emerald-100' },
                        { label: 'Booked', bg: 'bg-blue-100 border-blue-200' },
                        { label: 'Check-in', bg: 'bg-teal-400 border-teal-500' },
                        { label: 'Check-out', bg: 'bg-orange-300 border-orange-400' },
                        { label: 'Blocked', bg: 'bg-red-100 border-red-200' },
                        { label: 'Maintenance', bg: 'bg-amber-100 border-amber-200' },
                        { label: 'Past', bg: 'bg-slate-50 border-slate-100 opacity-60' },
                    ].map(item => (
                        <div key={item.label} className="flex items-center gap-1.5">
                            <div className={`w-4 h-4 rounded border ${item.bg}`} />
                            <span className="text-slate-600">{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Calendar Grid */}
            {loading ? (
                <div className="bg-white rounded-xl border border-slate-200 p-16 flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full border-4 border-slate-200" />
                        <div className="absolute top-0 left-0 w-10 h-10 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
                    </div>
                    <p className="text-sm text-slate-500">Loading calendar...</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse min-w-max">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="sticky left-0 z-10 bg-slate-100 border-b border-r border-slate-200 px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide min-w-[130px]">
                                        Room
                                    </th>
                                    {dates.map((date) => {
                                        const isToday = formatDateKey(date) === formatDateKey(today);
                                        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                        return (
                                            <th
                                                key={formatDateKey(date)}
                                                className={`border-b border-r border-slate-200 px-1 py-2 text-center min-w-[40px] ${
                                                    isToday ? 'bg-teal-600 text-white' : isWeekend ? 'bg-slate-100' : 'bg-slate-50'
                                                }`}
                                            >
                                                <div className={`text-[10px] font-medium ${isToday ? 'text-teal-100' : 'text-slate-400'}`}>{dayName}</div>
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
                                        <td className="sticky left-0 z-10 bg-white border-b border-r border-slate-100 px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-800">{room.roomNumber}</div>
                                                    <div className="text-[10px] text-slate-500">{getRoomTypeLabel(room.type)}</div>
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
                                                    <div className="h-8 flex items-center justify-center text-xs font-bold text-white/90">
                                                        {getCellIcon(status)}
                                                    </div>
                                                    {/* Tooltip */}
                                                    {isHovered && (booking || block) && (
                                                        <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-slate-900 text-white text-xs rounded-xl px-3 py-2.5 whitespace-nowrap shadow-xl border border-white/10 pointer-events-none">
                                                            {booking && (
                                                                <div>
                                                                    <div className="font-semibold">{booking.guestName}</div>
                                                                    <div className="text-slate-300 text-[10px] mt-0.5">
                                                                        {new Date(booking.checkIn).toLocaleDateString()} → {new Date(booking.checkOut).toLocaleDateString()}
                                                                    </div>
                                                                    <div className={`text-[10px] mt-1 font-medium ${
                                                                        status === 'checkin' ? 'text-teal-300' :
                                                                        status === 'checkout' ? 'text-orange-300' :
                                                                        'text-blue-300'
                                                                    }`}>
                                                                        {status === 'checkin' ? '→ Check-in today' : status === 'checkout' ? '← Check-out today' : 'Occupied'}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {block && (
                                                                <div>
                                                                    <div className="font-semibold text-red-300">Blocked</div>
                                                                    <div className="text-slate-300 text-[10px] mt-0.5">{block.reason}</div>
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
            )}

            {/* Info note for staff */}
            <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500">
                <svg className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>This is a read-only view. To block/unblock dates, please contact an administrator.</span>
            </div>
        </div>
    );
}
