'use client';

import { useEffect, useState } from 'react';

interface Room {
    id: string;
    roomNumber: string;
    type: string;
    floor: number;
    status: string;
    currentGuest?: string;
}

export default function StaffRoomsPage() {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterFloor, setFilterFloor] = useState<number | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('all');

    useEffect(() => {
        fetchRooms();
    }, []);

    const fetchRooms = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/rooms');
            const data = await response.json();

            if (data.rooms) {
                setRooms(data.rooms || []);
            }
        } catch (err) {
            console.error('Failed to fetch rooms:', err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            AVAILABLE: 'bg-green-100 border-green-300 text-green-800',
            OCCUPIED: 'bg-blue-100 border-blue-300 text-blue-800',
            CLEANING: 'bg-amber-100 border-amber-300 text-amber-800',
            MAINTENANCE: 'bg-red-100 border-red-300 text-red-800',
            OUT_OF_ORDER: 'bg-gray-100 border-gray-300 text-gray-800',
        };
        return colors[status] || 'bg-gray-100 border-gray-300 text-gray-800';
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'AVAILABLE':
                return '✓';
            case 'OCCUPIED':
                return '👤';
            case 'CLEANING':
                return '🧹';
            case 'MAINTENANCE':
                return '🔧';
            default:
                return '⚠';
        }
    };

    const floors = [...new Set(rooms.map((r) => r.floor).filter(Boolean))].sort((a, b) => (a || 0) - (b || 0));

    const filteredRooms = rooms.filter((room) => {
        if (filterFloor !== null && room.floor !== filterFloor) return false;
        if (filterStatus !== 'all' && room.status !== filterStatus) return false;
        return true;
    });

    const statusCounts = {
        AVAILABLE: rooms.filter((r) => r.status === 'AVAILABLE').length,
        OCCUPIED: rooms.filter((r) => r.status === 'OCCUPIED').length,
        CLEANING: rooms.filter((r) => r.status === 'CLEANING').length,
        MAINTENANCE: rooms.filter((r) => r.status === 'MAINTENANCE').length,
    };

    return (
        <div className="space-y-6">
            {/* Status Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                    onClick={() => setFilterStatus(filterStatus === 'AVAILABLE' ? 'all' : 'AVAILABLE')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                        filterStatus === 'AVAILABLE' ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-white'
                    }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">✓</span>
                        <span className="text-2xl font-bold text-green-600">{statusCounts.AVAILABLE}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-900">Available</p>
                </button>

                <button
                    onClick={() => setFilterStatus(filterStatus === 'OCCUPIED' ? 'all' : 'OCCUPIED')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                        filterStatus === 'OCCUPIED' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'
                    }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">👤</span>
                        <span className="text-2xl font-bold text-blue-600">{statusCounts.OCCUPIED}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-900">Occupied</p>
                </button>

                <button
                    onClick={() => setFilterStatus(filterStatus === 'CLEANING' ? 'all' : 'CLEANING')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                        filterStatus === 'CLEANING' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white'
                    }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">🧹</span>
                        <span className="text-2xl font-bold text-amber-600">{statusCounts.CLEANING}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-900">Cleaning</p>
                </button>

                <button
                    onClick={() => setFilterStatus(filterStatus === 'MAINTENANCE' ? 'all' : 'MAINTENANCE')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                        filterStatus === 'MAINTENANCE' ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-white'
                    }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">🔧</span>
                        <span className="text-2xl font-bold text-red-600">{statusCounts.MAINTENANCE}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-900">Maintenance</p>
                </button>
            </div>

            {/* Floor Filter */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-600">Floor:</span>
                    <button
                        onClick={() => setFilterFloor(null)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            filterFloor === null
                                ? 'bg-teal-600 text-white'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        All Floors
                    </button>
                    {floors.map((floor) => (
                        <button
                            key={floor}
                            onClick={() => setFilterFloor(filterFloor === floor ? null : floor)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                filterFloor === floor
                                    ? 'bg-teal-600 text-white'
                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            Floor {floor}
                        </button>
                    ))}
                </div>
            </div>

            {/* Rooms Grid */}
            {loading ? (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                    <div className="inline-block w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-4 text-slate-600">Loading rooms...</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {filteredRooms.map((room) => (
                        <div
                            key={room.id}
                            className={`p-4 rounded-xl border-2 ${getStatusColor(room.status)} transition-all hover:shadow-md`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-lg font-bold">{room.roomNumber}</span>
                                <span className="text-xl">{getStatusIcon(room.status)}</span>
                            </div>
                            <p className="text-sm font-medium">{room.type}</p>
                            <p className="text-xs opacity-75">Floor {room.floor || '-'}</p>
                        </div>
                    ))}
                </div>
            )}

            {!loading && filteredRooms.length === 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No rooms found</h3>
                    <p className="text-slate-600">No rooms match your current filters.</p>
                </div>
            )}
        </div>
    );
}
