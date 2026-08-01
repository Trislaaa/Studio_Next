'use client';

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

interface GuestDetailsDrawerProps {
    guest: Guest;
    onClose: () => void;
}

export default function GuestDetailsDrawer({ guest, onClose }: GuestDetailsDrawerProps) {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'VIP':
                return 'bg-yellow-100 text-yellow-700';
            case 'Regular':
                return 'bg-blue-100 text-blue-700';
            case 'New':
                return 'bg-green-100 text-green-700';
            default:
                return 'bg-neutral-100 text-neutral-700';
        }
    };

    const getBookingStatusColor = (status: string) => {
        switch (status) {
            case 'CONFIRMED':
                return 'bg-green-100 text-green-700';
            case 'CHECKED_IN':
                return 'bg-blue-100 text-blue-700';
            case 'CHECKED_OUT':
            case 'COMPLETED':
                return 'bg-neutral-100 text-neutral-700';
            case 'CANCELLED':
                return 'bg-red-100 text-red-700';
            case 'PENDING':
                return 'bg-yellow-100 text-yellow-700';
            default:
                return 'bg-neutral-100 text-neutral-700';
        }
    };

    const getRoomTypeLabel = (type: string) => {
        switch (type) {
            case 'DELUXE':
                return 'Deluxe';
            case 'SUITE':
                return 'Suite';
            case 'FAMILY':
                return 'Family';
            case 'STANDARD':
                return 'Standard';
            default:
                return type;
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/30 transition-opacity"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="absolute inset-y-0 right-0 w-full max-w-lg bg-white shadow-xl flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center text-xl">
                            {guest.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-neutral-900">
                                {guest.fullName}
                            </h2>
                            <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                                    guest.status
                                )}`}
                            >
                                {guest.status}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                    >
                        <svg
                            className="w-5 h-5 text-neutral-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Contact Info */}
                    <div>
                        <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wider mb-3">
                            Contact Information
                        </h3>
                        <div className="bg-neutral-50 rounded-lg p-4 space-y-3">
                            <div className="flex items-center gap-3">
                                <span className="text-lg">📧</span>
                                <div>
                                    <p className="text-xs text-neutral-500">Email</p>
                                    <p className="text-sm font-medium text-neutral-900">
                                        {guest.email}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-lg">📱</span>
                                <div>
                                    <p className="text-xs text-neutral-500">Phone</p>
                                    <p className="text-sm font-medium text-neutral-900">
                                        {guest.phone}
                                    </p>
                                </div>
                            </div>
                            {guest.address && (
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">📍</span>
                                    <div>
                                        <p className="text-xs text-neutral-500">Address</p>
                                        <p className="text-sm font-medium text-neutral-900">
                                            {[
                                                guest.address.street,
                                                guest.address.city,
                                                guest.address.state,
                                                guest.address.country,
                                                guest.address.zip,
                                            ]
                                                .filter(Boolean)
                                                .join(', ')}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ID Proof */}
                    {guest.idProof && (
                        <div>
                            <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wider mb-3">
                                ID Proof
                            </h3>
                            <div className="bg-neutral-50 rounded-lg p-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">🪪</span>
                                    <div>
                                        <p className="text-xs text-neutral-500">
                                            {guest.idProof.type || 'ID'}
                                        </p>
                                        <p className="text-sm font-medium text-neutral-900">
                                            {guest.idProof.number}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Stats */}
                    <div>
                        <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wider mb-3">
                            Summary
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-neutral-50 rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold text-neutral-900">
                                    {guest.totalBookings}
                                </p>
                                <p className="text-xs text-neutral-500">Total Bookings</p>
                            </div>
                            <div className="bg-neutral-50 rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold text-green-600">
                                    {guest.completedBookings}
                                </p>
                                <p className="text-xs text-neutral-500">Completed</p>
                            </div>
                            <div className="bg-neutral-50 rounded-lg p-3 text-center">
                                <p className="text-lg font-bold text-neutral-900">
                                    ₹{guest.totalSpend.toLocaleString('en-IN')}
                                </p>
                                <p className="text-xs text-neutral-500">Total Spend</p>
                            </div>
                        </div>
                    </div>

                    {/* Booking History */}
                    <div>
                        <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wider mb-3">
                            Booking History
                        </h3>
                        {guest.bookings.length === 0 ? (
                            <div className="bg-neutral-50 rounded-lg p-6 text-center">
                                <p className="text-neutral-500">No bookings yet</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {guest.bookings.map((booking) => (
                                    <div
                                        key={booking.id}
                                        className="bg-neutral-50 rounded-lg p-4"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-neutral-900">
                                                    Room {booking.roomNumber}
                                                </span>
                                                <span className="text-xs text-neutral-500">
                                                    ({getRoomTypeLabel(booking.roomType)})
                                                </span>
                                            </div>
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${getBookingStatusColor(
                                                    booking.status
                                                )}`}
                                            >
                                                {booking.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-neutral-600">
                                                {new Date(booking.checkIn).toLocaleDateString(
                                                    'en-IN',
                                                    { day: 'numeric', month: 'short' }
                                                )}{' '}
                                                →{' '}
                                                {new Date(booking.checkOut).toLocaleDateString(
                                                    'en-IN',
                                                    { day: 'numeric', month: 'short', year: 'numeric' }
                                                )}
                                            </span>
                                            <span className="font-semibold text-neutral-900">
                                                ₹{booking.totalAmount.toLocaleString('en-IN')}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Member Since */}
                    <div className="text-center pt-4 border-t border-neutral-200">
                        <p className="text-xs text-neutral-500">
                            Guest since{' '}
                            {new Date(guest.createdAt).toLocaleDateString('en-IN', {
                                month: 'long',
                                year: 'numeric',
                            })}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
