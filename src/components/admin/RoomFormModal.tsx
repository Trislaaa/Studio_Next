'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface RoomFormData {
    roomNumber: string;
    type: 'STANDARD' | 'DELUXE' | 'SUITE' | 'FAMILY' | 'PENTHOUSE';
    baseOccupancy: number;
    maxOccupancy: number;
    extraGuestCharge: number;
    floor: number | null;
    size: number;
    description: string;
    amenities: string[];
    images: string[];
    baseRate: number;
}

interface RoomEntry {
    roomNumber: string;
    floor: number | null;
}

interface RoomFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: RoomFormData) => Promise<void>;
    initialData?: Partial<RoomFormData>;
    mode: 'create' | 'edit';
}

// Match DB enum RoomType
const ROOM_TYPES = ['STANDARD', 'DELUXE', 'SUITE', 'FAMILY'] as const;

// Floor options including special floors
const FLOOR_OPTIONS = [
    { value: '', label: 'Not Specified' },
    { value: '-2', label: 'Basement 2' },
    { value: '-1', label: 'Basement 1' },
    { value: '0', label: 'Ground Floor' },
    { value: '1', label: '1st Floor' },
    { value: '2', label: '2nd Floor' },
    { value: '3', label: '3rd Floor' },
    { value: '4', label: '4th Floor' },
    { value: '5', label: '5th Floor' },
    { value: '6', label: '6th Floor' },
    { value: '7', label: '7th Floor' },
    { value: '8', label: '8th Floor' },
    { value: '9', label: '9th Floor' },
    { value: '10', label: '10th Floor' },
];

const COMMON_AMENITIES = [
    'Air Conditioning',
    'Free WiFi',
    'TV',
    'Smart TV',
    'Mini Bar',
    'King Size Bed',
    'Queen Size Bed',
    'Double Bed',
    'Single Beds',
    'Balcony',
    'Valley View',
    'Garden View',
    'Mountain View',
    'Breakfast',
    'Jacuzzi',
    'Bathtub',
    'Sofa Bed',
    'Work Desk',
    'Coffee Maker',
    'Refrigerator',
    'Hot Kettle',
    'Room Service',
];

