'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { calculateBookingPriceBreakdown } from '@/lib/pricing';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GuestFormData {
    fullName: string;
    email: string;
    phone: string;
    idProofType: string;
    idProofNumber: string;
    locality: string;
    address: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
    arrivalTime?: string;
    reqEarlyCheckIn?: boolean;
    reqHighFloor?: boolean;
    reqQuietRoom?: boolean;
    reqSpecialOccasion?: boolean;
    specialRequests?: string;
}

interface PricingBreakdown {
    nights: number;
    roomTotal: number;
    extraGuestCharge: number;
    addonsTotal: number;
    subtotal: number;
    discountAmount: number;
    gstRate: number;
    gstAmount: number;
    totalAmount: number;
}

interface RazorpayCheckoutResponse {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
}

interface RazorpayInstance {
    open: () => void;
    on: (
        event: 'payment.failed',
        callback: (response: { error?: { description?: string } }) => void
    ) => void;
}

interface RazorpayOptions {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    order_id: string;
    prefill: { name: string; email: string; contact: string };
    notes: { bookingReference: string };
    theme: { color: string };
    handler: (response: RazorpayCheckoutResponse) => Promise<void>;
    modal: { ondismiss: () => void };
}

declare global {
    interface Window {
        Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
    }
}

// ─── ID Proof Formats ─────────────────────────────────────────────────────────

const ID_PROOF_CONFIGS = {
    aadhar: {
        label: 'Aadhaar Card',
        pattern: /^\d{12}$/,
        placeholder: '1234 5678 9012',
        hint: '12-digit Aadhaar number',
        mask: (v: string) =>
            v
                .replace(/\D/g, '')
                .slice(0, 12)
                .replace(/(\d{4})(?=\d)/g, '$1 ')
                .trim(),
    },
    passport: {
        label: 'Passport',
        pattern: /^[A-Z][1-9][0-9]{7}$/,
        placeholder: 'A1234567',
        hint: '1 letter + 7 digits (e.g. A1234567)',
        mask: (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8),
    },
    driving_license: {
        label: 'Driving License',
        pattern: /^[A-Z]{2}[0-9]{2}[0-9]{4}[0-9]{7}$/,
        placeholder: 'MH0120240123456',
        hint: 'State code + digits (e.g. MH0120240123456)',
        mask: (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15),
    },
    voter_id: {
        label: 'Voter ID',
        pattern: /^[A-Z]{3}[0-9]{7}$/,
        placeholder: 'ABC1234567',
        hint: '3 letters + 7 digits (e.g. ABC1234567)',
        mask: (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10),
    },
} as const;

type IdProofType = keyof typeof ID_PROOF_CONFIGS;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

