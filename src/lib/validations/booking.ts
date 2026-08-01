import { z } from 'zod';

// Booking validation schemas
export const createBookingSchema = z.object({
    guestId: z.string().optional(),
    // Guest info if creating new guest
    guestInfo: z.object({
        fullName: z.string().min(2, 'Full name is required'),
        email: z.string().email('Valid email is required'),
        phone: z.string().min(10, 'Valid phone number is required'),
        idProofType: z.string().min(1, 'ID proof type is required'),
        idProofNumber: z.string().min(5, 'ID proof number is required'),
        address: z.string().optional(),
    }).optional(),
    roomId: z.string().min(1, 'Room is required'),
    checkIn: z.string().min(1, 'Check-in date is required'),
    checkOut: z.string().min(1, 'Check-out date is required'),
    numberOfGuests: z.number().int().positive('Number of guests must be positive'),
    specialRequests: z.string().optional(),
    addons: z.array(z.string()).default([]),
    paymentMethod: z.enum(['CASH', 'CARD', 'UPI', 'ONLINE']).default('CASH'),
    paidAmount: z.number().min(0).default(0),
    // Admin rate override (bargaining / walk-in negotiation)
    overrideRate: z.number().positive().optional(),
    overrideNote: z.string().max(300).optional(),
});

export const updateBookingSchema = z.object({
    roomId: z.string().optional(),
    checkIn: z.string().optional(),
    checkOut: z.string().optional(),
    numberOfGuests: z.number().int().positive().optional(),
    specialRequests: z.string().optional(),
    addons: z.array(z.string()).optional(),
});

export const updateBookingStatusSchema = z.object({
    status: z.enum(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED']),
    cancellationReason: z.string().optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;
export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;
