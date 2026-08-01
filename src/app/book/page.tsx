'use client';

import { useEffect, useState } from 'react';
import { DateRangePicker } from '@/components/DateRangePicker';
import { calculateBookingPriceBreakdown } from '@/lib/pricing';

interface FloorOption {
    floor: number | null;
    floorLabel: string;
    baseRate: number;
    weekendMultiplier: number;
    availableCount: number;
    totalCount: number;
    roomIds: string[];
}

interface RoomTypeGroup {
    type: string;
    typeLabel: string;
    description: string;
    minRate: number;
    maxRate: number;
    totalAvailable: number;
    totalRooms: number;
    baseOccupancy: number;
    maxOccupancy: number;
    extraGuestCharge: number | null;
    amenities: string[];
    images: string[];
    floorOptions: FloorOption[];
}

export default function BookPage() {
    const [checkIn, setCheckIn] = useState<Date | null>(null);
    const [checkOut, setCheckOut] = useState<Date | null>(null);
    const [guests, setGuests] = useState<number>(2);
    const [roomTypes, setRoomTypes] = useState<RoomTypeGroup[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Cart state
    const [cart, setCart] = useState<{roomId: string, roomType: string, typeLabel: string, floor: number | null, floorLabel: string, baseRate: number, weekendMultiplier: number, baseOccupancy: number, maxOccupancy: number, extraGuestChargePerNight: number}[]>([]);

    const handleDateChange = async (range: { checkIn: Date | null; checkOut: Date | null; guests: number }) => {
        setCheckIn(range.checkIn);
        setCheckOut(range.checkOut);
        setGuests(range.guests);

        if (range.checkIn && range.checkOut) {
            setLoading(true);
            setError(null);

            try {
                const url = `/api/rooms/available-by-type?checkIn=${encodeURIComponent(range.checkIn.toISOString())}&checkOut=${encodeURIComponent(range.checkOut.toISOString())}`;
                const response = await fetch(url);

                if (!response.ok) {
                    try {
                        const errJson = await response.json();
                        throw new Error(errJson?.error || 'Failed to fetch available rooms');
                    } catch (_) {
                        throw new Error('Failed to fetch available rooms');
                    }
                }

                const data = await response.json();
                setRoomTypes(data.data || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
                setRoomTypes([]);
            } finally {
                setLoading(false);
            }
        } else {
            setRoomTypes([]);
        }
    };

    // Realtime: subscribe to inventory updates and refetch if overlapping current selection
    useEffect(() => {
        let pusher: any;
        let channel: any;
        (async () => {
            try {
                const { default: Pusher } = await import('pusher-js');
                const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
                const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER as string | undefined;
                if (!key || !cluster) return;
                pusher = new Pusher(key as string, { cluster });
                channel = pusher.subscribe('inventory');
                channel.bind('update', (evt: { type: string; payload: any }) => {
                    if (!checkIn || !checkOut) return;
                    const s = evt.payload?.checkIn ?? evt.payload?.startDate;
                    const e = evt.payload?.checkOut ?? evt.payload?.endDate;
                    if (!s || !e) return;
                    const evStart = new Date(s);
                    const evEnd = new Date(e);
                    const overlaps = evStart < checkOut && evEnd > checkIn;
                    if (overlaps) {
                        handleDateChange({ checkIn, checkOut, guests });
                    }
                });
            } catch {
                // ignore when pusher not configured
            }
        })();
        return () => {
            try {
                if (channel) channel.unbind_all();
                if (pusher) pusher.unsubscribe('inventory');
            } catch {}
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [checkIn?.toISOString(), checkOut?.toISOString()]);

    const handleFloorSelect = (roomType: RoomTypeGroup, floorOption: FloorOption) => {
        if (checkIn && checkOut && floorOption.availableCount > 0) {
            // Find an available roomId that isn't already in the cart
            const availableRoomId = floorOption.roomIds.find(id => !cart.some(item => item.roomId === id));
            
            if (!availableRoomId) {
                alert('No more rooms of this type available on this floor.');
                return;
            }

            setCart(prev => [...prev, {
                roomId: availableRoomId,
                roomType: roomType.type,
                typeLabel: roomType.typeLabel,
                floor: floorOption.floor,
                floorLabel: floorOption.floorLabel,
                baseRate: floorOption.baseRate,
                weekendMultiplier: floorOption.weekendMultiplier ?? 1.2,
                baseOccupancy: roomType.baseOccupancy,
                maxOccupancy: roomType.maxOccupancy,
                extraGuestChargePerNight: roomType.extraGuestCharge ?? 0,
            }]);
        }
    };

    const removeFromCart = (roomId: string) => {
        setCart(prev => prev.filter(item => item.roomId !== roomId));
    };

    const proceedToCheckout = () => {
        if (cart.length === 0 || !checkIn || !checkOut) return;
        
        // Ensure total max occupancy is respected
        const totalMaxOccupancy = cart.reduce((sum, item) => {
            return sum + (item.maxOccupancy || item.baseOccupancy);
        }, 0);
        
        if (guests > totalMaxOccupancy) {
            alert(`The selected rooms can only accommodate up to ${totalMaxOccupancy} guests. Please add another room or reduce the guest count.`);
            return;
        }

        sessionStorage.setItem('bookingCart', JSON.stringify(cart));
        sessionStorage.setItem('bookingDates', JSON.stringify({ checkIn, checkOut, guests }));
        // Also stick to the URL query standard for backward compatibility (pick the first room as fallback for scripts reading query)
        const first = cart[0];
        window.location.href = `/book/guest-details?roomId=${first.roomId}&roomType=${first.roomType}&floor=${first.floor}&guests=${guests}&checkIn=${checkIn.toISOString()}&checkOut=${checkOut.toISOString()}`;
    };

    const nights = checkIn && checkOut
        ? Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    const cartPricing = cart.length > 0 && checkIn && checkOut ? calculateBookingPriceBreakdown({
        rooms: cart.map(item => ({
            roomId: item.roomId,
            baseRate: item.baseRate,
            weekendMultiplier: item.weekendMultiplier,
            baseOccupancy: item.baseOccupancy,
            extraGuestChargePerNight: item.extraGuestChargePerNight
        })),
        checkIn,
        checkOut,
        numberOfGuests: guests,
        addons: []
    }) : null;

    const totalAvailable = roomTypes.reduce((sum, rt) => sum + rt.totalAvailable, 0);

    return (
        <div className="min-h-screen bg-[#faf8f5] text-[#2c3532] font-sans">
            {/* Hero Section & Header */}
            <div className="relative min-h-105 sm:min-h-130 lg:min-h-137.5 flex flex-col overflow-hidden mb-12">
                <div className="absolute inset-0 z-0">
                    <img
                        src="https://res.cloudinary.com/dgzbvmxlv/image/upload/v1774294251/Screenshot_2026-03-24_at_12.33.28_AM_gwerxj.png"
                        alt="Studio next Booking Banner"
                        className="absolute inset-0 w-full h-full object-cover grayscale-[0.2]"
                    />
                    <div className="absolute inset-0 bg-linear-to-b from-[#1e2f27]/80 via-[#1e2f27]/40 to-transparent"></div>
                </div>

                {/* Header (Overlaid) */}
                <header className="relative z-10 w-full px-5 sm:px-8 lg:px-16 py-5 sm:py-8 flex justify-between items-center text-white">
                    <a href="/" className="flex items-center gap-3 sm:gap-4 group">
                        <div className="flex items-center justify-center transition-transform duration-500 group-hover:scale-105">
                            <img src="/logo.png" alt="Studio next Logo" className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-lg sm:text-xl md:text-2xl font-serif tracking-wide">Studio next</span>
                            <span className="text-[#d29d42] text-[7px] sm:text-[8px] tracking-[0.3em] font-medium uppercase mt-1">THE HEART OF THE HILLS</span>
                        </div>
                    </a>
                    <nav className="flex items-center gap-3 sm:gap-6">
                        <a href="/" className="hidden md:block text-white hover:text-[#d29d42] text-xs tracking-[0.2em] uppercase font-semibold transition-colors">
                            HOME
                        </a>
                        <a href="/#rooms" className="hidden md:block text-white hover:text-[#d29d42] text-xs tracking-[0.2em] uppercase font-semibold transition-colors">
                            ROOMS
                        </a>
                        <a href="/#contact" className="hidden sm:block px-4 sm:px-6 py-2.5 sm:py-3 bg-[#1e2f27] text-white rounded-sm text-[10px] tracking-[0.2em] uppercase font-bold hover:bg-[#2c4036] transition-colors border border-transparent hover:border-[#d29d42]/30">
                            CONTACT US
                        </a>
                        <a href="/" className="sm:hidden flex items-center justify-center w-9 h-9 rounded-full border border-white/30 text-white hover:bg-white/10 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </a>
                    </nav>
                </header>

                <div className="px-5 sm:px-8 text-center relative z-10 flex-1 flex flex-col items-center justify-center pt-6 pb-20 sm:pb-24 text-white">
                    <h4 className="text-[#d29d42] text-[10px] tracking-[0.3em] font-bold mb-3 sm:mb-4 uppercase">RESERVATIONS</h4>
                    <h1 className="text-3xl sm:text-5xl md:text-6xl font-serif mb-4 sm:mb-6 leading-tight">
                        Plan Your <span className="italic text-[#d29d42]">Escape</span>
                    </h1>
                    <p className="text-white/90 text-sm sm:text-base md:text-lg font-light max-w-xl mx-auto leading-relaxed">
                        Select your dates below to discover our exclusive rooms and suites for your serene retreat in Mahabaleshwar.
                    </p>
                </div>
            </div>

            {/* Main Content */}
            <main className="pb-16 sm:pb-24 w-full">
                <div className="w-full mx-auto px-4 sm:px-6 lg:px-12 max-w-screen-2xl">
                    {/* Date Picker */}
                    <div className="mb-10 sm:mb-16 -mt-14 sm:-mt-20 lg:-mt-24 relative z-20 max-w-4xl mx-auto">
                        <div className="bg-white rounded-2xl shadow-[0_8px_30px_-15px_rgba(0,0,0,0.1)] p-3 md:p-4 border border-gray-100">
                            <DateRangePicker onChange={handleDateChange} minNights={1} />
                        </div>
                    </div>

                    {/* Loading State */}
                    {loading && (
                        <div className="text-center py-24">
                            <div className="relative inline-block">
                                <div className="w-16 h-16 rounded-full border-4 border-gray-200"></div>
                                <div className="absolute top-0 left-0 w-16 h-16 rounded-full border-4 border-[#1e2f27] border-t-transparent animate-spin"></div>
                            </div>
                            <p className="mt-6 text-gray-500 font-light text-lg">Preparing our finest rooms...</p>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="bg-red-50 border border-red-100 rounded-xl p-6 mb-8 flex items-center gap-4 max-w-3xl mx-auto">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-red-800 font-bold">Unable to check availability</p>
                                <p className="text-red-600 text-sm font-light mt-1">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* No Rooms Available */}
                    {!loading && roomTypes.length === 0 && checkIn && checkOut && (
                        <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100 max-w-3xl mx-auto">
                            <div className="w-20 h-20 bg-[#faf8f5] border border-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <span className="text-4xl text-gray-400">😔</span>
                            </div>
                            <h3 className="text-3xl font-serif text-[#1e2f27] mb-4">
                                Fully Booked
                            </h3>
                            <p className="text-gray-500 max-w-md mx-auto font-light leading-relaxed">
                                We're sorry, but all of our sanctuaries are spoken for during your selected dates.
                                Please try adjusting your arrival or departure times.
                            </p>
                            <button className="mt-8 px-8 py-3 bg-[#1e2f27] text-white rounded-sm text-xs tracking-[0.2em] font-semibold uppercase hover:bg-[#2c4036] transition-colors">
                                Adjust Dates
                            </button>
                        </div>
                    )}

                    {/* Room Types Grid */}
                    {!loading && roomTypes.length > 0 && (
                        <div>
                            {/* Results Header */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-gray-200 pb-6">
                                <div>
                                    <h2 className="text-3xl font-serif text-[#1e2f27]">
                                        Available Sanctuaries
                                    </h2>
                                    <p className="text-gray-500 font-light mt-2">
                                        {totalAvailable} suite{totalAvailable !== 1 ? 's' : ''} awaiting your arrival for {nights} night{nights !== 1 ? 's' : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-medium uppercase tracking-wider text-gray-500">
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                        Available
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 bg-[#d29d42] rounded-full"></span>
                                        Limited
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-12">
                                {roomTypes.map((roomType) => (
                                    <RoomTypeCard
                                        key={roomType.type}
                                        roomType={roomType}
                                        nights={nights}
                                        guests={guests}
                                        cart={cart}
                                        checkIn={checkIn}
                                        checkOut={checkOut}
                                        onFloorSelect={(floorOption) => handleFloorSelect(roomType, floorOption)}
                                    />
                                ))}
                            </div>

                            {/* Trust Badges */}
                            <div className="mt-24 mb-12">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-6 text-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-16 h-16 bg-white shadow-sm border border-gray-100 rounded-full flex items-center justify-center">
                                            <svg className="w-6 h-6 text-[#d29d42]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="font-bold text-[#1e2f27] text-sm mb-1">Secure Booking</p>
                                            <p className="text-xs text-gray-500 font-light">SSL encrypted</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-16 h-16 bg-white shadow-sm border border-gray-100 rounded-full flex items-center justify-center">
                                            <svg className="w-6 h-6 text-[#d29d42]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="font-bold text-[#1e2f27] text-sm mb-1">Best Price</p>
                                            <p className="text-xs text-gray-500 font-light">Direct booking benefit</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-16 h-16 bg-white shadow-sm border border-gray-100 rounded-full flex items-center justify-center">
                                            <svg className="w-6 h-6 text-[#d29d42]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="font-bold text-[#1e2f27] text-sm mb-1">Easy Cancellation</p>
                                            <p className="text-xs text-gray-500 font-light">95% refund up to 48hrs before</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-16 h-16 bg-white shadow-sm border border-gray-100 rounded-full flex items-center justify-center">
                                            <svg className="w-6 h-6 text-[#d29d42]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="font-bold text-[#1e2f27] text-sm mb-1">24/7 Support</p>
                                            <p className="text-xs text-gray-500 font-light">Dedicated concierge</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {!checkIn && !checkOut && !loading && (
                        <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100 max-w-4xl mx-auto">
                            <div className="w-24 h-24 bg-[#faf8f5] rounded-full flex items-center justify-center mx-auto mb-8">
                                <span className="text-4xl text-[#d29d42]">📅</span>
                            </div>
                            <h3 className="text-3xl font-serif text-[#1e2f27] mb-4">
                                Begin Your Journey
                            </h3>
                            <p className="text-gray-500 max-w-md mx-auto mb-12 font-light leading-relaxed">
                                Enter your desired dates of stay at the top to unveil our bespoke rooms and exclusive offerings.
                            </p>
                            
                            {/* Features Preview */}
                            <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto mt-8 pt-10 border-t border-gray-100">
                                <div className="p-2">
                                    <div className="text-3xl mb-4 text-[#1e2f27]">🛏️</div>
                                    <p className="font-bold text-[#1e2f27] text-sm uppercase tracking-wider mb-2">Luxury Rooms</p>
                                    <p className="text-sm text-gray-500 font-light">Unrivaled comfort & views</p>
                                </div>
                                <div className="p-2">
                                    <div className="text-3xl mb-4 text-[#1e2f27]">🍽️</div>
                                    <p className="font-bold text-[#1e2f27] text-sm uppercase tracking-wider mb-2">Dining Included</p>
                                    <p className="text-sm text-gray-500 font-light">Gourmet breakfast spread</p>
                                </div>
                                <div className="p-2">
                                    <div className="text-3xl mb-4 text-[#1e2f27]">📶</div>
                                    <p className="font-bold text-[#1e2f27] text-sm uppercase tracking-wider mb-2">Connectivity</p>
                                    <p className="text-sm text-gray-500 font-light">High-speed sanctuary WiFi</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Sticky Cart Footer */}
            {cart.length > 0 && nights > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50 animate-in slide-in-from-bottom pb-safe">
                    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-12 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex-1 w-full">
                            <h4 className="text-[#1e2f27] font-bold text-sm mb-2 flex items-center gap-2">
                                <span className="bg-[#1e2f27] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">{cart.length}</span>
                                Rooms Selected
                            </h4>
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                                {cart.map((item, idx) => (
                                    <div key={`${item.roomId}-${idx}`} className="shrink-0 bg-[#faf8f5] border border-gray-100 rounded-lg px-3 py-1.5 flex items-center gap-3">
                                        <div>
                                            <p className="text-xs font-semibold text-[#1e2f27]">{item.typeLabel}</p>
                                            <p className="text-[10px] text-gray-500">{item.floorLabel} • ₹{calculateBookingPriceBreakdown({
                                            rooms: [{ roomId: item.roomId, baseRate: item.baseRate, weekendMultiplier: item.weekendMultiplier, baseOccupancy: item.baseOccupancy, extraGuestChargePerNight: item.extraGuestChargePerNight }],
                                            checkIn: checkIn!, checkOut: checkOut!, numberOfGuests: item.baseOccupancy, addons: []
                                        }).subtotal.toLocaleString('en-IN')}</p>
                                        </div>
                                        <button 
                                            onClick={() => removeFromCart(item.roomId)}
                                            className="w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors"
                                        >
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="w-full sm:w-auto flex flex-row sm:flex-col items-center sm:items-end justify-between shrink-0 border-t sm:border-t-0 border-gray-100 pt-3 sm:pt-0">
                            <div className="text-left sm:text-right">
                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Cart Total (excl. taxes)</p>
                                {cartPricing?.extraGuestCharge ? (
                                    <p className="text-[10px] text-[#d29d42] mb-0.5">Incl. ₹{cartPricing.extraGuestCharge.toLocaleString('en-IN')} Extra Guest Charge</p>
                                ) : null}
                                <p className="text-2xl font-serif text-[#1e2f27]">
                                    ₹{(cartPricing ? cartPricing.subtotal : 0).toLocaleString('en-IN')}
                                </p>
                            </div>
                            <button 
                                onClick={proceedToCheckout}
                                className="px-8 py-3 bg-[#d29d42] hover:bg-[#b88630] text-white text-xs tracking-widest uppercase font-bold rounded-sm shadow-md transition-colors"
                            >
                                Checkout
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <footer id="contact" className="bg-[#17251f] text-white py-12 sm:py-20 px-5 sm:px-8 lg:px-24 overflow-hidden mt-8 sm:mt-12">
                <div className="max-w-screen-2xl mx-auto">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10 sm:gap-12 lg:gap-24 border-b border-[#2c4036]/50 pb-10 sm:pb-16">
                        {/* Brand details */}
                        <div>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="flex items-center justify-center">
                                    <img src="/logo.png" alt="Studio next Logo" className="w-16 h-16 object-contain" />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="text-2xl font-serif tracking-wide text-white">Studio next</h3>
                                    <span className="text-[#d29d42] text-[8px] tracking-[0.3em] font-medium uppercase mt-1">THE HEART OF THE HILLS</span>
                                </div>
                            </div>
                            <p className="text-[#84a395] text-sm font-light leading-relaxed max-w-sm">
                                A luxury retreat in Mahabaleshwar, where nature and elegance unite.
                            </p>
                        </div>
                        
                        {/* Quick Links */}
                        <div>
                            <h4 className="text-[#d29d42] text-[10px] tracking-[0.2em] font-bold mb-6 uppercase">QUICK LINKS</h4>
                            <ul className="space-y-4 text-sm text-[#84a395] font-light">
                                <li><a href="/#rooms" className="hover:text-[#d29d42] transition-colors inline-block hover:translate-x-1 duration-300">Rooms & Suites</a></li>
                                <li><a href="/#experiences" className="hover:text-[#d29d42] transition-colors inline-block hover:translate-x-1 duration-300">Experiences</a></li>
                                <li><a href="/#about" className="hover:text-[#d29d42] transition-colors inline-block hover:translate-x-1 duration-300">Our Story</a></li>
                                <li><a href="/book" className="hover:text-[#d29d42] transition-colors inline-block hover:translate-x-1 duration-300">Reservations</a></li>
                            </ul>
                        </div>
                        
                        {/* Contact */}
                        <div>
                            <h4 className="text-[#d29d42] text-[10px] tracking-[0.2em] font-bold mb-6 uppercase">CONTACT</h4>
                            <ul className="space-y-5 text-sm text-[#84a395] font-light">
                                <li className="flex items-start gap-4 group">
                                    <span className="text-[#d29d42] mt-0.5 group-hover:-rotate-12 transition-transform">
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    </span>
                                    <a
                                        href="https://www.google.com/travel/search?ts=CAESCgoCCAMKAggDEAAaHBIaEhQKBwjqDxAEGAsSBwjqDxAEGAwYATICEAAqBwoFOgNJTlI&qs=CAEyFENnc0lzb3VJeGFpcG04X2tBUkFCOApCCRF6hSuR36_zo0IJEbcLnkEqlcsFQgkRluLAyM7nX3NaVjJUqgFREAEyHxABIhu4xWeKCe6MMb55wVV4GFRwIIoofLeifmqZM3YyLBACIihvbWthciBob3RlbCBwYW5jaGdhbmkgbWFoYWJhbGVzaHdhciByb2Fk&utm_campaign=sharing&utm_medium=link_btn&utm_source=htls"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:text-[#d29d42] transition-colors"
                                    >
                                        Panchgani - Mahabaleshwar Rd, Bhose, Maharashtra 412805.
                                    </a>
                                </li>
                                <li className="flex items-center gap-4 group">
                                    <span className="text-[#d29d42] group-hover:scale-110 transition-transform">
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                    </span>
                                    <a href="tel:8928584198" className="hover:text-[#d29d42] transition-colors">8928584198</a>
                                </li>
                                <li className="flex items-center gap-4 group">
                                    <span className="text-[#d29d42] group-hover:scale-110 transition-transform">
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                    </span>
                                    <a href="mailto:Studio nexthotel2026@gmail.com" className="hover:text-[#d29d42] transition-colors">Studio nexthotel2026@gmail.com</a>
                                </li>
                            </ul>
                        </div>
                    </div>
                    
                    <div className="pt-6 sm:pt-8 text-center text-[#84a395] text-xs font-light">
                        © {new Date().getFullYear()} Studio next. All rights reserved.
                    </div>
                </div>
            </footer>
        </div>
    );
}

// Room Type Card Component
function RoomTypeCard({ 
    roomType, 
    nights, 
    guests,
    cart,
    checkIn,
    checkOut,
    onFloorSelect 
}: { 
    roomType: RoomTypeGroup; 
    nights: number;
    guests: number;
    cart: {roomId: string}[];
    checkIn: Date | null;
    checkOut: Date | null;
    onFloorSelect: (floorOption: FloorOption) => void;
}) {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const isAvailable = roomType.totalAvailable > 0;
    const hasMultipleOptions = roomType.floorOptions.length > 1;
    const hasMultipleImages = roomType.images.length > 1;

    const displayAmenities = roomType.amenities.slice(0, 5);
    const moreAmenities = roomType.amenities.length - 5;

    const maxExtraGuests = Math.max(0, roomType.maxOccupancy - roomType.baseOccupancy);
    const applicableExtraGuests = Math.min(Math.max(0, guests - roomType.baseOccupancy), maxExtraGuests);
    const extraChargePerNight = applicableExtraGuests * (roomType.extraGuestCharge ?? 0);
    
    const effectiveMinRate = roomType.minRate + extraChargePerNight;

    const nextImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentImageIndex((prev) => (prev + 1) % roomType.images.length);
    };

    const prevImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentImageIndex((prev) => (prev - 1 + roomType.images.length) % roomType.images.length);
    };

    return (
        <div className="bg-white rounded-2xl shadow-[0_8px_30px_-15px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden hover:shadow-[0_8px_30px_-10px_rgba(0,0,0,0.15)] transition-shadow duration-300 group">
            <div className="flex flex-col lg:flex-row lg:h-[480px]">
                {/* Image Carousel */}
                <div className="lg:w-2/5 relative h-56 sm:h-64 lg:h-full shrink-0">
                    <div className="absolute inset-0 bg-[#f4efe8]">
                        {roomType.images.length > 0 ? (
                            <>
                                <img
                                    src={roomType.images[currentImageIndex]}
                                    alt={`${roomType.typeLabel} - Image ${currentImageIndex + 1}`}
                                    className="w-full h-full object-cover cursor-pointer"
                                    onClick={() => setLightboxOpen(true)}
                                />
                                
                                {/* Image Navigation Arrows */}
                                {hasMultipleImages && (
                                    <>
                                        <button
                                            onClick={prevImage}
                                            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white text-[#1e2f27] rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110"
                                        >
                                            <svg className="w-5 h-5 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={nextImage}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white text-[#1e2f27] rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110"
                                        >
                                            <svg className="w-5 h-5 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </button>
                                        {/* Image Dots */}
                                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                                            {roomType.images.map((_, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(idx); }}
                                                    className={`h-1.5 rounded-full shadow-sm transition-all duration-300 ${
                                                        idx === currentImageIndex 
                                                            ? 'bg-white w-6' 
                                                            : 'bg-white/50 hover:bg-white/80 w-1.5'
                                                    }`}
                                                />
                                            ))}
                                        </div>
                                    </>
                                )}
                            </>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-[#faf8f5]">
                                <div className="text-center">
                                    <span className="text-4xl">🏨</span>
                                    <p className="text-gray-400 mt-2 text-xs font-semibold uppercase tracking-widest">Awaiting Photos</p>
                                </div>
                            </div>
                        )}
                        
                        {/* Availability Badge */}
                        <div className={`absolute top-4 left-4 px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold shadow-md rounded-sm backdrop-blur-md ${
                            isAvailable 
                                ? roomType.totalAvailable <= 2 
                                    ? 'bg-[#d29d42]/90 text-white' 
                                    : 'bg-[#1e2f27]/85 text-white'
                                : 'bg-red-600/90 text-white'
                        }`}>
                            {isAvailable 
                                ? roomType.totalAvailable <= 2 
                                    ? `Only ${roomType.totalAvailable} left` 
                                    : `${roomType.totalAvailable} available`
                                : 'Sold out'}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="lg:w-3/5 p-5 sm:p-6 lg:p-8 flex flex-col justify-between bg-white overflow-y-auto">
                    <div>
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 sm:gap-6 mb-5 sm:mb-6">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-[#d29d42] text-[10px] font-bold tracking-[0.2em] uppercase">
                                        {roomType.type} CLASS
                                    </span>
                                </div>
                                <h3 className="text-2xl sm:text-3xl font-serif text-[#1e2f27] leading-tight">
                                    {roomType.typeLabel}
                                </h3>
                                <div className="flex items-center gap-5 mt-4 text-sm text-gray-500 font-light">
                                    <span className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-[#d29d42]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        {roomType.baseOccupancy}-{roomType.maxOccupancy} Guests
                                    </span>
                                    {roomType.extraGuestCharge && roomType.extraGuestCharge > 0 && (
                                        <span className="text-gray-500 flex items-center gap-2">
                                            <svg className="w-4 h-4 text-[#d29d42]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                                            </svg>
                                            ₹{roomType.extraGuestCharge.toLocaleString('en-IN')} Extra Guest
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="text-left sm:text-right">
                                {hasMultipleOptions ? (
                                    <>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">From</p>
                                        <p className="text-3xl font-serif text-[#1e2f27]">
                                            ₹{effectiveMinRate.toLocaleString('en-IN')}
                                        </p>
                                        <p className="text-xs text-gray-500 font-light mt-1">per night</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-3xl font-serif text-[#1e2f27]">
                                            ₹{effectiveMinRate.toLocaleString('en-IN')}
                                        </p>
                                        <p className="text-xs text-gray-500 font-light mt-1 border-t border-gray-100 pt-1 border-dashed">per night</p>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Description */}
                        <p className="text-gray-600 text-sm font-light leading-relaxed mb-6">
                            {roomType.description}
                        </p>

                        {/* Amenities */}
                        <div className="mb-6">
                            <div className="flex flex-wrap gap-2">
                                {displayAmenities.map((amenity) => (
                                    <span
                                        key={amenity}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#faf8f5] text-gray-600 text-xs font-medium rounded-sm border border-gray-100"
                                    >
                                        <span className="text-[#d29d42]">•</span>
                                        {amenity}
                                    </span>
                                ))}
                                {moreAmenities > 0 && (
                                    <span className="px-3 py-1.5 bg-[#f5efe6] text-[#c38d32] text-xs rounded-sm font-semibold border border-[#d29d42]/20">
                                        +{moreAmenities} more
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Floor Options (Booking Area) */}
                    <div className="pt-6 border-t border-gray-100">
                        {hasMultipleOptions ? (
                            <div className="space-y-4">
                                <p className="text-xs font-bold text-[#1e2f27] uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-[#d29d42] rounded-full"></span>
                                    Select Your Floor Level
                                </p>
                                <div className="grid sm:grid-cols-2 gap-3">
                                    {roomType.floorOptions.map((option, index) => {
                                        const effectiveOptionRate = option.baseRate + extraChargePerNight;
                                        const optionPricing = checkIn && checkOut ? calculateBookingPriceBreakdown({
                                            rooms: [{ roomId: 'preview', baseRate: option.baseRate, weekendMultiplier: option.weekendMultiplier ?? 1.2, baseOccupancy: roomType.baseOccupancy, extraGuestChargePerNight: roomType.extraGuestCharge ?? 0 }],
                                            checkIn, checkOut, numberOfGuests: roomType.baseOccupancy + applicableExtraGuests, addons: []
                                        }) : null;
                                        const optionTotal = optionPricing?.subtotal ?? (effectiveOptionRate * nights);
                                        const optionAvailable = option.availableCount > 0;
                                        return (
                                            <div 
                                                key={index}
                                                className={`p-3 rounded-xl border transition-all duration-300 ${
                                                    optionAvailable 
                                                        ? 'border-gray-200 hover:border-[#1e2f27] hover:bg-[#faf8f5] cursor-pointer group/floor relative overflow-hidden' 
                                                        : 'border-gray-100 bg-gray-50 opacity-60'
                                                }`}
                                                onClick={() => optionAvailable && onFloorSelect(option)}
                                            >
                                                {optionAvailable && (
                                                    <div className="absolute top-0 right-0 w-8 h-8 bg-[#1e2f27] translate-x-4 -translate-y-4 rotate-45 group-hover/floor:bg-[#d29d42] transition-colors"></div>
                                                )}
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <p className="font-bold text-[#1e2f27]">
                                                            {option.floorLabel}
                                                        </p>
                                                        <p className={`text-xs mt-0.5 ${optionAvailable ? 'text-[#d29d42] font-medium' : 'text-gray-400'}`}>
                                                            {optionAvailable 
                                                                ? `${option.availableCount - (cart.filter(c => option.roomIds.includes(c.roomId)).length)} available`
                                                                : 'Sold out'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-end border-t border-gray-100 pt-3">
                                                    <div className="text-lg font-serif text-[#1e2f27]">
                                                        ₹{effectiveOptionRate.toLocaleString('en-IN')}
                                                        <span className="text-[10px] font-sans font-medium text-gray-500 uppercase tracking-widest ml-1">/ Night</span>
                                                    </div>
                                                </div>
                                                {nights > 0 && optionAvailable && (
                                                    <div className="mt-2 text-xs text-gray-500 font-light flex justify-between items-center bg-gray-50 px-2 py-1 rounded-sm">
                                                        <span>Est. Total <span className="text-gray-400">(excl. taxes)</span>:</span>
                                                        <span className="font-medium text-[#1e2f27]">₹{optionTotal.toLocaleString('en-IN')}</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#faf8f5] border border-gray-100 p-5 rounded-xl gap-4">
                                <div>
                                    {nights > 0 && (
                                        <div>
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Stay Total ({nights} Nights)</p>
                                            <p className="text-3xl font-serif text-[#1e2f27]">
                                                ₹{(checkIn && checkOut ? calculateBookingPriceBreakdown({
                                                    rooms: [{ roomId: 'preview', baseRate: roomType.floorOptions[0].baseRate, weekendMultiplier: roomType.floorOptions[0].weekendMultiplier ?? 1.2, baseOccupancy: roomType.baseOccupancy, extraGuestChargePerNight: roomType.extraGuestCharge ?? 0 }],
                                                    checkIn, checkOut, numberOfGuests: roomType.baseOccupancy + applicableExtraGuests, addons: []
                                                }).subtotal : effectiveMinRate * nights).toLocaleString('en-IN')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => onFloorSelect(roomType.floorOptions[0])}
                                    disabled={!isAvailable || roomType.floorOptions[0].availableCount - (cart.filter(c => roomType.floorOptions[0].roomIds.includes(c.roomId)).length) <= 0}
                                    className={`px-8 py-3.5 rounded-sm text-xs tracking-[0.2em] font-bold uppercase transition-all duration-300 w-full sm:w-auto ${
                                        isAvailable && roomType.floorOptions[0].availableCount - (cart.filter(c => roomType.floorOptions[0].roomIds.includes(c.roomId)).length) > 0
                                            ? 'bg-[#1e2f27] text-white hover:bg-[#2c4036] hover:shadow-lg hover:-translate-y-0.5'
                                            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                    }`}
                                >
                                    {isAvailable && roomType.floorOptions[0].availableCount - (cart.filter(c => roomType.floorOptions[0].roomIds.includes(c.roomId)).length) > 0 ? 'Add to Cart' : 'Sold Out'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Image Lightbox — no card, just the image */}
            {lightboxOpen && roomType.images.length > 0 && (
                <div
                    className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90"
                    onClick={() => setLightboxOpen(false)}
                >
                    {/* Close button */}
                    <button
                        onClick={() => setLightboxOpen(false)}
                        className="absolute top-5 right-5 z-10 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    {/* Main Image */}
                    <div
                        className="relative w-full max-w-4xl max-h-[75vh] mx-4 flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={roomType.images[currentImageIndex]}
                            alt={`${roomType.typeLabel} - Image ${currentImageIndex + 1}`}
                            className="max-w-full max-h-[75vh] object-contain rounded-lg"
                        />
                        {/* Prev / Next arrows */}
                        {hasMultipleImages && (
                            <>
                                <button
                                    onClick={() => setCurrentImageIndex((prev) => (prev - 1 + roomType.images.length) % roomType.images.length)}
                                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-14 w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition hover:scale-110"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <button
                                    onClick={() => setCurrentImageIndex((prev) => (prev + 1) % roomType.images.length)}
                                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-14 w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition hover:scale-110"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </>
                        )}
                        {/* Counter */}
                        <span className="absolute bottom-3 right-3 text-xs font-medium text-white/80 bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full">
                            {currentImageIndex + 1} / {roomType.images.length}
                        </span>
                    </div>

                    {/* Thumbnail Strip */}
                    {hasMultipleImages && (
                        <div
                            className="flex gap-2.5 mt-5 px-4 overflow-x-auto max-w-4xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {roomType.images.map((img, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setCurrentImageIndex(idx)}
                                    className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                                        idx === currentImageIndex
                                            ? 'border-[#d29d42] shadow-[0_0_8px_rgba(210,157,66,0.5)] scale-110'
                                            : 'border-white/20 opacity-50 hover:opacity-90 hover:border-white/50'
                                    }`}
                                >
                                    <img
                                        src={img}
                                        alt={`${roomType.typeLabel} thumbnail ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
