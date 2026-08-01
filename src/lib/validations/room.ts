import { z } from 'zod';

// Room validation schema
export const roomSchema = z.object({
    roomNumber: z.string().trim().min(1, 'Room number is required'),
    // Match DB enum RoomType: STANDARD, DELUXE, SUITE, FAMILY
    type: z.enum(['STANDARD', 'DELUXE', 'SUITE', 'FAMILY']),
    baseOccupancy: z.coerce.number().int().min(1).max(6).default(2),
    maxOccupancy: z.coerce.number().int().min(1).max(8).default(3),
    extraGuestCharge: z.coerce.number().min(0).default(0),
    floor: z.coerce.number().int().nullable().optional(), // Supports basement (-1, -2), ground (0), upper floors, or null
    size: z.coerce.number().positive('Size must be positive'),
    description: z.string().trim().min(10, 'Description must be at least 10 characters'),
    amenities: z.array(z.string()).default([]),
    images: z.array(z.string()).default([]),
    baseRate: z.coerce.number().positive('Base rate must be positive'),
});

export const updateRoomSchema = roomSchema.partial();

export const updateRoomStatusSchema = z.object({
    status: z.enum(['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE', 'OUT_OF_ORDER']),
});

export type RoomInput = z.infer<typeof roomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type UpdateRoomStatusInput = z.infer<typeof updateRoomStatusSchema>;
