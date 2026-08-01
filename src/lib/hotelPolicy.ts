/**
 * STUDIO NEXT — Policy Constants
 * Single source of truth for all time-based hotel rules.
 *
 * IST = UTC + 5:30
 */

export const HOTEL_POLICY = {
    /** Checkout deadline: 10:00 AM IST */
    CHECKOUT_HOUR_IST: 10,
    CHECKOUT_MINUTE_IST: 0,

    /** Check-in time: 11:00 AM IST */
    CHECKIN_HOUR_IST: 11,
    CHECKIN_MINUTE_IST: 0,

    /** IST offset from UTC (in minutes) */
    IST_OFFSET_MINUTES: 330, // +5:30
} as const;

/**
 * Get current time in IST as a Date object (wall-clock values in IST).
 */
export function nowIST(): Date {
    const utc = new Date();
    return new Date(utc.getTime() + HOTEL_POLICY.IST_OFFSET_MINUTES * 60 * 1000);
}

/**
 * Convert any Date to its IST "wall-clock" time.
 */
export function toIST(date: Date): Date {
    return new Date(date.getTime() + HOTEL_POLICY.IST_OFFSET_MINUTES * 60 * 1000);
}

/**
 * Returns true if the current IST time is AT OR AFTER 10:00 AM IST.
 * Used to check whether departed guests have had time to leave.
 */
export function isPastCheckoutTime(): boolean {
    const ist = nowIST();
    const hour = ist.getUTCHours();
    const minute = ist.getUTCMinutes();
    return (
        hour > HOTEL_POLICY.CHECKOUT_HOUR_IST ||
        (hour === HOTEL_POLICY.CHECKOUT_HOUR_IST && minute >= HOTEL_POLICY.CHECKOUT_MINUTE_IST)
    );
}

/**
 * Returns true if the current IST time is AT OR AFTER 11:00 AM IST.
 * Used to check whether a room is ready for new guests.
 */
export function isPastCheckinTime(): boolean {
    const ist = nowIST();
    const hour = ist.getUTCHours();
    const minute = ist.getUTCMinutes();
    return (
        hour > HOTEL_POLICY.CHECKIN_HOUR_IST ||
        (hour === HOTEL_POLICY.CHECKIN_HOUR_IST && minute >= HOTEL_POLICY.CHECKIN_MINUTE_IST)
    );
}

/**
 * Returns the UTC timestamp for 10:00 AM IST on a given local IST date string (YYYY-MM-DD).
 */
export function checkoutDeadlineUTC(istDateStr: string): Date {
    // istDateStr e.g. "2026-03-21"  → 10:00 AM IST = 04:30 AM UTC
    const [year, month, day] = istDateStr.split('-').map(Number);
    return new Date(
        Date.UTC(year, month - 1, day, HOTEL_POLICY.CHECKOUT_HOUR_IST, HOTEL_POLICY.CHECKOUT_MINUTE_IST) -
        HOTEL_POLICY.IST_OFFSET_MINUTES * 60 * 1000
    );
}

/**
 * Returns the UTC timestamp for 11:00 AM IST on a given local IST date string (YYYY-MM-DD).
 */
export function checkinReadyUTC(istDateStr: string): Date {
    const [year, month, day] = istDateStr.split('-').map(Number);
    return new Date(
        Date.UTC(year, month - 1, day, HOTEL_POLICY.CHECKIN_HOUR_IST, HOTEL_POLICY.CHECKIN_MINUTE_IST) -
        HOTEL_POLICY.IST_OFFSET_MINUTES * 60 * 1000
    );
}

/**
 * Get today's date string in IST (YYYY-MM-DD).
 */
export function todayIST(): string {
    const ist = nowIST();
    return ist.toISOString().split('T')[0];
}

/**
 * Format minutes remaining to HH:MM string.
 */
export function minutesToHHMM(minutes: number): string {
    const h = Math.floor(Math.abs(minutes) / 60);
    const m = Math.abs(minutes) % 60;
    return `${h}h ${m}m`;
}
