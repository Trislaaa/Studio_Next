'use client';

interface BookingSummaryProps {
    room?: {
        type: string;
        roomNumber: string;
        baseRate: number;
    };
    checkIn?: Date;
    checkOut?: Date;
    addons?: Array<{
        id: string;
        name: string;
        price: number;
        quantity: number;
    }>;
    taxRate?: number;
}

export function BookingSummary({
    room,
    checkIn,
    checkOut,
    addons = [],
    taxRate = 12,
}: BookingSummaryProps) {
    if (!room || !checkIn || !checkOut) {
        return (
            <div className="glass p-6 rounded-2xl">
                <h3 className="text-lg font-semibold mb-4">Booking Summary</h3>
                <p className="text-neutral-600 text-sm text-center py-8">
                    Select dates and room to see pricing
                </p>
            </div>
        );
    }

    const nights = Math.ceil(
        (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
    );
    const roomTotal = room.baseRate * nights;
    const addonsTotal = addons.reduce((sum, addon) => sum + addon.price * addon.quantity, 0);
    const subtotal = roomTotal + addonsTotal;
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;

    return (
        <div className="glass p-6 rounded-2xl sticky top-6">
            <h3 className="text-xl font-display font-semibold mb-6 pb-3 border-b border-neutral-200">
                Booking Summary
            </h3>

            {/* Room Details */}
            <div className="mb-6">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <p className="font-semibold text-neutral-900">{room.type}</p>
                        <p className="text-sm text-neutral-600">Room {room.roomNumber}</p>
                    </div>
                    <span className="text-brand-primary font-semibold">
                        ₹{room.baseRate.toLocaleString('en-IN')}
                    </span>
                </div>
            </div>

            {/* Dates */}
            <div className="mb-6 pb-6 border-b border-neutral-200">
                <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1">
                        <p className="text-xs text-neutral-500 mb-1">Check-in</p>
                        <p className="text-sm font-medium">
                            {checkIn.toLocaleDateString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                            })}
                        </p>
                    </div>
                    <div className="text-neutral-400">→</div>
                    <div className="flex-1">
                        <p className="text-xs text-neutral-500 mb-1">Check-out</p>
                        <p className="text-sm font-medium">
                            {checkOut.toLocaleDateString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                            })}
                        </p>
                    </div>
                </div>
                <p className="text-sm text-neutral-600">
                    {nights} night{nights > 1 ? 's' : ''}
                </p>
            </div>

            {/* Price Breakdown */}
            <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                    <span className="text-neutral-600">
                        Room ({nights} × ₹{room.baseRate.toLocaleString('en-IN')})
                    </span>
                    <span className="font-medium">₹{roomTotal.toLocaleString('en-IN')}</span>
                </div>

                {addons.length > 0 && (
                    <>
                        {addons.map((addon) => (
                            <div key={addon.id} className="flex justify-between text-sm">
                                <span className="text-neutral-600">
                                    {addon.name} {addon.quantity > 1 && `(× ${addon.quantity})`}
                                </span>
                                <span className="font-medium">
                                    ₹{(addon.price * addon.quantity).toLocaleString('en-IN')}
                                </span>
                            </div>
                        ))}
                    </>
                )}

                <div className="flex justify-between text-sm pt-3 border-t border-neutral-200">
                    <span className="text-neutral-600">Subtotal</span>
                    <span className="font-medium">₹{subtotal.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-neutral-600">Taxes ({taxRate}% GST)</span>
                    <span className="font-medium">₹{tax.toLocaleString('en-IN')}</span>
                </div>
            </div>

            {/* Total */}
            <div className="pt-6 border-t-2 border-neutral-300">
                <div className="flex justify-between items-baseline mb-6">
                    <span className="text-lg font-semibold text-neutral-900">Total Amount</span>
                    <span className="text-3xl font-bold gradient-gold bg-clip-text text-transparent">
                        ₹{total.toLocaleString('en-IN')}
                    </span>
                </div>

                {room && checkIn && checkOut ? (
                    <a
                        href={`/book/guest-details?roomId=${encodeURIComponent('temp')}&checkIn=${checkIn.toISOString()}&checkOut=${checkOut.toISOString()}`}
                        className="w-full btn-primary block text-center"
                    >
                        Continue to Guest Details →
                    </a>
                ) : (
                    <button className="w-full btn-primary" disabled>
                        Select Room to Continue
                    </button>
                )}
            </div>

            {/* Policies */}
            <div className="mt-6 pt-6 border-t border-neutral-200">
                <p className="text-xs text-neutral-500">
                    ✓ 95% refund up to 48 hours before check-in (5% platform fee)<br />
                    ✓ 50% refund between 24 and 48 hours before check-in<br />
                    ✓ No refund within 24 hours of check-in<br />
                    ✓ Complimentary breakfast included<br />
                    ✓ Late checkout available
                </p>
            </div>
        </div>
    );
}
