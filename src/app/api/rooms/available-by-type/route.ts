import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRoomAvailability } from '@/lib/availability';

// Floor option within a room type (for different floors/rates)
interface FloorOption {
    floor: number | null;
    floorLabel: string;
    baseRate: number;
    weekendMultiplier: number;
    availableCount: number;
    totalCount: number;
    roomIds: string[]; // Available room IDs for this floor option
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
    floorOptions: FloorOption[]; // Different floor/rate options
}

const TYPE_LABELS: Record<string, string> = {
    STANDARD: 'Standard Room',
    DELUXE: 'Deluxe Room',
    SUITE: 'Suite',
    FAMILY: 'Family Room',
};

const TYPE_DESCRIPTIONS: Record<string, string> = {
    STANDARD: 'Comfortable and cozy rooms perfect for budget-conscious travelers.',
    DELUXE: 'Spacious rooms with premium amenities and stunning views.',
    SUITE: 'Luxurious suites with separate living areas and top-tier amenities.',
    FAMILY: 'Large rooms designed to accommodate families with extra space and amenities.',
};

// Helper to get floor label
function getFloorLabel(floor: number | null): string {
    if (floor === null) return 'Standard';
    if (floor === -2) return 'Basement 2';
    if (floor === -1) return 'Basement 1';
    if (floor === 0) return 'Ground Floor';
    if (floor === 1) return '1st Floor';
    if (floor === 2) return '2nd Floor';
    if (floor === 3) return '3rd Floor';
    return `${floor}th Floor`;
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const checkIn = searchParams.get('checkIn');
        const checkOut = searchParams.get('checkOut');

        if (!checkIn || !checkOut) {
            return NextResponse.json(
                { error: 'Check-in and check-out dates are required' },
                { status: 400 }
            );
        }

        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);

        // Validate dates
        if (checkInDate >= checkOutDate) {
            return NextResponse.json(
                { error: 'Check-out date must be after check-in date' },
                { status: 400 }
            );
        }

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (checkInDate < startOfToday) {
            return NextResponse.json(
                { error: 'Check-in date cannot be before today' },
                { status: 400 }
            );
        }

        // Exclude only permanently out-of-service rooms.
        // OCCUPIED / CLEANING rooms are still candidates — their real availability
        // is determined by the booking-overlap check below (checkRoomAvailability).
        // This matches the logic in getAvailableRooms() in availability.ts.
        const allRooms = await prisma.room.findMany({
            where: {
                status: {
                    notIn: ['MAINTENANCE', 'OUT_OF_ORDER'],
                },
            },
            include: {
                rates: {
                    where: {
                        effectiveFrom: { lte: checkInDate },
                        OR: [
                            { effectiveTo: null },
                            { effectiveTo: { gte: checkInDate } },
                        ],
                    },
                    orderBy: {
                        effectiveFrom: 'desc',
                    },
                    take: 1,
                },
            },
        });

        // Check availability for each room
        const roomsWithAvailability = await Promise.all(
            allRooms.map(async (room) => {
                const isAvailable = await checkRoomAvailability(room.id, checkInDate, checkOutDate);
                return {
                    ...room,
                    available: isAvailable,
                    baseRate: room.rates[0]?.baseRate.toNumber() || 0,
                    weekendMultiplier: room.rates[0]?.weekendMultiplier.toNumber() || 1.2,
                };
            })
        );

        // Group rooms by type
        const groupedByType: Record<string, typeof roomsWithAvailability> = {};
        for (const room of roomsWithAvailability) {
            if (!groupedByType[room.type]) {
                groupedByType[room.type] = [];
            }
            groupedByType[room.type].push(room);
        }

        // Build room type groups with floor options
        const roomTypeGroups: RoomTypeGroup[] = [];

        for (const [type, rooms] of Object.entries(groupedByType)) {
            const sampleRoom = rooms[0];
            
            // Group by floor + rate combination
            const floorRateGroups: Record<string, typeof rooms> = {};
            for (const room of rooms) {
                // Create a key combining floor and rate for grouping
                const key = `${room.floor ?? 'null'}_${room.baseRate}`;
                if (!floorRateGroups[key]) {
                    floorRateGroups[key] = [];
                }
                floorRateGroups[key].push(room);
            }

            // Build floor options
            const floorOptions: FloorOption[] = [];
            for (const groupRooms of Object.values(floorRateGroups)) {
                const sampleFloorRoom = groupRooms[0];
                const availableInGroup = groupRooms.filter(r => r.available);
                
                floorOptions.push({
                    floor: sampleFloorRoom.floor,
                    floorLabel: getFloorLabel(sampleFloorRoom.floor),
                    baseRate: sampleFloorRoom.baseRate,
                    weekendMultiplier: sampleFloorRoom.weekendMultiplier,
                    availableCount: availableInGroup.length,
                    totalCount: groupRooms.length,
                    roomIds: availableInGroup.map(r => r.id),
                });
            }

            // Sort floor options by rate (cheapest first)
            floorOptions.sort((a, b) => a.baseRate - b.baseRate);

            // Parse amenities from first room
            let amenities: string[] = [];
            if (typeof sampleRoom.amenities === 'string') {
                try {
                    amenities = JSON.parse(sampleRoom.amenities);
                } catch {
                    amenities = [];
                }
            } else if (Array.isArray(sampleRoom.amenities)) {
                amenities = sampleRoom.amenities as string[];
            }
            
            // Collect images from ALL rooms in this type (not just first room)
            const allImages: string[] = [];
            for (const room of rooms) {
                let roomImages: string[] = [];
                if (typeof room.images === 'string') {
                    try {
                        roomImages = JSON.parse(room.images);
                    } catch {
                        roomImages = [];
                    }
                } else if (Array.isArray(room.images)) {
                    roomImages = room.images as string[];
                }
                // Add unique images only
                for (const img of roomImages) {
                    if (img && !allImages.includes(img)) {
                        allImages.push(img);
                    }
                }
            }

            // Calculate totals
            const allRates = floorOptions.map(fo => fo.baseRate);
            const totalAvailable = floorOptions.reduce((sum, fo) => sum + fo.availableCount, 0);
            const totalRooms = floorOptions.reduce((sum, fo) => sum + fo.totalCount, 0);

            roomTypeGroups.push({
                type,
                typeLabel: TYPE_LABELS[type] || type,
                description: TYPE_DESCRIPTIONS[type] || '',
                minRate: Math.min(...allRates),
                maxRate: Math.max(...allRates),
                totalAvailable,
                totalRooms,
                baseOccupancy: sampleRoom.baseOccupancy,
                maxOccupancy: sampleRoom.maxOccupancy,
                extraGuestCharge: sampleRoom.extraGuestCharge?.toNumber() ?? null,
                amenities,
                images: allImages,
                floorOptions,
            });
        }

        // Sort by minRate
        roomTypeGroups.sort((a, b) => a.minRate - b.minRate);

        return NextResponse.json({
            success: true,
            data: roomTypeGroups,
            count: roomTypeGroups.length,
        });
    } catch (error) {
        console.error('Error fetching room types:', error);
        return NextResponse.json(
            { error: 'Failed to fetch room types' },
            { status: 500 }
        );
    }
}
