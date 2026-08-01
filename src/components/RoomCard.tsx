'use client';

import Image from 'next/image';

interface RoomCardProps {
    room: {
        id: string;
        roomNumber: string;
        type: string;
        capacity: number;
        description: string | null;
        amenities: string[];
        images: string[];
        baseRate: number;
    };
    onSelect?: (roomId: string) => void;
    nights?: number;
}

export function RoomCard({ room, onSelect, nights = 1 }: RoomCardProps) {
    const totalPrice = room.baseRate * nights;
    const isWeekend = false; // TODO: Calculate based on selected dates

    const getRoomTypeLabel = (type: string) => {
        switch (type) {
            case 'DELUXE': return 'Deluxe Room';
            case 'SUITE': return 'Premium Suite';
            case 'FAMILY': return 'Family Room';
            case 'STANDARD': return 'Standard Room';
            default: return type;
        }
    };

    return (
        <div className="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-md hover:shadow-large transition-all duration-300 hover:-translate-y-1">
            {/* Image area */}
            <div className="relative h-64 bg-neutral-200">
                {room.images.length > 0 ? (
                    <Image
                        src={room.images[0]}
                        alt={getRoomTypeLabel(room.type)}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                        priority={false}
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
                        <span className="text-6xl">🏨</span>
                    </div>
                )}
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-linear-to-t from-neutral-900/60 via-neutral-900/10 to-transparent" />
                {/* Price pill */}
                <div className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-sm font-semibold text-neutral-900 shadow-subtle">
                    ₹{room.baseRate.toLocaleString('en-IN')}/night
                </div>
                {/* Type and meta */}
                <div className="absolute bottom-4 left-4 right-4 z-10 text-white drop-shadow">
                    <h3 className="text-2xl font-display font-semibold mb-1">
                        {getRoomTypeLabel(room.type)}
                    </h3>
                    <p className="text-sm text-white/90 flex items-center gap-2">
                        <span>Room {room.roomNumber}</span>
                        <span>•</span>
                        <span>Sleeps {room.capacity}</span>
                    </p>
                </div>
                {room.type === 'SUITE' && (
                    <div className="absolute top-4 left-4 z-10 bg-brand-accent text-white px-3 py-1 rounded-full text-sm font-semibold shadow-soft">
                        ⭐ Popular
                    </div>
                )}
            </div>

            {/* Details */}
            <div className="p-6">
                <p className="text-neutral-600 mb-4 line-clamp-2">
                    {room.description || 'Comfortable room with modern amenities'}
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                    {room.amenities.slice(0, 4).map((amenity, index) => (
                        <span key={index} className="px-3 py-1 bg-neutral-100 rounded-full text-sm text-neutral-700">
                            {amenity}
                        </span>
                    ))}
                    {room.amenities.length > 4 && (
                        <span className="px-3 py-1 bg-neutral-100 rounded-full text-sm text-neutral-700">
                            +{room.amenities.length - 4} more
                        </span>
                    )}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-neutral-200">
                    <div className="text-sm text-neutral-600">Base Rate</div>
                    <div className="text-lg font-semibold text-neutral-900">₹{room.baseRate.toLocaleString('en-IN')}</div>
                </div>
                <div className="mt-4">
                    {onSelect ? (
                        <button onClick={() => onSelect(room.id)} className="w-full btn-primary text-sm">
                            Select Room
                        </button>
                    ) : (
                        <button className="w-full btn-secondary text-sm">View Details</button>
                    )}
                </div>
            </div>
        </div>
    );
}
