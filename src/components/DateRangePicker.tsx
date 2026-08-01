'use client';

import { useState } from 'react';

interface DateRange {
    checkIn: Date | null;
    checkOut: Date | null;
    guests: number;
}

interface DateRangePickerProps {
    onChange: (range: DateRange) => void;
    minNights?: number;
    maxGuests?: number;
}

export function DateRangePicker({ onChange, minNights = 1, maxGuests = 10 }: DateRangePickerProps) {
    const [checkIn, setCheckIn] = useState<string>('');
    const [checkOut, setCheckOut] = useState<string>('');
    const [guests, setGuests] = useState<number>(2);

    const today = new Date().toISOString().split('T')[0];

    const handleCheckInChange = (value: string) => {
        setCheckIn(value);

        // Auto-set checkout to minimum nights later
        const checkInDate = new Date(value);
        const minCheckOut = new Date(checkInDate);
        minCheckOut.setDate(minCheckOut.getDate() + minNights);

        if (!checkOut || new Date(checkOut) <= checkInDate) {
            const newCheckOut = minCheckOut.toISOString().split('T')[0];
            setCheckOut(newCheckOut);
            onChange({
                checkIn: checkInDate,
                checkOut: minCheckOut,
                guests,
            });
        } else {
            onChange({
                checkIn: checkInDate,
                checkOut: new Date(checkOut),
                guests,
            });
        }
    };

    const handleCheckOutChange = (value: string) => {
        setCheckOut(value);
        onChange({
            checkIn: checkIn ? new Date(checkIn) : null,
            checkOut: new Date(value),
            guests,
        });
    };

    const handleGuestsChange = (value: number) => {
        setGuests(value);
        if (checkIn && checkOut) {
            onChange({
                checkIn: new Date(checkIn),
                checkOut: new Date(checkOut),
                guests: value,
            });
        }
    };

    const nights = checkIn && checkOut
        ? Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    return (
        <div className="w-full bg-white p-2">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 items-end">
                {/* Check-in Date */}
                <div className="flex flex-col w-full text-left">
                    <label className="flex items-center gap-2 text-xs font-bold text-[#1e2f27] uppercase tracking-wider mb-2">
                        <svg className="w-4 h-4 text-[#d29d42]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Check-in
                    </label>
                    <input
                        type="date"
                        value={checkIn}
                        min={today}
                        onChange={(e) => handleCheckInChange(e.target.value)}
                        className="w-full h-[52px] px-4 border border-gray-200 bg-[#faf8f5] rounded-xl focus:border-[#1e2f27] focus:ring-1 focus:ring-[#1e2f27] transition-all text-[#1e2f27] font-medium outline-none"
                    />
                </div>

                {/* Check-out Date */}
                <div className="flex flex-col w-full text-left">
                    <label className="flex items-center gap-2 text-xs font-bold text-[#1e2f27] uppercase tracking-wider mb-2">
                        <svg className="w-4 h-4 text-[#d29d42]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Check-out
                    </label>
                    <input
                        type="date"
                        value={checkOut}
                        min={checkIn || today}
                        onChange={(e) => handleCheckOutChange(e.target.value)}
                        className="w-full h-[52px] px-4 border border-gray-200 bg-[#faf8f5] rounded-xl focus:border-[#1e2f27] focus:ring-1 focus:ring-[#1e2f27] transition-all text-[#1e2f27] font-medium outline-none"
                    />
                </div>

                {/* Guests Selector */}
                <div className="flex flex-col w-full text-left">
                    <label className="flex items-center gap-2 text-xs font-bold text-[#1e2f27] uppercase tracking-wider mb-2">
                        <svg className="w-4 h-4 text-[#d29d42]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Guests
                    </label>
                    <div className="flex items-center justify-between px-3 h-[52px] border border-gray-200 rounded-xl bg-[#faf8f5]">
                        <button
                            type="button"
                            onClick={() => handleGuestsChange(Math.max(1, guests - 1))}
                            className="w-9 h-9 rounded-full bg-white shadow-sm border border-gray-200 hover:border-[#1e2f27] flex items-center justify-center text-[#1e2f27] font-bold transition-all text-lg disabled:opacity-40"
                            disabled={guests <= 1}
                        >
                            −
                        </button>
                        <span className="font-bold text-[#1e2f27]">
                            {guests} <span className="font-medium text-gray-500 text-sm">Guest{guests > 1 ? 's' : ''}</span>
                        </span>
                        <button
                            type="button"
                            onClick={() => handleGuestsChange(Math.min(maxGuests, guests + 1))}
                            className="w-9 h-9 rounded-full bg-white shadow-sm border border-gray-200 hover:border-[#1e2f27] flex items-center justify-center text-[#1e2f27] font-bold transition-all text-lg disabled:opacity-40"
                            disabled={guests >= maxGuests}
                        >
                            +
                        </button>
                    </div>
                </div>

                {/* Duration Display */}
                <div className="flex flex-col w-full">
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 invisible md:visible">
                        Duration
                    </label>
                    <div className={`w-full h-[52px] rounded-xl flex items-center justify-center font-bold text-sm tracking-[0.15em] uppercase transition-all duration-300 ${
                        nights > 0 
                            ? 'bg-[#1e2f27] text-white shadow-md' 
                            : 'bg-gray-100 text-gray-400'
                    }`}>
                        {nights > 0 ? (
                            <span className="flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                </svg>
                                {nights} Night{nights > 1 ? 's' : ''}
                            </span>
                        ) : (
                            'Select dates'
                        )}
                    </div>
                </div>
            </div>
            
            {/* Expanded Dates Visual Summary */}
            {nights > 0 && (
                <div className="mt-4 sm:mt-6 pt-4 sm:pt-5 border-t border-gray-100 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-sm">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-50 rounded-full flex items-center justify-center border border-gray-100">
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#d29d42]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                            </svg>
                        </div>
                        <div className="text-left">
                            <p className="font-bold text-[#1e2f27] text-sm">{new Date(checkIn).toLocaleDateString('en-IN', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                            })}</p>
                            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mt-0.5">Check-in</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 sm:gap-2 text-gray-300 font-light text-xs">
                        <span>—</span>
                        <span className="text-[#d29d42] font-medium">{nights} Night{nights > 1 ? 's' : ''}</span>
                        <span>—</span>
                    </div>
                    
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-50 rounded-full flex items-center justify-center border border-gray-100">
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#1e2f27]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </div>
                        <div className="text-left">
                            <p className="font-bold text-[#1e2f27] text-sm">{new Date(checkOut).toLocaleDateString('en-IN', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                            })}</p>
                            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mt-0.5">Check-out</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