export default function RoomFormModal({ isOpen, onClose, onSubmit, initialData, mode }: RoomFormModalProps) {
    const [formData, setFormData] = useState<RoomFormData>({
        roomNumber: initialData?.roomNumber || '',
        type: initialData?.type || 'DELUXE',
        baseOccupancy: initialData?.baseOccupancy || 2,
        maxOccupancy: initialData?.maxOccupancy || 3,
        extraGuestCharge: initialData?.extraGuestCharge || 500,
        floor: initialData?.floor ?? null,
        size: initialData?.size || 300,
        description: initialData?.description || '',
        amenities: initialData?.amenities || [],
        images: initialData?.images || [],
        baseRate: initialData?.baseRate || 2500,
    });
    
    // For bulk room creation
    const [roomEntries, setRoomEntries] = useState<RoomEntry[]>([{ roomNumber: '', floor: null }]);
    
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

    // Reset form data when modal opens or initialData/mode changes
    useEffect(() => {
        if (isOpen) {
            setFormData({
                roomNumber: initialData?.roomNumber || '',
                type: initialData?.type || 'DELUXE',
                baseOccupancy: initialData?.baseOccupancy || 2,
                maxOccupancy: initialData?.maxOccupancy || 3,
                extraGuestCharge: initialData?.extraGuestCharge || 500,
                floor: initialData?.floor ?? null,
                size: initialData?.size || 300,
                description: initialData?.description || '',
                amenities: initialData?.amenities || [],
                images: initialData?.images || [],
                baseRate: initialData?.baseRate || 2500,
            });
            if (mode === 'create') {
                setRoomEntries([{ roomNumber: '', floor: null }]);
            }
        }
    }, [isOpen, initialData, mode]);

    const addRoomEntry = () => {
        setRoomEntries(prev => [...prev, { roomNumber: '', floor: null }]);
    };

    const removeRoomEntry = (index: number) => {
        if (roomEntries.length > 1) {
            setRoomEntries(prev => prev.filter((_, i) => i !== index));
        }
    };

    const updateRoomEntry = (index: number, field: keyof RoomEntry, value: string | number | null) => {
        setRoomEntries(prev => prev.map((entry, i) => 
            i === index ? { ...entry, [field]: value } : entry
        ));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (mode === 'create') {
                // Create multiple rooms
                const validEntries = roomEntries.filter(entry => entry.roomNumber.trim() !== '');
                for (const entry of validEntries) {
                    await onSubmit({
                        ...formData,
                        roomNumber: entry.roomNumber.trim(),
                        floor: entry.floor,
                    });
                }
            } else {
                await onSubmit(formData);
            }
            onClose();
        } catch (error) {
            console.error('Error submitting form:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        setUploading(true);
        const uploadedUrls: string[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileKey = `${file.name}-${Date.now()}`;

            try {
                // Create FormData
                const formData = new FormData();
                formData.append('file', file);

                // Simulate progress (since fetch doesn't support upload progress directly)
                setUploadProgress(prev => ({ ...prev, [fileKey]: 0 }));

                // Upload file
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Upload failed');
                }

                const data = await response.json();
                uploadedUrls.push(data.url);

                setUploadProgress(prev => ({ ...prev, [fileKey]: 100 }));
            } catch (error) {
                console.error('Error uploading file:', error);
                alert(`Failed to upload ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                setUploadProgress(prev => {
                    const newProgress = { ...prev };
                    delete newProgress[fileKey];
                    return newProgress;
                });
            }
        }

        // Add uploaded URLs to images
        if (uploadedUrls.length > 0) {
            setFormData(prev => ({
                ...prev,
                images: [...prev.images, ...uploadedUrls],
            }));
        }

        setUploading(false);
        setUploadProgress({});
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        handleFileUpload(e.dataTransfer.files);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const toggleAmenity = (amenity: string) => {
        setFormData(prev => ({
            ...prev,
            amenities: prev.amenities.includes(amenity)
                ? prev.amenities.filter(a => a !== amenity)
                : [...prev.amenities, amenity],
        }));
    };

    const removeImage = (index: number) => {
        setFormData(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index),
        }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                    <h2 className="text-2xl font-bold text-neutral-900">
                        {mode === 'create' ? 'Add New Room' : 'Edit Room'}
                    </h2>
                    <button onClick={onClose} className="text-neutral-600 hover:text-neutral-900 text-2xl">
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Room Type Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-neutral-700 mb-2">
                            Room Type *
                        </label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                            className="input-field"
                            required
                        >
                            {ROOM_TYPES.map((type) => (
                                <option key={type} value={type}>
                                    {type.charAt(0) + type.slice(1).toLowerCase()}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Room Numbers Section */}
                    {mode === 'create' ? (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <label className="block text-sm font-semibold text-neutral-700">
                                    Room Numbers & Floors *
                                </label>
                                <button
                                    type="button"
                                    onClick={addRoomEntry}
                                    className="text-sm text-brand-primary hover:text-brand-primary/80 font-medium flex items-center gap-1"
                                >
                                    <span>+</span> Add Another Room
                                </button>
                            </div>
                            <div className="space-y-3 max-h-60 overflow-y-auto">
                                {roomEntries.map((entry, index) => (
                                    <div key={index} className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg">
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                value={entry.roomNumber}
                                                onChange={(e) => updateRoomEntry(index, 'roomNumber', e.target.value)}
                                                placeholder="Room Number (e.g., 101)"
                                                className="input-field"
                                                required={index === 0}
                                            />
                                        </div>
                                        <div className="w-36">
                                            <select
                                                value={entry.floor ?? ''}
                                                onChange={(e) => updateRoomEntry(index, 'floor', e.target.value === '' ? null : parseInt(e.target.value))}
                                                className="input-field"
                                            >
                                                {FLOOR_OPTIONS.map((opt) => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        {roomEntries.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeRoomEntry(index)}
                                                className="text-red-500 hover:text-red-700 p-1"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-neutral-500 mt-2">
                                Add multiple rooms of the same type at once. Each room will have the same settings below.
                            </p>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                                    Room Number *
                                </label>
                                <input
                                    type="text"
                                    value={formData.roomNumber}
                                    onChange={(e) => setFormData(prev => ({ ...prev, roomNumber: e.target.value }))}
                                    className="input-field"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                                    Floor
                                </label>
                                <select
                                    value={formData.floor ?? ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, floor: e.target.value === '' ? null : parseInt(e.target.value) }))}
                                    className="input-field"
                                >
                                    {FLOOR_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Occupancy & Pricing Configuration */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <h4 className="text-sm font-bold text-blue-900 mb-4 flex items-center gap-2">
                            <span>👥</span> Occupancy & Pricing
                        </h4>
                        
                        <div className="grid md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                                    Base Occupancy *
                                </label>
                                <input
                                    type="number"
                                    value={formData.baseOccupancy}
                                    onChange={(e) => setFormData(prev => ({ 
                                        ...prev, 
                                        baseOccupancy: parseInt(e.target.value) || 1
                                    }))}
                                    className="input-field"
                                    min={1}
                                    max={6}
                                    required
                                />
                                <p className="text-xs text-neutral-500 mt-1">Guests included in base rate</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                                    Max Occupancy *
                                </label>
                                <input
                                    type="number"
                                    value={formData.maxOccupancy}
                                    onChange={(e) => setFormData(prev => ({ 
                                        ...prev, 
                                        maxOccupancy: parseInt(e.target.value) || 1
                                    }))}
                                    className="input-field"
                                    min={formData.baseOccupancy}
                                    max={8}
                                    required
                                />
                                <p className="text-xs text-neutral-500 mt-1">Maximum guests allowed</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                                    Size (sq ft) *
                                </label>
                                <input
                                    type="number"
                                    value={formData.size}
                                    onChange={(e) => setFormData(prev => ({ ...prev, size: parseInt(e.target.value) }))}
                                    className="input-field"
                                    min={100}
                                    required
                                />
                            </div>
                        </div>

                        {/* Extra Guest Pricing */}
                        {formData.maxOccupancy > formData.baseOccupancy && (
                            <div className="mt-4 pt-4 border-t border-blue-200">
                                <div className="flex items-center gap-4">
                                    <label className="text-sm font-medium text-neutral-700">
                                        Extra Guest Charge (per person/night):
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">₹</span>
                                        <input
                                            type="number"
                                            value={formData.extraGuestCharge}
                                            onChange={(e) => setFormData(prev => ({ 
                                                ...prev, 
                                                extraGuestCharge: parseInt(e.target.value) || 0 
                                            }))}
                                            className="input-field pl-8 w-32"
                                            min={0}
                                            step={100}
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-neutral-500 mt-2">
                                    This charge applies for each guest beyond {formData.baseOccupancy} (up to {formData.maxOccupancy} max)
                                </p>
                            </div>
                        )}

                        {/* Rate Preview */}
                        <div className="mt-4 pt-4 border-t border-blue-200 bg-white rounded-lg p-3">
                            <h5 className="text-xs font-semibold text-neutral-600 mb-2">RATE PREVIEW (per night)</h5>
                            <div className="space-y-1">
                                {Array.from({ length: formData.maxOccupancy }, (_, i) => i + 1).map(guests => {
                                    const extraGuests = Math.max(0, guests - formData.baseOccupancy);
                                    const totalRate = formData.baseRate + (extraGuests * formData.extraGuestCharge);
                                    return (
                                        <div key={guests} className="flex justify-between text-sm">
                                            <span className="text-neutral-600">
                                                {guests} Guest{guests > 1 ? 's' : ''}
                                                {guests <= formData.baseOccupancy && <span className="text-green-600 ml-1">(base)</span>}
                                            </span>
                                            <span className="font-semibold text-neutral-900">
                                                ₹{totalRate.toLocaleString()}
                                                {extraGuests > 0 && (
                                                    <span className="text-xs text-neutral-500 ml-1">
                                                        (+₹{(extraGuests * formData.extraGuestCharge).toLocaleString()})
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Base Rate */}
                    <div>
                        <label className="block text-sm font-semibold text-neutral-700 mb-2">
                            Base Rate (₹/night) *
                        </label>
                        <input
                            type="number"
                            value={formData.baseRate}
                            onChange={(e) => setFormData(prev => ({ ...prev, baseRate: parseInt(e.target.value) }))}
                            className="input-field"
                            min={500}
                            step={100}
                            required
                        />
                        <p className="text-xs text-neutral-500 mt-1">
                            Base rate for {formData.baseOccupancy} guest{formData.baseOccupancy > 1 ? 's' : ''}
                        </p>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-semibold text-neutral-700 mb-2">
                            Description *
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            className="input-field min-h-25"
                            required
                        />
                    </div>

                    {/* Amenities */}
                    <div>
                        <label className="block text-sm font-semibold text-neutral-700 mb-3">
                            Amenities
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-50 overflow-y-auto p-3 border border-neutral-200 rounded-lg">
                            {COMMON_AMENITIES.map((amenity) => (
                                <label key={amenity} className="flex items-center gap-2 cursor-pointer hover:bg-neutral-50 p-2 rounded">
                                    <input
                                        type="checkbox"
                                        checked={formData.amenities.includes(amenity)}
                                        onChange={() => toggleAmenity(amenity)}
                                        className="w-4 h-4 text-brand-primary rounded focus:ring-brand-primary"
                                    />
                                    <span className="text-sm text-neutral-700">{amenity}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Image Upload */}
                    <div>
                        <label className="block text-sm font-semibold text-neutral-700 mb-2">
                            Room Images
                        </label>

                        {/* Upload Area */}
                        <div
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center hover:border-brand-primary transition-colors cursor-pointer"
                        >
                            <input
                                type="file"
                                id="image-upload"
                                accept="image/jpeg,image/jpg,image/png,image/webp"
                                multiple
                                onChange={(e) => handleFileUpload(e.target.files)}
                                className="hidden"
                                disabled={uploading}
                            />
                            <label htmlFor="image-upload" className="cursor-pointer">
                                <div className="text-4xl mb-2">📸</div>
                                <p className="text-sm font-medium text-neutral-700">
                                    Drag and drop images or click to browse
                                </p>
                                <p className="text-xs text-neutral-500 mt-1">
                                    JPEG, PNG, WebP • Max 5MB per file
                                </p>
                            </label>
                        </div>

                        {/* Upload Progress */}
                        {Object.keys(uploadProgress).length > 0 && (
                            <div className="mt-3 space-y-2">
                                {Object.entries(uploadProgress).map(([key, progress]) => (
                                    <div key={key} className="flex items-center gap-2">
                                        <div className="flex-1 bg-neutral-200 rounded-full h-2">
                                            <div
                                                className="bg-brand-primary h-2 rounded-full transition-all"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-neutral-600">{progress}%</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Image Preview Grid */}
                        {formData.images.length > 0 && (
                            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                                {formData.images.map((img, index) => (
                                    <div key={index} className="relative group">
                                        <div className="aspect-video relative rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100">
                                            <Image
                                                src={img}
                                                alt={`Room image ${index + 1}`}
                                                fill
                                                className="object-cover"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeImage(index)}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-neutral-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary flex-1"
                            disabled={loading || uploading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-primary flex-1"
                            disabled={loading || uploading}
                        >
                            {loading ? 'Saving...' : uploading ? 'Uploading Images...' : mode === 'create' 
                                ? `Create ${roomEntries.filter(e => e.roomNumber.trim()).length} Room${roomEntries.filter(e => e.roomNumber.trim()).length !== 1 ? 's' : ''}` 
                                : 'Update Room'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
