'use client';

import { useState, useEffect } from 'react';
import RoomFormModal from '@/components/admin/RoomFormModal';

interface Room {
    id: string;
    roomNumber: string;
    type: string;
    baseOccupancy: number;
    maxOccupancy: number;
    extraGuestCharge: number | null;
    status: string;
    baseRate: number;
    amenities: string[];
    images: string[];
    description: string;
    floor: number | null;
    size: number;
}

export default function RoomsManagementPage() {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

    // Fetch rooms from API
    const fetchRooms = async () => {
        setLoading(true);
        try {
            const url = filter === 'all'
                ? '/api/admin/rooms'
                : `/api/admin/rooms?status=${filter}`;

            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch rooms');

            const data = await response.json();
            setRooms(data.rooms);
        } catch (error) {
            console.error('Error fetching rooms:', error);
            alert('Failed to load rooms');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRooms();
    }, [filter]);

    const handleCreateRoom = async (formData: any) => {
        try {
            const response = await fetch('/api/admin/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                let message = 'Failed to create room';
                try {
                    const error = await response.json();
                    if (error?.details?.length) {
                        // Show the first validation issue message
                        message = `Validation failed: ${error.details[0]?.message ?? error.error}`;
                    } else if (error?.error) {
                        message = error.error;
                    }
                } catch (_) { /* ignore JSON parse errors */ }
                throw new Error(message);
            }

            await fetchRooms();
            alert('Room created successfully!');
        } catch (error) {
            console.error('Error creating room:', error);
            alert(error instanceof Error ? error.message : 'Failed to create room');
            throw error;
        }
    };

    const handleEditRoom = async (formData: any) => {
        if (!selectedRoom) return;

        try {
            const response = await fetch(`/api/admin/rooms/${selectedRoom.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update room');
            }

            await fetchRooms();
            alert('Room updated successfully!');
        } catch (error) {
            console.error('Error updating room:', error);
            alert(error instanceof Error ? error.message : 'Failed to update room');
            throw error;
        }
    };

    const handleDeleteRoom = async (roomId: string, roomNumber: string) => {
        if (!confirm(`Are you sure you want to delete Room ${roomNumber}?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/rooms/${roomId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete room');
            }

            await fetchRooms();
            alert('Room deleted successfully!');
        } catch (error) {
            console.error('Error deleting room:', error);
            alert(error instanceof Error ? error.message : 'Failed to delete room');
        }
    };

    const handleStatusChange = async (roomId: string, newStatus: string) => {
        try {
            const response = await fetch(`/api/admin/rooms/${roomId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });

            if (!response.ok) {
                throw new Error('Failed to update status');
            }

            // Optimistically update UI
            setRooms(rooms.map(room =>
                room.id === roomId ? { ...room, status: newStatus } : room
            ));
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Failed to update room status');
            await fetchRooms(); // Refresh on error
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'AVAILABLE':
                return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
            case 'OCCUPIED':
                return 'bg-blue-100 text-blue-700 border border-blue-200';
            case 'CLEANING':
                return 'bg-amber-100 text-amber-700 border border-amber-200';
            case 'MAINTENANCE':
                return 'bg-orange-100 text-orange-700 border border-orange-200';
            default:
                return 'bg-slate-100 text-slate-600 border border-slate-200';
        }
    };

    const getRoomTypeLabel = (type: string) => {
        return type.charAt(0) + type.slice(1).toLowerCase();
    };

    const filteredRooms = filter === 'all'
        ? rooms
        : rooms.filter(room => room.status === filter);

    const statusCounts = {
        all: rooms.length,
        AVAILABLE: rooms.filter(r => r.status === 'AVAILABLE').length,
        OCCUPIED: rooms.filter(r => r.status === 'OCCUPIED').length,
        CLEANING: rooms.filter(r => r.status === 'CLEANING').length,
        MAINTENANCE: rooms.filter(r => r.status === 'MAINTENANCE').length,
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
                        <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-teal-500 border-t-transparent animate-spin"></div>
                    </div>
                    <p className="text-sm text-slate-500">Loading rooms...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <p className="text-slate-500">Manage room status and availability</p>
                <button
                    onClick={() => {
                        setModalMode('create');
                        setSelectedRoom(null);
                        setModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-teal-500 to-emerald-500 rounded-lg hover:from-teal-600 hover:to-emerald-600 transition-all shadow-sm"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add New Room
                </button>
            </div>

            {/* Status Filter Tabs */}
            <div className="bg-white rounded-xl p-4 border border-slate-200/60 shadow-sm">
                <div className="flex flex-wrap gap-2">
                    {[
                        { key: 'all', label: 'All Rooms', count: statusCounts.all },
                        { key: 'AVAILABLE', label: 'Available', count: statusCounts.AVAILABLE },
                        { key: 'OCCUPIED', label: 'Occupied', count: statusCounts.OCCUPIED },
                        { key: 'CLEANING', label: 'Cleaning', count: statusCounts.CLEANING },
                        { key: 'MAINTENANCE', label: 'Maintenance', count: statusCounts.MAINTENANCE },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key)}
                            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${filter === tab.key
                                ? 'bg-teal-500 text-white shadow-sm'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                                }`}
                        >
                            {tab.label} <span className="ml-1 opacity-70">({tab.count})</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Rooms Table */}
            <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Room</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Floor</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Occupancy</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Rate</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredRooms.map((room) => (
                                <tr key={room.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-4">
                                        <span className="font-semibold text-slate-800">Room {room.roomNumber}</span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="text-slate-600">{getRoomTypeLabel(room.type)}</span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="text-slate-600">{room.floor ? `Floor ${room.floor}` : '-'}</span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="text-slate-600">{room.baseOccupancy}-{room.maxOccupancy} guests</span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="font-semibold text-slate-800">₹{room.baseRate.toLocaleString('en-IN')}</span>
                                        <span className="text-slate-400 text-sm">/night</span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <select
                                            value={room.status}
                                            onChange={(e) => handleStatusChange(room.id, e.target.value)}
                                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border focus:outline-none focus:ring-2 focus:ring-teal-100 transition-all ${getStatusColor(room.status)}`}
                                        >
                                            <option value="AVAILABLE">Available</option>
                                            <option value="OCCUPIED">Occupied</option>
                                            <option value="CLEANING">Cleaning</option>
                                            <option value="MAINTENANCE">Maintenance</option>
                                            <option value="OUT_OF_ORDER">Out of Order</option>
                                        </select>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => {
                                                    setModalMode('edit');
                                                    setSelectedRoom(room);
                                                    setModalOpen(true);
                                                }}
                                                className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteRoom(room.id, room.roomNumber)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {filteredRooms.length === 0 && (
                <div className="bg-white rounded-xl p-16 border border-slate-200/60 shadow-sm text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">
                        No rooms found
                    </h3>
                    <p className="text-slate-500 text-sm">
                        {rooms.length === 0
                            ? 'Click "Add New Room" to create your first room'
                            : 'No rooms match the selected filter'}
                    </p>
                </div>
            )}

            {/* Room Form Modal */}
            <RoomFormModal
                isOpen={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setSelectedRoom(null);
                }}
                onSubmit={modalMode === 'create' ? handleCreateRoom : handleEditRoom}
                initialData={selectedRoom ? {
                    roomNumber: selectedRoom.roomNumber,
                    type: selectedRoom.type as any,
                    baseOccupancy: selectedRoom.baseOccupancy || 2,
                    maxOccupancy: selectedRoom.maxOccupancy || 3,
                    extraGuestCharge: selectedRoom.extraGuestCharge || 0,
                    floor: selectedRoom.floor,
                    size: selectedRoom.size,
                    description: selectedRoom.description,
                    amenities: selectedRoom.amenities,
                    images: selectedRoom.images,
                    baseRate: selectedRoom.baseRate,
                } : undefined}
                mode={modalMode}
            />
        </div>
    );
}