function loadRazorpayScript() {
    return new Promise<boolean>((resolve) => {
        if (typeof window === 'undefined') return resolve(false);
        if (window.Razorpay) return resolve(true);
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
}

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

// ─── Pincode Autofill ─────────────────────────────────────────────────────────

interface PostalResult {
    Status: string;
    PostOffice: { Name: string; District: string; State: string; Country: string }[];
}

async function fetchPincodeData(pin: string): Promise<PostalResult | null> {
    try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
        if (!res.ok) return null;
        const data: PostalResult[] = await res.json();
        if (!Array.isArray(data) || data[0]?.Status !== 'Success') return null;
        return data[0];
    } catch {
        return null;
    }
}

// ─── Loading Fallback ─────────────────────────────────────────────────────────

function GuestDetailsLoading() {
    return (
        <div className="min-h-screen bg-[#f6f3ee] flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#1e2f27] mx-auto mb-4"></div>
                <p className="text-[#4f5c55]">Loading...</p>
            </div>
        </div>
    );
}

// ─── OTP Modal ────────────────────────────────────────────────────────────────

interface OtpModalProps {
    email: string;
    name: string;
    onVerified: () => void;
    onClose: () => void;
}

function OtpModal({ email, name, onVerified, onClose }: OtpModalProps) {
    const [otp, setOtp] = useState('      '); // 6 spaces as placeholders
    const [otpError, setOtpError] = useState<string | null>(null);
    const [verifying, setVerifying] = useState(false);
    const [sending, setSending] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [shake, setShake] = useState(false);
    const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
    const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        handleSendOtp();
        return () => {
            if (cooldownTimer.current) clearInterval(cooldownTimer.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        inputsRef.current[0]?.focus();
    }, []);

    async function handleSendOtp() {
        setSending(true);
        setOtpError(null);
        try {
            const res = await fetch('/api/auth/email-otp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, name }),
            });
            const data = await res.json();
            if (!res.ok) {
                if (data.cooldownRemainingSeconds) startCooldown(data.cooldownRemainingSeconds);
                setOtpError(data.error || 'Failed to send verification code.');
            }
        } catch {
            setOtpError('Network error. Please check your connection.');
        } finally {
            setSending(false);
        }
    }

    function startCooldown(seconds: number) {
        setCooldown(seconds);
        if (cooldownTimer.current) clearInterval(cooldownTimer.current);
        cooldownTimer.current = setInterval(() => {
            setCooldown((prev) => {
                if (prev <= 1) {
                    clearInterval(cooldownTimer.current!);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }

    const otpArray = otp.split('').slice(0, 6);

    function handleDigitChange(index: number, value: string) {
        const digit = value.replace(/\D/g, '').slice(-1);
        const next = [...otpArray];
        next[index] = digit || ' ';
        setOtp(next.join(''));
        setOtpError(null);
        if (digit && index < 5) inputsRef.current[index + 1]?.focus();
    }

    function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Backspace') {
            const next = [...otpArray];
            if (next[index].trim() === '' && index > 0) {
                next[index - 1] = ' ';
                setOtp(next.join(''));
                inputsRef.current[index - 1]?.focus();
            } else {
                next[index] = ' ';
                setOtp(next.join(''));
            }
        } else if (e.key === 'ArrowLeft' && index > 0) {
            inputsRef.current[index - 1]?.focus();
        } else if (e.key === 'ArrowRight' && index < 5) {
            inputsRef.current[index + 1]?.focus();
        }
    }

    function handlePaste(e: React.ClipboardEvent) {
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length > 0) {
            const padded = pasted.padEnd(6, ' ');
            setOtp(padded);
            const focusIdx = Math.min(pasted.length, 5);
            inputsRef.current[focusIdx]?.focus();
        }
        e.preventDefault();
    }

    async function handleVerify() {
        const cleanOtp = otp.replace(/\s/g, '');
        if (cleanOtp.length !== 6) {
            setOtpError('Please enter the complete 6-digit code.');
            return;
        }
        setVerifying(true);
        setOtpError(null);
        try {
            const res = await fetch('/api/auth/email-otp/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp: cleanOtp }),
            });
            const data = await res.json();
            if (res.ok && data.verified) {
                onVerified();
            } else {
                setShake(true);
                setTimeout(() => setShake(false), 600);
                setOtpError(data.error || 'Invalid code. Please try again.');
                if (data.reason === 'expired' || data.reason === 'locked') {
                    setOtp('      ');
                }
            }
        } catch {
            setOtpError('Verification failed. Please try again.');
        } finally {
            setVerifying(false);
        }
    }

    const cleanOtpLength = otp.replace(/\s/g, '').length;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(10,20,15,0.75)', backdropFilter: 'blur(6px)' }}
        >
            <style>{`
                @keyframes otp-shake {
                    0%, 100% { transform: translateX(0); }
                    20% { transform: translateX(-8px); }
                    40% { transform: translateX(8px); }
                    60% { transform: translateX(-5px); }
                    80% { transform: translateX(5px); }
                }
                .otp-shake { animation: otp-shake 0.5s ease-in-out; }
            `}</style>

            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-[#e0d5c7]">
                {/* Close */}
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 text-[#a8b5af] hover:text-[#17261f] transition-colors"
                    aria-label="Close"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-14 h-14 rounded-full bg-[#edf4ef] border border-[#cfdbd3] flex items-center justify-center mx-auto mb-4">
                        <svg className="w-7 h-7 text-[#17261f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h2 className="font-serif text-2xl text-[#17261f] mb-2">Verify Your Email</h2>
                    <p className="text-sm text-[#5f7068]">
                        We sent a 6-digit code to
                        <br />
                        <span className="font-semibold text-[#17261f]">{email}</span>
                    </p>
                    {sending && (
                        <p className="text-xs text-[#1f5e43] mt-2 animate-pulse">Sending code&hellip;</p>
                    )}
                </div>

                {/* Digit Inputs */}
                <div
                    className={`flex gap-2 justify-center mb-4 ${shake ? 'otp-shake' : ''}`}
                    onPaste={handlePaste}
                >
                    {otpArray.map((digit, i) => (
                        <input
                            key={i}
                            ref={(el) => {
                                inputsRef.current[i] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit.trim()}
                            onChange={(e) => handleDigitChange(i, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(i, e)}
                            className="w-12 h-14 text-center text-2xl font-bold font-mono rounded-xl border-2 outline-none transition-all"
                            style={{
                                borderColor: otpError ? '#ef4444' : digit.trim() ? '#1f5e43' : '#d1c5b4',
                                background: digit.trim() ? '#f0f8f3' : '#faf7f2',
                                color: '#17261f',
                            }}
                            aria-label={`Digit ${i + 1}`}
                        />
                    ))}
                </div>

                {/* Error */}
                {otpError && (
                    <p className="text-center text-red-600 text-sm mb-4">{otpError}</p>
                )}

                {/* Verify Button */}
                <button
                    onClick={handleVerify}
                    disabled={verifying || cleanOtpLength < 6}
                    className="w-full rounded-full bg-[#17261f] text-white py-3.5 text-sm tracking-[0.15em] uppercase hover:bg-[#22352c] transition-colors disabled:opacity-60 disabled:cursor-not-allowed mb-4"
                >
                    {verifying ? 'Verifying\u2026' : 'Verify & Continue'}
                </button>

                {/* Resend */}
                <p className="text-center text-sm text-[#7a8e82]">
                    Didn&apos;t receive it?{' '}
                    {cooldown > 0 ? (
                        <span className="text-[#9aab9e]">Resend in {cooldown}s</span>
                    ) : (
                        <button
                            onClick={() => {
                                setOtp('      ');
                                handleSendOtp();
                                startCooldown(60);
                            }}
                            disabled={sending}
                            className="text-[#17261f] font-semibold underline underline-offset-2 hover:opacity-70 transition-opacity disabled:opacity-40"
                        >
                            {sending ? 'Sending\u2026' : 'Resend Code'}
                        </button>
                    )}
                </p>

                <p className="text-center text-[10px] text-[#a8b5af] mt-5 tracking-wide">
                    Code expires in 10 minutes &middot; Never share this code
                </p>
            </div>
        </div>
    );
}

// ─── Main Page Content ────────────────────────────────────────────────────────

function GuestDetailsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pincodeLoading, setPincodeLoading] = useState(false);
    const [pincodeError, setPincodeError] = useState<string | null>(null);
    const [localities, setLocalities] = useState<string[]>([]);
    const pincodeDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

    // OTP flow state
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [emailVerified, setEmailVerified] = useState(false);
    const pendingFormData = useRef<GuestFormData | null>(null);

    // Coupon state
    const [couponCode, setCouponCode] = useState('');
    const [couponStatus, setCouponStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [couponMessage, setCouponMessage] = useState('');
    const [activeCoupon, setActiveCoupon] = useState<{ code: string; type: string; value: number } | null>(null);

    // ID proof document upload state
    const [idProofImageUrl, setIdProofImageUrl] = useState<string | null>(null);
    const [idProofUploading, setIdProofUploading] = useState(false);
    const [idProofUploadError, setIdProofUploadError] = useState<string | null>(null);
    const idProofInputRef = useRef<HTMLInputElement | null>(null);

    const handleIdProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Client-side validation
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            setIdProofUploadError('Only JPEG, PNG, or WebP images are allowed.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setIdProofUploadError('File too large. Maximum 5 MB.');
            return;
        }

        setIdProofUploading(true);
        setIdProofUploadError(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/upload/id-proof', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Upload failed');
            setIdProofImageUrl(data.url);
        } catch (err) {
            setIdProofUploadError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setIdProofUploading(false);
        }
    };

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm<GuestFormData>({
        defaultValues: { country: 'India' },
    });

    const selectedIdType = watch('idProofType') as IdProofType | '';
    const zipValue = watch('zipCode');
    const watchedEmail = watch('email');
    const watchedName = watch('fullName');

    const [cart, setCart] = useState<{ roomId: string; roomType: string; roomNumber: string; baseRate: number; weekendMultiplier: number; baseOccupancy: number; maxOccupancy: number; extraGuestChargePerNight: number }[]>([]);
    const roomId = searchParams.get('roomId');
    const roomType = searchParams.get('roomType');
    const checkIn = searchParams.get('checkIn');
    const checkOut = searchParams.get('checkOut');
    const guestsParam = searchParams.get('guests');
    const numberOfGuests = guestsParam ? parseInt(guestsParam, 10) || 2 : 2;

    // Capacity validation: guests must not exceed combined room maxOccupancy
    const totalCapacity = useMemo(() => cart.reduce((sum, r) => sum + (r.maxOccupancy ?? 3), 0), [cart]);
    const guestsExceedCapacity = cart.length > 0 && numberOfGuests > totalCapacity;
    // For pricing, clamp guests to capacity so the breakdown is still calculated (but submit will be blocked)
    const effectiveGuests = guestsExceedCapacity ? totalCapacity : numberOfGuests;

    const pricing = useMemo(() => {
        if (!checkIn || !checkOut || cart.length === 0) return null;
        return calculateBookingPriceBreakdown({
            rooms: cart.map((r: any) => ({
                roomId: r.roomId,
                baseRate: r.baseRate || 0,
                weekendMultiplier: r.weekendMultiplier ?? 1.2,
                baseOccupancy: r.baseOccupancy ?? 2,
                extraGuestChargePerNight: r.extraGuestChargePerNight ?? 0
            })),
            checkIn: new Date(checkIn),
            checkOut: new Date(checkOut),
            numberOfGuests: effectiveGuests,
            addons: [],
            coupon: activeCoupon ? { type: activeCoupon.type as 'PERCENTAGE' | 'FIXED', value: activeCoupon.value } : null
        });
    }, [cart, checkIn, checkOut, effectiveGuests, activeCoupon]);

    const latestTotal = pricing?.totalAmount ?? null;

    // Load cart from sessionStorage (multi-room) or fall back to URL param (single-room)
    useEffect(() => {
        const stored = typeof window !== 'undefined' ? sessionStorage.getItem('bookingCart') : null;
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setCart(parsed);
                    return;
                }
            } catch { /* ignore */ }
        }
        // Fallback: single room from URL params
        if (roomId && roomType) {
            setCart([{ roomId, roomType, roomNumber: roomId, baseRate: 0, weekendMultiplier: 1.2, baseOccupancy: 2, maxOccupancy: 3, extraGuestChargePerNight: 0 }]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const nights = useMemo(() => {
        if (!checkIn || !checkOut) return 0;
        return Math.max(
            1,
            Math.ceil(
                (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
                (1000 * 60 * 60 * 24)
            )
        );
    }, [checkIn, checkOut]);

    // ── Pincode autofill ──────────────────────────────────────────────────────
    const handlePincodeChange = useCallback(
        (pin: string) => {
            setPincodeError(null);
            if (pincodeDebounce.current) clearTimeout(pincodeDebounce.current);
            if (pin.length !== 6 || !/^\d{6}$/.test(pin)) return;

            pincodeDebounce.current = setTimeout(async () => {
                setPincodeLoading(true);
                const result = await fetchPincodeData(pin);
                setPincodeLoading(false);

                if (!result || !result.PostOffice?.[0]) {
                    setPincodeError('PIN code not found. Please enter a valid Indian PIN code.');
                    setLocalities([]);
                    return;
                }

                const poNames = result.PostOffice.map((po) => po.Name).filter(Boolean);
                setLocalities(poNames);
                if (poNames.length === 1) {
                    setValue('locality', poNames[0], { shouldValidate: true });
                }

                const po = result.PostOffice[0];
                setValue('city', po.District, { shouldValidate: true });
                setValue('state', po.State, { shouldValidate: true });
                setValue('country', po.Country || 'India', { shouldValidate: true });
            }, 600);
        },
        [setValue]
    );

    useEffect(() => {
        if (zipValue) handlePincodeChange(zipValue);
    }, [zipValue, handlePincodeChange]);

    // ── ID proof validation (dynamic per selected type) ───────────────────────
    const idProofNumberValidation = useMemo(() => {
        if (!selectedIdType || !(selectedIdType in ID_PROOF_CONFIGS)) {
            return { required: 'ID proof number is required' };
        }
        const config = ID_PROOF_CONFIGS[selectedIdType as IdProofType];
        return {
            required: 'ID proof number is required',
            validate: (v: string) => {
                const cleaned = v.replace(/\s/g, '').toUpperCase();
                return config.pattern.test(cleaned) || `Invalid format. ${config.hint}`;
            },
        };
    }, [selectedIdType]);

    // ── Missing params guard ──────────────────────────────────────────────────
    if (!checkIn || !checkOut || cart.length === 0) {
        return (
            <div className="min-h-screen bg-[#f6f3ee] flex items-center justify-center px-4">
                <div className="text-center bg-white border border-[#e7ddcf] rounded-3xl p-10 max-w-xl">
                    <h2 className="text-2xl md:text-3xl font-serif text-[#17261f] mb-4">
                        Missing Booking Details
                    </h2>
                    <p className="text-[#4f5c55] mb-6">
                        Please start from the booking page to select room and dates.
                    </p>
                    <Link
                        href="/book"
                        className="inline-flex items-center rounded-full bg-[#17261f] text-white px-6 py-3 text-sm tracking-[0.14em] uppercase hover:bg-[#22352c] transition-colors"
                    >
                        Go to Booking Page
                    </Link>
                </div>
            </div>
        );
    }

    // ── The actual booking + payment flow ─────────────────────────────────────
    const proceedToPayment = async (data: GuestFormData) => {
        setIsSubmitting(true);
        setError(null);

        try {
            // Step 1: Validate & create Razorpay order (NO DB write)
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // Multi-room cart mapped to API schema
                    cart: cart.map(r => ({
                        roomId: r.roomId,
                        roomType: r.roomType,
                        qty: 1
                    })),
                    checkIn,
                    checkOut,
                    numberOfGuests,
                    addons: [],
                    guest: {
                        fullName: data.fullName,
                        email: data.email,
                        phone: data.phone,
                        idProofType: data.idProofType,
                        idProofNumber: data.idProofNumber.replace(/\s/g, '').toUpperCase(),
                        idProofImageUrl: idProofImageUrl || undefined,
                        address: {
                            street: `${data.address}, ${data.locality}`,
                            city: data.city,
                            state: data.state,
                            country: data.country,
                            zipCode: data.zipCode,
                        },
                    },
                    specialRequests: [
                        data.arrivalTime ? `ETA: ${data.arrivalTime}` : null,
                        data.reqEarlyCheckIn ? 'Early Check-in' : null,
                        data.reqHighFloor ? 'High Floor' : null,
                        data.reqQuietRoom ? 'Quiet Room' : null,
                        data.reqSpecialOccasion ? 'Special Occasion' : null,
                        data.specialRequests
                    ].filter(Boolean).join(' | ') || undefined,
                    couponCode: activeCoupon ? activeCoupon.code : undefined,
                }),
            });

            if (!response.ok) {
                const errJson = await response.json().catch(() => null);
                throw new Error(errJson?.error || 'Unable to initiate booking');
            }

            const result = await response.json();

            if (!result.order?.id || typeof result.order.amount !== 'number') {
                throw new Error(
                    result.error || 'Payment order could not be initialized. Please try again.'
                );
            }

            if (!result.razorpayKey) {
                throw new Error(
                    'Razorpay key is missing. Please set RAZORPAY_KEY_ID in your environment.'
                );
            }

            if (!result.bookingToken) {
                throw new Error('Booking session token missing. Please try again.');
            }

            const scriptReady = await loadRazorpayScript();
            if (!scriptReady) {
                throw new Error('Unable to load payment gateway. Please check your connection.');
            }

            const RazorpayCtor = window.Razorpay;
            if (!RazorpayCtor) {
                throw new Error('Razorpay SDK unavailable. Please refresh and try again.');
            }

            // Step 2: Open Razorpay modal
            const rzp = new RazorpayCtor({
                key: result.razorpayKey,
                amount: result.order.amount,
                currency: result.order?.currency || 'INR',
                name: 'Studio next',
                description: `Booking ${result.bookingReference}`,
                order_id: result.order.id,
                prefill: {
                    name: data.fullName,
                    email: data.email,
                    contact: data.phone,
                },
                notes: { bookingReference: result.bookingReference },
                theme: { color: '#1e2f27' },
                handler: async (paymentResponse: RazorpayCheckoutResponse) => {
                    try {
                        // Step 3: Verify payment → create booking in DB
                        const verifyRes = await fetch('/api/payments/razorpay/verify', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                orderId: paymentResponse.razorpay_order_id,
                                paymentId: paymentResponse.razorpay_payment_id,
                                signature: paymentResponse.razorpay_signature,
                                bookingToken: result.bookingToken,
                            }),
                        });

                        if (!verifyRes.ok) {
                            const verifyErr = await verifyRes.json().catch(() => null);
                            throw new Error(
                                verifyErr?.error || 'Payment verification failed. Contact support.'
                            );
                        }

                        const verifyData = await verifyRes.json();
                        router.push(
                            `/book/confirmation?bookingRef=${verifyData.bookingReference ?? result.bookingReference}`
                        );
                    } catch (err: unknown) {
                        setError(getErrorMessage(err, 'Payment verification failed.'));
                        setIsSubmitting(false);
                    }
                },
                modal: { ondismiss: () => setIsSubmitting(false) },
            });

            rzp.on('payment.failed', (paymentFailure) => {
                const failureMessage =
                    paymentFailure?.error?.description || 'Payment failed. Please try again.';
                setError(failureMessage);
                setIsSubmitting(false);
            });

            rzp.open();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Something went wrong. Please try again.'));
            setIsSubmitting(false);
        }
    };

    // ── Form submit — gate by email OTP ──────────────────────────────────────
    const onSubmit = async (data: GuestFormData) => {
        setError(null);

        // Block if guests exceed room capacity
        if (guestsExceedCapacity) {
            setError(`${numberOfGuests} guests exceed the combined room capacity of ${totalCapacity}. Please go back and select more rooms or reduce guests.`);
            return;
        }

        if (!emailVerified) {
            // Store form data and show OTP modal
            pendingFormData.current = data;
            setShowOtpModal(true);
            return;
        }

        // Email already verified — go straight to payment
        await proceedToPayment(data);
    };

    // Called when OTP modal reports success
    const onEmailVerified = async () => {
        setShowOtpModal(false);
        setEmailVerified(true);
        if (pendingFormData.current) {
            await proceedToPayment(pendingFormData.current);
        }
    };

    // (Moved to above early return)
    return (
        <div className="min-h-screen bg-[#faf7f2] text-[#17261f]">
            {/* OTP Modal */}
            {showOtpModal && (
                <OtpModal
                    email={watchedEmail}
                    name={watchedName}
                    onVerified={onEmailVerified}
                    onClose={() => {
                        setShowOtpModal(false);
                        setIsSubmitting(false);
                    }}
                />
            )}

            {/* Header */}
            <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#faf7f2]/92 border-b border-[#e7ddcf]">
                <div className="container-custom py-4 flex items-center justify-between gap-4">
                    <Link href="/" className="group flex items-center gap-3">
                        <Image
                            src="/logo.png"
                            alt="Studio next logo"
                            width={40}
                            height={40}
                            className="h-10 w-10 object-contain transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="leading-tight">
                            <p className="text-xl md:text-2xl font-serif tracking-tight">Studio next</p>
                            <p className="text-[9px] tracking-[0.28em] text-[#8a6b3a] uppercase">
                                The Heart Of The Hills
                            </p>
                        </div>
                    </Link>
                    <Link
                        href="/book"
                        className="text-[11px] md:text-xs tracking-[0.2em] uppercase text-[#435149] hover:text-[#17261f] transition-colors"
                    >
                        Back to Rooms
                    </Link>
                </div>
            </header>

            <main className="container-custom py-10 md:py-14">
                {/* Hero banner */}
                <div className="mb-10 rounded-3xl border border-[#d8c7af] bg-[linear-gradient(120deg,#15291f_0%,#244435_48%,#2a5540_100%)] p-8 md:p-12 text-white shadow-[0_25px_65px_-40px_rgba(0,0,0,0.78)]">
                    <p className="text-[11px] md:text-xs tracking-[0.24em] uppercase text-[#dcc59d] mb-4 font-semibold">
                        Final Step
                    </p>
                    <h1 className="font-serif text-4xl md:text-5xl leading-tight mb-3 tracking-tight">
                        Guest Details &amp; Secure Payment
                    </h1>
                    <p className="text-[#e8eee9] max-w-2xl leading-relaxed">
                        Your email will be verified with a one-time code before payment — this prevents fake bookings.
                    </p>
                </div>

                {/* Steps */}
                <div className="mb-8 grid grid-cols-4 gap-2 md:gap-3 text-center text-[10px] md:text-[11px] tracking-[0.16em] uppercase font-semibold">
                    <div className="rounded-full px-2 py-2 bg-[#dfe8e2] text-[#17261f] border border-[#cfdbd3]">Dates</div>
                    <div className="rounded-full px-2 py-2 bg-[#dfe8e2] text-[#17261f] border border-[#cfdbd3]">Room</div>
                    <div className="rounded-full px-2 py-2 bg-[#17261f] text-white border border-[#17261f]">Details</div>
                    <div className="rounded-full px-2 py-2 bg-[#ece4d8] text-[#5f6c64] border border-[#e2d7c6]">Payment</div>
                </div>

                {/* Email verification badge (shown after verification) */}
                {emailVerified && (
                    <div className="mb-6 flex items-center gap-2 rounded-2xl border border-[#c4e0cb] bg-[#edf8f1] px-5 py-3 text-sm text-[#1e5c33]">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>
                            Email verified — <span className="font-semibold">{watchedEmail}</span>
                        </span>
                    </div>
                )}

                <div className="grid lg:grid-cols-[minmax(0,1fr)_330px] gap-7">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                        {/* ── Personal Details ── */}
                        <section className="rounded-3xl border border-[#e6dccf] bg-white p-6 md:p-7">
                            <h2 className="text-2xl font-serif mb-5">Personal Details</h2>
                            <div className="grid md:grid-cols-2 gap-5">

                                {/* Full Name */}
                                <div>
                                    <label className="block text-sm font-semibold text-[#405148] mb-2">
                                        Full Name *
                                    </label>
                                    <input
                                        id="fullName"
                                        type="text"
                                        {...register('fullName', {
                                            required: 'Full name is required',
                                            minLength: { value: 2, message: 'Name must be at least 2 characters' },
                                        })}
                                        className="w-full rounded-xl border border-[#d9cdbd] bg-[#fbf8f3] px-4 py-3 outline-none focus:border-[#1f5e43] transition-colors"
                                        placeholder="Rajesh Sharma"
                                        autoComplete="name"
                                    />
                                    {errors.fullName && (
                                        <p className="text-red-600 text-sm mt-1">{errors.fullName.message}</p>
                                    )}
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-sm font-semibold text-[#405148] mb-2">
                                        Email Address *{' '}
                                        {emailVerified && (
                                            <span className="text-[#1f8a4c] font-normal text-xs">✓ Verified</span>
                                        )}
                                    </label>
                                    <input
                                        id="email"
                                        type="email"
                                        {...register('email', {
                                            required: 'Email is required',
                                            pattern: {
                                                value: /^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$/i,
                                                message: 'Enter a valid email address',
                                            },
                                        })}
                                        className="w-full rounded-xl border border-[#d9cdbd] bg-[#fbf8f3] px-4 py-3 outline-none focus:border-[#1f5e43] transition-colors"
                                        placeholder="rajesh@example.com"
                                        autoComplete="email"
                                        readOnly={emailVerified}
                                        onChange={() => {
                                            // If user changes email after verification, reset
                                            if (emailVerified) setEmailVerified(false);
                                        }}
                                    />
                                    {errors.email && (
                                        <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>
                                    )}
                                    {!emailVerified && (
                                        <p className="text-[#7a8e82] text-xs mt-1">
                                            📧 A 6-digit OTP will be sent to this email to verify it&apos;s real.
                                        </p>
                                    )}
                                </div>

                                {/* Phone */}
                                <div>
                                    <label className="block text-sm font-semibold text-[#405148] mb-2">
                                        Mobile Number *{' '}
                                        <span className="text-[#7a8e82] font-normal">(Indian)</span>
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6b7a72] text-sm font-medium select-none">
                                            +91
                                        </span>
                                        <input
                                            id="phone"
                                            type="tel"
                                            {...register('phone', {
                                                required: 'Mobile number is required',
                                                pattern: {
                                                    value: /^[6-9]\d{9}$/,
                                                    message:
                                                        'Enter a valid 10-digit Indian mobile number (starts with 6-9)',
                                                },
                                            })}
                                            className="w-full rounded-xl border border-[#d9cdbd] bg-[#fbf8f3] pl-12 pr-4 py-3 outline-none focus:border-[#1f5e43] transition-colors"
                                            placeholder="9876543210"
                                            maxLength={10}
                                            autoComplete="tel"
                                        />
                                    </div>
                                    {errors.phone && (
                                        <p className="text-red-600 text-sm mt-1">{errors.phone.message}</p>
                                    )}
                                </div>

                                {/* ID Proof Type */}
                                <div>
                                    <label className="block text-sm font-semibold text-[#405148] mb-2">
                                        ID Proof Type *
                                    </label>
                                    <select
                                        id="idProofType"
                                        {...register('idProofType', {
                                            required: 'Please select an ID proof type',
                                        })}
                                        className="w-full rounded-xl border border-[#d9cdbd] bg-[#fbf8f3] px-4 py-3 outline-none focus:border-[#1f5e43] transition-colors appearance-none"
                                    >
                                        <option value="">Select ID proof type</option>
                                        {Object.entries(ID_PROOF_CONFIGS).map(([key, cfg]) => (
                                            <option key={key} value={key}>
                                                {cfg.label}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.idProofType && (
                                        <p className="text-red-600 text-sm mt-1">{errors.idProofType.message}</p>
                                    )}
                                </div>

                                {/* ID Proof Number */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-[#405148] mb-2">
                                        ID Proof Number *
                                        {selectedIdType && selectedIdType in ID_PROOF_CONFIGS && (
                                            <span className="ml-2 text-[#7a8e82] font-normal text-xs">
                                                {ID_PROOF_CONFIGS[selectedIdType as IdProofType].hint}
                                            </span>
                                        )}
                                    </label>
                                    <input
                                        id="idProofNumber"
                                        type="text"
                                        {...register('idProofNumber', idProofNumberValidation)}
                                        className="w-full rounded-xl border border-[#d9cdbd] bg-[#fbf8f3] px-4 py-3 outline-none focus:border-[#1f5e43] transition-colors font-mono tracking-wider"
                                        placeholder={
                                            selectedIdType && selectedIdType in ID_PROOF_CONFIGS
                                                ? ID_PROOF_CONFIGS[selectedIdType as IdProofType].placeholder
                                                : 'Select ID type first'
                                        }
                                        disabled={!selectedIdType}
                                        onChange={(e) => {
                                            if (selectedIdType && selectedIdType in ID_PROOF_CONFIGS) {
                                                const masked =
                                                    ID_PROOF_CONFIGS[selectedIdType as IdProofType].mask(
                                                        e.target.value
                                                    );
                                                e.target.value = masked;
                                            }
                                        }}
                                    />
                                    {errors.idProofNumber && (
                                        <p className="text-red-600 text-sm mt-1">
                                            {errors.idProofNumber.message}
                                        </p>
                                    )}
                                    {!selectedIdType && (
                                        <p className="text-[#7a8e82] text-xs mt-1">
                                            Select an ID type above to enable this field
                                        </p>
                                    )}
                                </div>

                                {/* ID Proof Document Upload */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-[#405148] mb-2">
                                        Upload ID Proof Document
                                        <span className="ml-2 text-[#7a8e82] font-normal text-xs">
                                            Photo of your ID card (JPEG, PNG, WebP — max 5 MB)
                                        </span>
                                    </label>

                                    {idProofImageUrl ? (
                                        <div className="relative group rounded-xl border border-[#c4e0cb] bg-[#f0f8f3] p-4">
                                            <div className="flex items-start gap-4">
                                                <img
                                                    src={idProofImageUrl}
                                                    alt="Uploaded ID proof"
                                                    className="w-28 h-20 object-cover rounded-lg border border-[#d9cdbd] shadow-sm"
                                                />
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-[#1f5e43] flex items-center gap-2">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        Document uploaded successfully
                                                    </p>
                                                    <p className="text-xs text-[#7a8e82] mt-1">
                                                        Your ID proof image has been securely uploaded.
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIdProofImageUrl(null);
                                                            if (idProofInputRef.current) idProofInputRef.current.value = '';
                                                        }}
                                                        className="mt-2 text-xs text-red-600 hover:text-red-800 font-medium underline underline-offset-2"
                                                    >
                                                        Remove & re-upload
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            className={`relative rounded-xl border-2 border-dashed transition-colors ${
                                                idProofUploading
                                                    ? 'border-[#1f5e43] bg-[#f0f8f3]'
                                                    : 'border-[#d9cdbd] bg-[#fbf8f3] hover:border-[#1f5e43] hover:bg-[#f7f4ef]'
                                            } cursor-pointer`}
                                            onClick={() => idProofInputRef.current?.click()}
                                        >
                                            <input
                                                ref={idProofInputRef}
                                                type="file"
                                                accept="image/jpeg,image/jpg,image/png,image/webp"
                                                className="hidden"
                                                onChange={handleIdProofUpload}
                                                disabled={idProofUploading}
                                            />
                                            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                                                {idProofUploading ? (
                                                    <>
                                                        <div className="w-8 h-8 border-2 border-[#1f5e43] border-t-transparent rounded-full animate-spin mb-3" />
                                                        <p className="text-sm font-medium text-[#1f5e43]">Uploading document…</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-10 h-10 text-[#a8b5af] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                        <p className="text-sm font-medium text-[#405148]">
                                                            Click to upload or drag your ID photo
                                                        </p>
                                                        <p className="text-xs text-[#7a8e82] mt-1">
                                                            Aadhaar, Passport, Driving License, or Voter ID
                                                        </p>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {idProofUploadError && (
                                        <p className="text-red-600 text-sm mt-2">{idProofUploadError}</p>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* ── Address Details ── */}
                        <section className="rounded-3xl border border-[#e6dccf] bg-white p-6 md:p-7">
                            <h2 className="text-2xl font-serif mb-1">Address Details</h2>
                            <p className="text-sm text-[#7a8e82] mb-5">
                                Enter your 6-digit PIN code first to securely validate your locality.
                            </p>
                            <div className="space-y-5">
                                <div className="grid md:grid-cols-2 gap-5">
                                    {/* PIN Code */}
                                    <div>
                                        <label className="block text-sm font-semibold text-[#405148] mb-2">
                                            PIN Code *{' '}
                                            {pincodeLoading && (
                                                <span className="ml-1 text-xs text-[#1f5e43] font-normal animate-pulse">
                                                    Validating&hellip;
                                                </span>
                                            )}
                                        </label>
                                        <input
                                            id="zipCode"
                                            type="text"
                                            {...register('zipCode', {
                                                required: 'PIN code is required',
                                                pattern: {
                                                    value: /^\d{6}$/,
                                                    message: 'Enter a valid 6-digit PIN code',
                                                },
                                            })}
                                            className="w-full rounded-xl border border-[#d9cdbd] bg-[#fbf8f3] px-4 py-3 outline-none focus:border-[#1f5e43] transition-colors"
                                            placeholder="400001"
                                            maxLength={6}
                                            autoComplete="postal-code"
                                        />
                                        {errors.zipCode && (
                                            <p className="text-red-600 text-sm mt-1">{errors.zipCode.message}</p>
                                        )}
                                        {pincodeError && !errors.zipCode && (
                                            <p className="text-amber-600 text-xs mt-1">{pincodeError}</p>
                                        )}
                                    </div>

                                    {/* Locality Dropdown (Auto-populated by Pincode) */}
                                    <div>
                                        <label className="block text-sm font-semibold text-[#405148] mb-2">
                                            Area / Locality *
                                        </label>
                                        <select
                                            id="locality"
                                            disabled={localities.length === 0}
                                            {...register('locality', { required: 'Please select a locality' })}
                                            className="w-full rounded-xl border border-[#d9cdbd] bg-[#fbf8f3] px-4 py-3 outline-none focus:border-[#1f5e43] transition-colors appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            <option value="">
                                                {localities.length === 0 ? 'Enter PIN Code first' : 'Select your area'}
                                            </option>
                                            {localities.map((loc) => (
                                                <option key={loc} value={loc}>
                                                    {loc}
                                                </option>
                                            ))}
                                        </select>
                                        {errors.locality && (
                                            <p className="text-red-600 text-sm mt-1">{errors.locality.message}</p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-[#405148] mb-2">
                                        House No. / Street Address *
                                    </label>
                                    <input
                                        id="address"
                                        type="text"
                                        {...register('address', { required: 'Street address is required' })}
                                        className="w-full rounded-xl border border-[#d9cdbd] bg-[#fbf8f3] px-4 py-3 outline-none focus:border-[#1f5e43] transition-colors"
                                        placeholder="Flat 101, Building B..."
                                        autoComplete="street-address"
                                    />
                                    {errors.address && (
                                        <p className="text-red-600 text-sm mt-1">{errors.address.message}</p>
                                    )}
                                </div>

                                <div className="grid md:grid-cols-2 gap-5 pointer-events-none opacity-80">

                                    {/* City */}
                                    <div>
                                        <label className="block text-sm font-semibold text-[#405148] mb-2">
                                            City *
                                        </label>
                                        <input
                                            id="city"
                                            type="text"
                                            {...register('city', { required: 'City is required' })}
                                            className="w-full rounded-xl border border-[#d9cdbd] bg-[#fbf8f3] px-4 py-3 outline-none focus:border-[#1f5e43] transition-colors"
                                            placeholder="Mumbai (auto-filled)"
                                            autoComplete="address-level2"
                                        />
                                        {errors.city && (
                                            <p className="text-red-600 text-sm mt-1">{errors.city.message}</p>
                                        )}
                                    </div>

                                    {/* State */}
                                    <div>
                                        <label className="block text-sm font-semibold text-[#405148] mb-2">
                                            State *
                                        </label>
                                        <input
                                            id="state"
                                            type="text"
                                            {...register('state', { required: 'State is required' })}
                                            className="w-full rounded-xl border border-[#d9cdbd] bg-[#fbf8f3] px-4 py-3 outline-none focus:border-[#1f5e43] transition-colors"
                                            placeholder="Maharashtra (auto-filled)"
                                            autoComplete="address-level1"
                                        />
                                        {errors.state && (
                                            <p className="text-red-600 text-sm mt-1">{errors.state.message}</p>
                                        )}
                                    </div>

                                    {/* Country */}
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-semibold text-[#405148] mb-2">
                                            Country *
                                        </label>
                                        <input
                                            id="country"
                                            type="text"
                                            readOnly
                                            {...register('country', { required: 'Country is required' })}
                                            className="w-full rounded-xl border border-[#d9cdbd] bg-[#fbf8f3] px-4 py-3 outline-none focus:border-[#1f5e43] transition-colors"
                                        />
                                        {errors.country && (
                                            <p className="text-red-600 text-sm mt-1">{errors.country.message}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* ── Special Requests & Arrival ── */}
                        <section className="rounded-3xl border border-[#e6dccf] bg-white p-6 md:p-7">
                            <h2 className="text-2xl font-serif mb-5">Enhance Your Stay</h2>

                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-[#405148] mb-3">
                                    Estimated Arrival Time (Optional)
                                </label>
                                <select
                                    {...register('arrivalTime')}
                                    className="w-full md:w-1/2 rounded-xl border border-[#d9cdbd] bg-[#fbf8f3] px-4 py-3 outline-none focus:border-[#1f5e43] transition-colors appearance-none"
                                >
                                    <option value="">I don't know yet</option>
                                    <option value="11:00 AM - 1:00 PM">11:00 AM - 1:00 PM</option>
                                    <option value="1:00 PM - 3:00 PM">1:00 PM - 3:00 PM</option>
                                    <option value="3:00 PM - 5:00 PM">3:00 PM - 5:00 PM</option>
                                    <option value="5:00 PM - 7:00 PM">5:00 PM - 7:00 PM</option>
                                    <option value="7:00 PM - 9:00 PM">7:00 PM - 9:00 PM</option>
                                    <option value="Late Night (After 9:00 PM)">Late Night (After 9:00 PM)</option>
                                </select>
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-[#405148] mb-3">
                                    Common Requests (Subject to availability)
                                </label>
                                <div className="grid grid-cols-2 gap-3 text-sm text-[#4f5c55]">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" {...register('reqEarlyCheckIn')} className="w-4 h-4 rounded border-[#d9cdbd] text-[#1f5e43] focus:ring-[#1f5e43]" />
                                        Early Check-in
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" {...register('reqHighFloor')} className="w-4 h-4 rounded border-[#d9cdbd] text-[#1f5e43] focus:ring-[#1f5e43]" />
                                        High Floor
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" {...register('reqQuietRoom')} className="w-4 h-4 rounded border-[#d9cdbd] text-[#1f5e43] focus:ring-[#1f5e43]" />
                                        Quiet Room
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" {...register('reqSpecialOccasion')} className="w-4 h-4 rounded border-[#d9cdbd] text-[#1f5e43] focus:ring-[#1f5e43]" />
                                        Special Occasion
                                    </label>
                                </div>
                            </div>

                            <label className="block text-sm font-semibold text-[#405148] mb-3">
                                Other Requests
                            </label>
                            <textarea
                                id="specialRequests"
                                {...register('specialRequests')}
                                className="w-full rounded-xl border border-[#d9cdbd] bg-[#fbf8f3] px-4 py-3 min-h-24 outline-none focus:border-[#1f5e43] transition-colors resize-none text-sm"
                                placeholder="Dietary needs, allergies..."
                            />
                        </section>

                        {error && (
                            <div className="bg-red-50 text-red-700 border border-red-100 rounded-xl px-4 py-3 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            id="proceed-to-pay-btn"
                            disabled={isSubmitting}
                            className="w-full rounded-full bg-[#17261f] text-white py-3.5 text-sm tracking-[0.15em] uppercase hover:bg-[#22352c] transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isSubmitting
                                ? 'Processing\u2026'
                                : emailVerified
                                    ? 'Proceed to Payment'
                                    : 'Verify Email & Continue'}
                        </button>
                        <p className="text-center text-xs text-[#7a8e82]">
                            Your email is verified first, then your booking is only confirmed after
                            successful payment.
                        </p>
                    </form>

                    {/* ── Booking Snapshot ── */}
                    <aside className="lg:sticky lg:top-28 h-fit rounded-3xl border border-[#dccfbf] bg-white p-6 md:p-7 shadow-[0_18px_38px_-30px_rgba(0,0,0,0.7)]">
                        <p className="text-xs tracking-[0.18em] uppercase text-[#7a867f] mb-2">
                            Booking Snapshot
                        </p>
                        <h2 className="font-serif text-2xl mb-5">Your Stay</h2>

                        <div className="space-y-3 mb-6 text-sm">
                            <div className="flex items-start justify-between gap-2">
                                <span className="text-[#5d6a63] flex-shrink-0">{cart.length > 1 ? 'Rooms' : 'Room'}</span>
                                <span className="font-semibold text-[#17261f] text-right">
                                    {cart.length === 0
                                        ? 'Loading...'
                                        : cart.map(r => r.roomType.replace('_', ' ')).join(', ')}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[#5d6a63]">Guests</span>
                                <span className={`font-semibold ${guestsExceedCapacity ? 'text-red-600' : 'text-[#17261f]'}`}>{numberOfGuests}</span>
                            </div>
                            {guestsExceedCapacity && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                                    <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    <div>
                                        <p className="text-xs font-semibold text-red-800">{numberOfGuests} guests exceeds room capacity ({totalCapacity} max)</p>
                                        <p className="text-[11px] text-red-600 mt-0.5">Go back and select more rooms to proceed.</p>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <span className="text-[#5d6a63]">Nights</span>
                                <span className="font-semibold text-[#17261f]">{nights}</span>
                            </div>
                        </div>

                        {/* ── Coupon Code Module ── */}
                        <div className="mb-6 border-t border-[#eadcc8] pt-5">
                            <p className="text-xs uppercase tracking-[0.14em] text-[#6f7d74] mb-3">Have a Coupon?</p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={couponCode}
                                    onChange={(e) => {
                                        setCouponCode(e.target.value.toUpperCase());
                                        if (couponStatus !== 'idle') {
                                            setCouponStatus('idle');
                                            setCouponMessage('');
                                        }
                                        if (activeCoupon) {
                                            setActiveCoupon(null);
                                        }
                                    }}
                                    disabled={couponStatus === 'loading'}
                                    className="w-full rounded-lg border border-[#d9cdbd] bg-[#fbf8f3] px-3 py-2 outline-none focus:border-[#1f5e43] text-sm uppercase tracking-wide disabled:opacity-50"
                                    placeholder="ENTER CODE"
                                />
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!couponCode) return;
                                        setCouponStatus('loading');
                                        try {
                                            const res = await fetch('/api/coupons/validate', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ code: couponCode }),
                                            });
                                            const data = await res.json();
                                            if (!res.ok) {
                                                setCouponStatus('error');
                                                setCouponMessage(data.error || 'Invalid code');
                                                setActiveCoupon(null);
                                            } else {
                                                setCouponStatus('success');
                                                setCouponMessage(`Discount Applied!`);
                                                setActiveCoupon({
                                                    code: data.coupon.code,
                                                    type: data.coupon.discountType,
                                                    value: data.coupon.discountValue,
                                                });
                                            }
                                        } catch {
                                            setCouponStatus('error');
                                            setCouponMessage('Error applying coupon');
                                        }
                                    }}
                                    disabled={couponStatus === 'loading' || !couponCode}
                                    className="px-4 rounded-lg bg-[#22352c] text-white text-xs tracking-wider uppercase disabled:opacity-50 hover:bg-[#17261f] transition"
                                >
                                    {couponStatus === 'loading' ? '...' : 'Apply'}
                                </button>
                            </div>
                            {couponMessage && (
                                <p className={`text-xs mt-2 ${couponStatus === 'success' ? 'text-[#1f8a4c] font-medium' : 'text-red-500'}`}>
                                    {couponMessage}
                                </p>
                            )}
                        </div>

                        <div className="rounded-2xl bg-[#f7f1e7] border border-[#eadcc8] p-4 mb-6 space-y-2">
                            <div>
                                <p className="text-xs uppercase tracking-[0.14em] text-[#6f7d74] mb-1">Check-in (From 11:00 AM)</p>
                                <p className="font-medium text-[#17261f]">{formatDate(checkIn)}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.14em] text-[#6f7d74] mb-1">Check-out (Until 10:00 AM)</p>
                                <p className="font-medium text-[#17261f]">{formatDate(checkOut)}</p>
                            </div>
                        </div>

                        {pricing && (
                            <div className="text-sm text-[#4c5e55] space-y-2 mb-5">
                                <div className="flex justify-between">
                                    <span>Room total</span>
                                    <span className="font-semibold text-[#17261f]">
                                        &#8377;{pricing.roomTotal.toLocaleString('en-IN')}
                                    </span>
                                </div>
                                {pricing.extraGuestCharge > 0 && (
                                    <div className="flex justify-between">
                                        <span>Extra guests</span>
                                        <span className="font-semibold text-[#17261f]">
                                            &#8377;{pricing.extraGuestCharge.toLocaleString('en-IN')}
                                        </span>
                                    </div>
                                )}
                                {pricing.discountAmount > 0 && (
                                    <div className="flex justify-between text-[#1f8a4c]">
                                        <span>Coupon Discount</span>
                                        <span className="font-semibold">
                                            -&#8377;{pricing.discountAmount.toLocaleString('en-IN')}
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span>GST ({Math.round(pricing.gstRate * 100)}%)</span>
                                    <span className="font-semibold text-[#17261f]">
                                        &#8377;{pricing.gstAmount.toLocaleString('en-IN')}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="rounded-2xl bg-[#173126] text-white p-5">
                            <p className="text-xs uppercase tracking-[0.14em] text-[#c8d4cd] mb-1">
                                Total Payable
                            </p>
                            <p className="font-serif text-3xl">
                                {latestTotal
                                    ? `\u20B9${latestTotal.toLocaleString('en-IN')}`
                                    : 'Calculating...'}
                            </p>
                        </div>

                        <div className="flex flex-col items-center mt-5 text-center">
                            <div className="flex gap-3 mt-4 items-center justify-center opacity-80 hover:opacity-100 transition-all duration-300">
                                <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo-vector.svg" alt="UPI" className="h-[14px] w-auto object-contain" />
                                <img src="/images/payments/Visa_Inc.-Logo.wine.svg" alt="Visa" className="h-[22px] w-auto object-contain shrink-0" />
                                <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-[16px] w-auto object-contain" />
                                <img src="https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg" alt="Google Pay" className="h-[14px] w-auto object-contain" />
                            </div>
                        </div>
                    </aside>
                </div>
            </main>
        </div>
    );
}

export default function GuestDetailsPage() {
    return (
        <Suspense fallback={<GuestDetailsLoading />}>
            <GuestDetailsContent />
        </Suspense>
    );
}
