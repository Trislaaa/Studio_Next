'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

interface BookingAddon {
    id: string;
    name: string;
    quantity: number;
    price: number;
}

interface BookingTransaction {
    id: string;
    status: string;
    amount: number;
    currency: string;
    paymentGatewayId: string | null;
    paymentMethod: string | null;
    updatedAt: string;
}

interface BookingDetails {
    id: string;
    bookingReference: string;
    status: string;
    checkIn: string;
    checkOut: string;
    numberOfGuests: number;
    totalAmount: number;
    taxAmount: number;
    discountAmount: number;
    specialRequests: string | null;
    room: {
        id: string;
        number: string;
        type: string;
    };
    rooms: {
        id: string;
        number: string;
        type: string;
    }[];
    guest: {
        name: string;
        email: string;
        phone: string;
    };
    addons: BookingAddon[];
    transaction: BookingTransaction | null;
    createdAt: string;
}

function ConfirmationLoading() {
    return (
        <div className="min-h-screen bg-[#f6f3ee] flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#1e2f27] mx-auto mb-4"></div>
                <p className="text-[#4f5c55]">Loading confirmation...</p>
            </div>
        </div>
    );
}

function ConfirmationContent() {
    const searchParams = useSearchParams();
    const bookingRef = searchParams.get('bookingRef') ?? searchParams.get('ref');
    const [showCelebration, setShowCelebration] = useState(true);
    const [booking, setBooking] = useState<BookingDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => setShowCelebration(false), 2600);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const load = async () => {
            if (!bookingRef) return;
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/bookings/${bookingRef}`);
                if (!res.ok) {
                    const err = await res.json().catch(() => null);
                    throw new Error(err?.error || 'Could not fetch booking');
                }
                const data = await res.json();
                setBooking(data.booking);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Unable to load booking';
                setError(message);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [bookingRef]);

    if (!bookingRef) {
        return (
            <div className="min-h-screen bg-[#f6f3ee] flex items-center justify-center px-4">
                <div className="text-center bg-white border border-[#e7ddcf] rounded-3xl p-10 max-w-xl">
                    <h2 className="text-2xl md:text-3xl font-serif text-[#17261f] mb-4">
                        Invalid Booking Reference
                    </h2>
                    <p className="text-[#4f5c55] mb-6">
                        Please check your booking confirmation email.
                    </p>
                    <Link
                        href="/book"
                        className="inline-flex items-center rounded-full bg-[#17261f] text-white px-6 py-3 text-sm tracking-[0.14em] uppercase hover:bg-[#22352c] transition-colors"
                    >
                        Make New Booking
                    </Link>
                </div>
            </div>
        );
    }

    if (loading) {
        return <ConfirmationLoading />;
    }

    if (error || !booking) {
        return (
            <div className="min-h-screen bg-[#f6f3ee] flex items-center justify-center px-4">
                <div className="text-center bg-white border border-[#e7ddcf] rounded-3xl p-10 max-w-xl">
                    <h2 className="text-2xl md:text-3xl font-serif text-[#17261f] mb-4">Booking Not Found</h2>
                    <p className="text-[#4f5c55] mb-6">{error || 'Please verify your booking reference.'}</p>
                    <Link
                        href="/book"
                        className="inline-flex items-center rounded-full bg-[#17261f] text-white px-6 py-3 text-sm tracking-[0.14em] uppercase hover:bg-[#22352c] transition-colors"
                    >
                        Make New Booking
                    </Link>
                </div>
            </div>
        );
    }

    const formatDate = (value: string) =>
        new Date(value).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });

    return (
        <div className="min-h-screen bg-[#f6f3ee] print:bg-white print:min-h-0 **:print:[-webkit-print-color-adjust:exact] **:print:[print-color-adjust:exact]">
            <section className="bg-[radial-gradient(circle_at_top,rgba(32,58,44,0.2),rgba(246,243,238,0.88)_48%,#f6f3ee_100%)] border-b border-[#e7ddcf] print:bg-none print:border-none print:pt-0 print:pb-4">
                <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-10 pt-10 pb-10 md:pt-12 print:p-0">
                    <div className="flex flex-wrap items-center gap-3 mb-5 print:mb-2">
                        <span className="inline-flex items-center rounded-full border border-[#cfd8d3] bg-white/70 px-3 py-1 text-[11px] tracking-[0.18em] uppercase text-[#2d3b34]">
                            Booking Confirmed
                        </span>
                        <span className="print:hidden inline-flex items-center rounded-full border border-[#d8d2c5] bg-[#f2ece3] px-3 py-1 text-[11px] tracking-[0.16em] uppercase text-[#5d5040]">
                            Step 3 of 3
                        </span>
                    </div>

                    <h1 className="text-4xl md:text-5xl font-serif text-[#17261f] leading-tight print:text-3xl">
                        Your Stay Is Successfully Reserved
                    </h1>
                    <p className="print:hidden mt-4 max-w-3xl text-[#4f5c55] text-base md:text-lg leading-relaxed">
                        We have sent your confirmation details and booking reference. Keep this page for quick check-in assistance.
                    </p>

                    <div className="print:hidden mt-8 flex flex-wrap gap-3">
                        <Link
                            href="/"
                            className="inline-flex items-center rounded-full border border-[#17261f] bg-[#17261f] px-6 py-3 text-sm tracking-[0.14em] uppercase text-white hover:bg-[#22352c] transition-colors"
                        >
                            Return Home
                        </Link>
                        <button
                            onClick={() => window.print()}
                            className="inline-flex items-center rounded-full border border-[#cdbda7] bg-white px-6 py-3 text-sm tracking-[0.14em] uppercase text-[#5e4d36] hover:bg-[#fbf7f2] transition-colors"
                        >
                            Print Confirmation
                        </button>
                    </div>
                </div>
            </section>

            <main className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-10 py-10 md:py-14 print:py-4 print:px-0">
                <div className="grid lg:grid-cols-[1.45fr_1fr] gap-7 items-start print:grid-cols-1 print:gap-4">
                    <div className="bg-white border border-[#e7ddcf] rounded-3xl p-6 sm:p-8 shadow-[0_18px_50px_rgba(22,34,28,0.08)] print:shadow-none print:border-2 print:border-neutral-200 print:rounded-2xl print:p-6 print:break-inside-avoid">
                        <div className="relative overflow-hidden rounded-2xl border border-[#e1d8cb] bg-[linear-gradient(135deg,#1d3128,#314d40)] p-6 sm:p-8 mb-6 text-white">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(241,224,187,0.3),transparent_40%)]" />
                            <div className="relative z-10">
                                <div className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-[11px] tracking-[0.14em] uppercase mb-4">
                                    Booking Reference
                                </div>
                                <p className="text-3xl sm:text-4xl font-semibold tracking-wide">{booking.bookingReference}</p>
                                <p className="mt-3 text-sm text-white/85">
                                    Status: <span className="font-semibold">{booking.status}</span>
                                </p>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4 mb-6">
                            <div className="rounded-2xl border border-[#e7ddcf] bg-[#faf7f2] p-5">
                                <p className="text-xs tracking-[0.16em] uppercase text-[#7a6f5f] mb-2">Check-in</p>
                                <p className="text-lg font-semibold text-[#1d2c24]">{formatDate(booking.checkIn)}</p>
                            </div>
                            <div className="rounded-2xl border border-[#e7ddcf] bg-[#faf7f2] p-5">
                                <p className="text-xs tracking-[0.16em] uppercase text-[#7a6f5f] mb-2">Check-out</p>
                                <p className="text-lg font-semibold text-[#1d2c24]">{formatDate(booking.checkOut)}</p>
                            </div>
                            <div className="rounded-2xl border border-[#e7ddcf] bg-[#faf7f2] p-5">
                                <p className="text-xs tracking-[0.16em] uppercase text-[#7a6f5f] mb-2">Guests</p>
                                <p className="text-lg font-semibold text-[#1d2c24]">{booking.numberOfGuests}</p>
                            </div>
                            <div className="rounded-2xl border border-[#e7ddcf] bg-[#faf7f2] p-5">
                                <p className="text-xs tracking-[0.16em] uppercase text-[#7a6f5f] mb-2">Room{booking.rooms.length > 1 ? 's' : ''}</p>
                                {booking.rooms.length > 1 ? (
                                    <div className="space-y-1">
                                        {booking.rooms.map((r, i) => (
                                            <p key={r.id} className="text-base font-semibold text-[#1d2c24]">
                                                {r.number} · {r.type}
                                            </p>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-lg font-semibold text-[#1d2c24]">{booking.room.number} · {booking.room.type}</p>
                                )}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-[#e7ddcf] bg-[#f9f5ee] p-5 sm:p-6">
                            <h2 className="text-xl font-serif text-[#17261f] mb-3">Guest Details</h2>
                            <p className="text-[#3e4c45]">{booking.guest.name}</p>
                            <p className="text-[#617168] text-sm mt-1">{booking.guest.email}</p>
                            <p className="text-[#617168] text-sm">{booking.guest.phone}</p>
                            {booking.specialRequests ? (
                                <div className="mt-4 rounded-xl bg-white border border-[#e7ddcf] p-4">
                                    <p className="text-xs tracking-[0.12em] uppercase text-[#7a6f5f] mb-2">Special Request</p>
                                    <p className="text-sm text-[#3f4d45] leading-relaxed">{booking.specialRequests}</p>
                                </div>
                            ) : null}
                        </div>

                        <div className="mt-6 rounded-2xl border border-[#e7ddcf] bg-white p-5 sm:p-6">
                            <h3 className="text-lg font-serif text-[#17261f] mb-3">Selected Add-ons</h3>
                            {booking.addons.length > 0 ? (
                                <ul className="space-y-3">
                                    {booking.addons.map((addon) => (
                                        <li key={addon.id} className="flex items-center justify-between text-sm text-[#3f4d45]">
                                            <span>{addon.name} {addon.quantity > 1 ? `× ${addon.quantity}` : ''}</span>
                                            <span className="font-semibold text-[#17261f]">₹{(addon.price * addon.quantity).toLocaleString('en-IN')}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-[#67766e]">No add-ons selected.</p>
                            )}
                        </div>
                    </div>

                    <aside className="sticky top-24 space-y-4 print:static print:space-y-4 print:break-inside-avoid print:mt-4">
                        <div className="rounded-3xl border border-[#e7ddcf] bg-white p-6 shadow-[0_12px_36px_rgba(22,34,28,0.06)] print:border-2 print:border-neutral-200 print:shadow-none print:rounded-2xl">
                            <h2 className="text-xl font-serif text-[#17261f] mb-4">Payment Summary</h2>
                            <div className="space-y-2 text-sm text-[#4b5a52]">
                                {booking.discountAmount > 0 && (
                                    <>
                                        <div className="flex justify-between">
                                            <span>Subtotal</span>
                                            <span className="font-semibold text-[#17261f]">₹{(booking.totalAmount - booking.taxAmount + booking.discountAmount).toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="flex justify-between text-green-700">
                                            <span>Coupon Discount</span>
                                            <span className="font-semibold">-₹{booking.discountAmount.toLocaleString('en-IN')}</span>
                                        </div>
                                    </>
                                )}
                                <div className="flex justify-between">
                                    <span>Tax (GST)</span>
                                    <span>₹{booking.taxAmount.toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between pt-2 border-t border-[#e7ddcf] mt-2">
                                    <span className="font-semibold text-[#17261f]">Total Paid</span>
                                    <span className="font-semibold text-[#17261f]">₹{booking.totalAmount.toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                            {booking.transaction ? (
                                <div className="mt-4 rounded-2xl border border-[#deeadf] bg-[#f4fbf5] p-4 text-sm text-[#2c5a35] space-y-1">
                                    <p className="font-semibold">Payment {booking.transaction.status}</p>
                                    <p>Txn: {booking.transaction.paymentGatewayId || booking.transaction.id}</p>
                                    <p>
                                        Amount: ₹{booking.transaction.amount.toLocaleString('en-IN')} {booking.transaction.currency}
                                    </p>
                                    <p>Method: {booking.transaction.paymentMethod || 'ONLINE'}</p>
                                </div>
                            ) : (
                                <div className="mt-4 rounded-2xl border border-[#efe2cd] bg-[#fff8ee] p-4 text-sm text-[#7a5b2a]">
                                    Payment details are being processed.
                                </div>
                            )}
                        </div>

                        <div className="print:hidden rounded-3xl border border-[#e7ddcf] bg-white p-6 shadow-[0_10px_30px_rgba(22,34,28,0.05)]">
                            <h3 className="text-lg font-serif text-[#17261f]">Need Help?</h3>
                            <p className="text-sm text-[#5f6e65] mt-2">
                                Contact us anytime for itinerary changes and early check-in requests.
                            </p>
                            <Link
                                href={`/manage?reference=${encodeURIComponent(booking.bookingReference)}`}
                                className="mt-4 inline-flex items-center rounded-full border border-[#8a6540] bg-[#fff9f2] px-4 py-2 text-xs tracking-[0.12em] uppercase text-[#8a6540] hover:bg-[#fff3e6] transition-colors"
                            >
                                Manage / Cancel Booking
                            </Link>
                            <a
                                href="tel:8928584198"
                                className="mt-3 inline-flex items-center rounded-full border border-[#1f3128] px-4 py-2 text-xs tracking-[0.12em] uppercase text-[#1f3128] hover:bg-[#f4f8f5] transition-colors"
                            >
                                8928584198
                            </a>
                        </div>

                        <div className="print:hidden rounded-3xl border border-[#d6e0da] bg-[#edf4ef] p-6">
                            <p className="text-xs tracking-[0.16em] uppercase text-[#4d6557]">Celebration</p>
                            <div className="mt-2 text-3xl">
                                {showCelebration ? '✨🎉✨' : '✅'}
                            </div>
                            <p className="mt-2 text-sm text-[#4f5f56]">Thank you for booking with Studio next.</p>
                        </div>
                    </aside>
                </div>
            </main>
        </div>
    );
}

export default function ConfirmationPage() {
    return (
        <Suspense fallback={<ConfirmationLoading />}>
            <ConfirmationContent />
        </Suspense>
    );
}
