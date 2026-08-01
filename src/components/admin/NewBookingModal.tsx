'use client';

import { useEffect, useMemo, useState } from 'react';
import { DateRangePicker } from '@/components/DateRangePicker';
import { calculateBookingPriceBreakdown } from '@/lib/pricing';
import { distributeGuests } from '@/lib/guest-distribution';

// ─── Types ────────────────────────────────────────────────────────────────────

type RoomOption = {
  id: string;
  label: string;
  baseRate: number;
  weekendMultiplier: number;
  baseOccupancy: number;
  maxOccupancy: number;
  extraGuestCharge: number;
  roomNumber: string;
  type: string;
};

interface NewBookingModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

// ─── Price Breakdown Component ────────────────────────────────────────────────

function PriceBreakdown({
  rooms,
  guestDistribution,
  nights,
  checkIn,
  checkOut,
  numberOfGuests,
  overrideRateMultiplier,
}: {
  rooms: RoomOption[];
  guestDistribution: number[];
  nights: number;
  checkIn: Date;
  checkOut: Date;
  numberOfGuests: number;
  overrideRateMultiplier: number | null;
}) {
  // Calculate each room independently with its DISTRIBUTED guest count
  const perRoomBreakdowns = useMemo(() => {
    if (rooms.length === 0 || nights === 0 || guestDistribution.length !== rooms.length) return [];
    return rooms.map((r, i) =>
      calculateBookingPriceBreakdown({
        rooms: [{
          roomId: r.id,
          baseRate: overrideRateMultiplier !== null ? r.baseRate * overrideRateMultiplier : r.baseRate,
          weekendMultiplier: r.weekendMultiplier,
          baseOccupancy: r.baseOccupancy,
          extraGuestChargePerNight: r.extraGuestCharge,
        }],
        checkIn,
        checkOut,
        numberOfGuests: guestDistribution[i], // per-room guest count!
        addons: [],
      })
    );
  }, [rooms, guestDistribution, nights, checkIn, checkOut, overrideRateMultiplier]);

  if (perRoomBreakdowns.length === 0) return null;

  // Grand totals across all rooms
  const grandSubtotal   = perRoomBreakdowns.reduce((s, b) => s + b.subtotal, 0);
  const grandGst        = perRoomBreakdowns.reduce((s, b) => s + b.gstAmount, 0);
  const grandTotal      = perRoomBreakdowns.reduce((s, b) => s + b.totalAmount, 0);
  const totalRoomCharge = perRoomBreakdowns.reduce((s, b) => s + b.roomTotal, 0);
  const totalExtraGuest = perRoomBreakdowns.reduce((s, b) => s + b.extraGuestCharge, 0);
  const weekendNights   = perRoomBreakdowns[0]?.weekendNights ?? 0;
  const firstGstPct     = Math.round((perRoomBreakdowns[0]?.gstRate ?? 0) * 100);

  const multiRoom = rooms.length > 1;

  return (
    <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 overflow-hidden">
      <div className="px-4 py-2.5 bg-teal-100 border-b border-teal-200 flex items-center justify-between">
        <p className="text-xs font-semibold text-teal-800 uppercase tracking-wide">Price Breakdown</p>
        {multiRoom && (
          <p className="text-[10px] text-teal-600">{rooms.length} rooms · {nights} night{nights > 1 ? 's' : ''} each</p>
        )}
      </div>

      <div className="px-4 py-3 space-y-1.5 text-sm">

        {/* Per-room lines (only when >1 room selected) */}
        {multiRoom && perRoomBreakdowns.map((b, i) => {
          const room = rooms[i];
          const gstPct = Math.round(b.gstRate * 100);
          return (
            <div key={room.id} className="pb-2 mb-2 border-b border-teal-100 last:border-0 last:mb-0 last:pb-0">
              <div className="flex justify-between text-neutral-600 font-medium text-xs mb-1">
                <span>Room {room.roomNumber} ({room.type})</span>
                <span>₹{(overrideRateMultiplier !== null ? room.baseRate * overrideRateMultiplier : room.baseRate).toLocaleString('en-IN')}/night</span>
              </div>
              <div className="flex justify-between text-neutral-500 text-xs pl-2">
                <span>
                  {nights} night{nights > 1 ? 's' : ''}
                  {weekendNights > 0 && <span className="text-amber-600 ml-1">({weekendNights} wknd)</span>}
                </span>
                <span>₹{b.roomTotal.toLocaleString('en-IN')}</span>
              </div>
              {b.extraGuestCharge > 0 && (
                <div className="flex justify-between text-xs pl-2 text-amber-700">
                  <span>Extra guest ({numberOfGuests - room.baseOccupancy} extra × {nights}n)</span>
                  <span>+₹{b.extraGuestCharge.toLocaleString('en-IN')}</span>
                </div>
              )}
              {gstPct > 0 && (
                <div className="flex justify-between text-xs pl-2 text-neutral-400">
                  <span>GST ({gstPct}%)</span>
                  <span>₹{b.gstAmount.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>
          );
        })}

        {/* Single room summary lines */}
        {!multiRoom && (
          <>
            <div className="flex justify-between text-neutral-700">
              <span>
                Room × {nights} night{nights > 1 ? 's' : ''}
                {weekendNights > 0 && <span className="ml-1 text-xs text-amber-600">({weekendNights} wknd)</span>}
              </span>
              <span className="font-medium">₹{totalRoomCharge.toLocaleString('en-IN')}</span>
            </div>
            {overrideRateMultiplier !== null && (
              <div className="text-xs text-amber-700 pl-2">
                Negotiated: ₹{(rooms[0].baseRate * overrideRateMultiplier).toLocaleString('en-IN')}/night
                {weekendNights > 0 && <> · Weekend: ₹{Math.round(rooms[0].baseRate * overrideRateMultiplier * rooms[0].weekendMultiplier).toLocaleString('en-IN')}/night</>}
              </div>
            )}
            {totalExtraGuest > 0 && (
              <div className="flex justify-between text-neutral-700">
                <span className="text-amber-700">Extra guest charge</span>
                <span className="font-medium text-amber-700">+₹{totalExtraGuest.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between text-neutral-500 text-xs pt-1 border-t border-teal-200">
              <span>Subtotal</span>
              <span>₹{grandSubtotal.toLocaleString('en-IN')}</span>
            </div>
            {firstGstPct > 0 && (
              <div className="flex justify-between text-neutral-500 text-xs">
                <span>GST ({firstGstPct}%)</span>
                <span>₹{grandGst.toLocaleString('en-IN')}</span>
              </div>
            )}
          </>
        )}

        {/* Grand total (always shown) */}
        <div className={`flex justify-between font-bold text-teal-900 text-base ${multiRoom ? 'pt-2 border-t border-teal-300' : 'pt-1 border-t border-teal-300'}`}>
          <span>{multiRoom ? `Grand Total (${rooms.length} bookings)` : 'Total'}</span>
          <span>₹{grandTotal.toLocaleString('en-IN')}</span>
        </div>
        {multiRoom && (
          <p className="text-[10px] text-teal-600 text-right">
            Each room is a separate booking · Avg ₹{Math.round(grandTotal / rooms.length).toLocaleString('en-IN')}/room
          </p>
        )}

      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function NewBookingModal({ open, onClose, onCreated }: NewBookingModalProps) {
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [availableRooms, setAvailableRooms] = useState<RoomOption[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    idProofType: 'AADHAAR',
    idProofNumber: '',
    numberOfGuests: 2,
    paymentMethod: 'CASH',
    paidAmount: 0,
    specialRequests: '',
  });

  // Rate override state
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [overrideRateInput, setOverrideRateInput] = useState('');
  const [overrideNote, setOverrideNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setCheckIn(null);
      setCheckOut(null);
      setAvailableRooms([]);
      setSelectedRoomIds([]);
      setForm({ fullName: '', email: '', phone: '', idProofType: 'AADHAAR', idProofNumber: '', numberOfGuests: 2, paymentMethod: 'CASH', paidAmount: 0, specialRequests: '' });
      setOverrideEnabled(false);
      setOverrideRateInput('');
      setOverrideNote('');
      setError(null);
    }
  }, [open]);

  // Fetch available rooms when dates are selected
  useEffect(() => {
    const fetchAvailable = async () => {
      if (!checkIn || !checkOut) return;
      setRoomsLoading(true);
      setError(null);
      try {
        const url = `/api/rooms/available?checkIn=${encodeURIComponent(checkIn.toISOString())}&checkOut=${encodeURIComponent(checkOut.toISOString())}`;
        const res = await fetch(url);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || 'Failed to fetch available rooms');
        }
        const j = await res.json();
        const opts: RoomOption[] = (j.data || []).map((r: any) => ({
          id: r.id,
          label: `Room ${r.roomNumber} · ${r.type}`,
          baseRate: r.baseRate,
          weekendMultiplier: r.weekendMultiplier ?? 1.2,
          baseOccupancy: r.baseOccupancy ?? 2,
          maxOccupancy: r.maxOccupancy ?? 3,
          extraGuestCharge: r.extraGuestCharge ?? 0,
          roomNumber: r.roomNumber,
          type: r.type,
        }));
        setAvailableRooms(opts);
        setSelectedRoomIds([]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to fetch available rooms');
        setAvailableRooms([]);
        setSelectedRoomIds([]);
      } finally {
        setRoomsLoading(false);
      }
    };
    fetchAvailable();
  }, [checkIn?.toISOString(), checkOut?.toISOString()]);

  const nights = useMemo(
    () => (checkIn && checkOut ? Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)) : 0),
    [checkIn, checkOut]
  );

  const selectedRooms = useMemo(
    () => availableRooms.filter(r => selectedRoomIds.includes(r.id)),
    [availableRooms, selectedRoomIds]
  );

  // ── Capacity validation & guest distribution ──
  const totalCapacity = useMemo(
    () => selectedRooms.reduce((sum, r) => sum + r.maxOccupancy, 0),
    [selectedRooms]
  );
  const guestsExceedCapacity = selectedRooms.length > 0 && form.numberOfGuests > totalCapacity;

  const guestDistribution = useMemo(
    () => distributeGuests(form.numberOfGuests, selectedRooms) ?? [],
    [form.numberOfGuests, selectedRooms]
  );

  const targetGrandTotal = useMemo(() => {
    if (!overrideEnabled) return null;
    const v = parseFloat(overrideRateInput);
    return !isNaN(v) && v > 0 ? v : null;
  }, [overrideEnabled, overrideRateInput]);

  const overrideRateMultiplier = useMemo(() => {
    if (targetGrandTotal === null || nights === 0 || selectedRooms.length === 0 || !checkIn || !checkOut || guestsExceedCapacity) return null;
    
    // Find a multiplier M (applied to baseRate of each room) such that the grand total equals targetGrandTotal
    const getGrandTotalForMultiplier = (M: number) => {
        let total = 0;
        selectedRooms.forEach((r, i) => {
            const breakdown = calculateBookingPriceBreakdown({
                rooms: [{
                    roomId: r.id,
                    baseRate: r.baseRate * M,
                    weekendMultiplier: r.weekendMultiplier,
                    baseOccupancy: r.baseOccupancy,
                    extraGuestChargePerNight: r.extraGuestCharge
                }],
                checkIn, checkOut, numberOfGuests: guestDistribution[i], addons: []
            });
            total += breakdown.totalAmount;
        });
        return total;
    };
    
    // Standard total without multiplier
    const standardTotal = getGrandTotalForMultiplier(1);
    if (Math.abs(standardTotal - targetGrandTotal) < 1) return 1;

    // Binary search for multiplier M in [0, 10]
    let low = 0;
    let high = 10;
    let bestM = 1;
    for (let iter = 0; iter < 50; iter++) {
        const mid = (low + high) / 2;
        const currentTotal = getGrandTotalForMultiplier(mid);
        if (currentTotal < targetGrandTotal) {
            low = mid;
            bestM = mid;
        } else {
            high = mid;
        }
    }
    return bestM;
  }, [targetGrandTotal, selectedRooms, nights, checkIn, checkOut, guestDistribution, guestsExceedCapacity]);

  // Standard total (across all selected rooms) for discount preview
  const standardGrandTotal = useMemo(() => {
    if (nights === 0 || selectedRooms.length === 0 || !checkIn || !checkOut || guestsExceedCapacity || guestDistribution.length !== selectedRooms.length) return 0;
    return selectedRooms.reduce((sum, r, i) => sum + calculateBookingPriceBreakdown({
      rooms: [{ roomId: r.id, baseRate: r.baseRate, weekendMultiplier: r.weekendMultiplier, baseOccupancy: r.baseOccupancy, extraGuestChargePerNight: r.extraGuestCharge }],
      checkIn, checkOut, numberOfGuests: guestDistribution[i], addons: []
    }).totalAmount, 0);
  }, [selectedRooms, nights, checkIn, checkOut, guestDistribution, guestsExceedCapacity]);

  const discountAmount = targetGrandTotal && standardGrandTotal > targetGrandTotal ? standardGrandTotal - targetGrandTotal : 0;
  
  const toggleRoom = (roomId: string) =>
    setSelectedRoomIds(prev => prev.includes(roomId) ? prev.filter(id => id !== roomId) : [...prev, roomId]);

  const selectAllRooms = () =>
    setSelectedRoomIds(selectedRoomIds.length === availableRooms.length ? [] : availableRooms.map(r => r.id));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkIn || !checkOut) { setError('Please select check-in and check-out dates'); return; }
    if (selectedRoomIds.length === 0) { setError('Please select at least one room'); return; }
    if (!form.fullName || !form.email || !form.phone || !form.idProofNumber) { setError('Please complete all guest details'); return; }
    if (guestsExceedCapacity) { setError(`${form.numberOfGuests} guests exceed total room capacity of ${totalCapacity}. Please select more rooms.`); return; }
    if (guestDistribution.length !== selectedRoomIds.length) { setError('Unable to distribute guests across rooms. Check guest count.'); return; }

    setSubmitting(true);
    setError(null);

    const results: any[] = [];
    const errors: string[] = [];
    let guestId: string | null = null;

    for (let i = 0; i < selectedRoomIds.length; i++) {
      const roomId = selectedRoomIds[i];
      const isFirst = i === 0;
      const roomGuestCount = guestDistribution[i]; // Distributed per-room count

      const payload: any = {
        roomId,
        checkIn: checkIn.toISOString().slice(0, 10),
        checkOut: checkOut.toISOString().slice(0, 10),
        numberOfGuests: roomGuestCount,
        specialRequests: form.specialRequests || undefined,
        addons: [],
        paymentMethod: form.paymentMethod,
        paidAmount: isFirst ? Number(form.paidAmount) || 0 : 0,
        ...(overrideRateMultiplier !== null && { overrideRate: selectedRooms[i].baseRate * overrideRateMultiplier }),
        ...(overrideRateMultiplier !== null && overrideNote && { overrideNote: overrideNote.trim() }),
      };

      if (isFirst || !guestId) {
        payload.guestInfo = {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          idProofType: form.idProofType,
          idProofNumber: form.idProofNumber.trim(),
        };
      } else {
        payload.guestId = guestId;
      }

      try {
        const res = await fetch('/api/admin/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const text = await res.text();
          let j: any = {};
          try { j = JSON.parse(text); } catch { j = { error: text || `HTTP ${res.status}` }; }
          const room = availableRooms.find(r => r.id === roomId);
          let msg = j.error || `HTTP ${res.status}`;
          if (j.details && Array.isArray(j.details)) {
            msg = j.details.map((d: any) => `${d.path?.join('.')}: ${d.message}`).join(', ');
          }
          errors.push(`Room ${room?.roomNumber}: ${msg}`);
        } else {
          const j = await res.json();
          results.push(j.booking);
          if (!guestId && j.booking?.guest?.id) guestId = j.booking.guest.id;
        }
      } catch {
        const room = availableRooms.find(r => r.id === roomId);
        errors.push(`Room ${room?.roomNumber}: Network error`);
      }
    }

    setSubmitting(false);

    if (errors.length > 0 && results.length === 0) {
      setError(errors.join('; '));
      return;
    }
    if (errors.length > 0) {
      setError(`Created ${results.length} booking(s). Errors: ${errors.join('; ')}`);
    }

    onCreated();
    if (errors.length === 0) onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full sm:w-[760px] bg-white shadow-xl border-l border-neutral-200 overflow-y-auto">
        <form onSubmit={submit} className="p-6 space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">New Manual Booking</h2>
              <p className="text-xs text-neutral-500 mt-0.5">Walk-in or phone reservation</p>
            </div>
            <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm flex gap-2">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              {error}
            </div>
          )}

          {/* ── Section 1: Dates ── */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">Stay Dates</label>
            <DateRangePicker
              onChange={({ checkIn: ci, checkOut: co, guests }) => {
                setCheckIn(ci);
                setCheckOut(co);
                // Sync guest count from the picker into form so pricing is always correct
                if (guests && guests !== form.numberOfGuests) {
                  setForm(prev => ({ ...prev, numberOfGuests: guests }));
                }
              }}
              minNights={1}
            />
          </div>

          {/* ── Section 2: Room Selection ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-neutral-700">
                Select Rooms
                {selectedRoomIds.length > 0 && <span className="ml-1.5 text-teal-600">({selectedRoomIds.length} selected)</span>}
              </label>
              {availableRooms.length > 0 && (
                <button type="button" onClick={selectAllRooms} className="text-xs text-teal-600 hover:text-teal-700 font-medium">
                  {selectedRoomIds.length === availableRooms.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            {roomsLoading ? (
              <div className="flex items-center justify-center py-8 bg-neutral-50 rounded-lg border border-neutral-200">
                <div className="animate-spin h-5 w-5 border-2 border-teal-500 border-t-transparent rounded-full mr-2" />
                <span className="text-neutral-600 text-sm">Checking availability…</span>
              </div>
            ) : !checkIn || !checkOut ? (
              <div className="py-8 text-center bg-neutral-50 rounded-lg border border-neutral-200">
                <span className="text-neutral-500 text-sm">Select check-in and check-out dates first</span>
              </div>
            ) : availableRooms.length === 0 ? (
              <div className="py-8 text-center bg-red-50 rounded-lg border border-red-200">
                <span className="text-red-600 text-sm">No rooms available for selected dates</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto p-1">
                {availableRooms.map(room => {
                  const isSelected = selectedRoomIds.includes(room.id);
                  return (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => toggleRoom(room.id)}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${isSelected ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-500' : 'border-neutral-200 bg-white hover:border-neutral-300'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className={`font-semibold text-sm ${isSelected ? 'text-teal-700' : 'text-neutral-800'}`}>Room {room.roomNumber}</div>
                          <div className="text-xs text-neutral-500">{room.type}</div>
                          <div className="text-xs font-medium text-neutral-600 mt-1">₹{room.baseRate.toLocaleString('en-IN')}/night</div>
                          <div className="text-[10px] text-neutral-400">Max: {room.maxOccupancy} · Base: {room.baseOccupancy} guests</div>
                        </div>
                        <div className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center ${isSelected ? 'bg-teal-500' : 'border-2 border-neutral-300'}`}>
                          {isSelected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Capacity Warning */}
            {guestsExceedCapacity && (
              <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <div>
                  <p className="text-sm font-semibold text-red-800">{form.numberOfGuests} guests exceed capacity ({totalCapacity} max)</p>
                  <p className="text-xs text-red-600 mt-0.5">Select more rooms to accommodate all guests.</p>
                </div>
              </div>
            )}

            {/* Guest Distribution Info */}
            {!guestsExceedCapacity && guestDistribution.length > 0 && selectedRooms.length > 1 && (
              <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-800">
                <span className="font-semibold">Guest distribution:</span>
                {selectedRooms.map((r, i) => (
                  <span key={r.id} className="ml-2">Room {r.roomNumber}: {guestDistribution[i]} guest{guestDistribution[i] > 1 ? 's' : ''}{i < selectedRooms.length - 1 ? ' ·' : ''}</span>
                ))}
              </div>
            )}

            {/* Live Price Breakdown */}
            {nights > 0 && selectedRooms.length > 0 && checkIn && checkOut && !guestsExceedCapacity && (
              <PriceBreakdown
                rooms={selectedRooms}
                guestDistribution={guestDistribution}
                nights={nights}
                checkIn={checkIn}
                checkOut={checkOut}
                numberOfGuests={form.numberOfGuests}
                overrideRateMultiplier={overrideRateMultiplier}
              />
            )}
          </div>

          {/* ── Section 3: Rate Override (Bargaining) ── */}
          {selectedRooms.length > 0 && (
            <div className="rounded-lg border border-amber-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setOverrideEnabled(v => !v)}
                className={`w-full px-4 py-3 flex items-center justify-between text-left transition-colors ${overrideEnabled ? 'bg-amber-50' : 'bg-amber-50/40 hover:bg-amber-50'}`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${overrideEnabled ? 'bg-amber-500' : 'bg-amber-100'}`}>
                    <svg className={`w-4 h-4 ${overrideEnabled ? 'text-white' : 'text-amber-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Guest Bargaining — Override Grand Total</p>
                    <p className="text-xs text-amber-700">Apply a negotiated final total cost for this booking</p>
                  </div>
                </div>
                <div className={`w-10 h-5 rounded-full transition-colors relative ${overrideEnabled ? 'bg-amber-500' : 'bg-neutral-300'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${overrideEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </button>

              {overrideEnabled && (
                <div className="px-4 py-4 space-y-3 bg-white border-t border-amber-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">Negotiated Grand Total (₹) <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm font-medium">₹</span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={overrideRateInput}
                          onChange={e => setOverrideRateInput(e.target.value)}
                          placeholder={standardGrandTotal ? String(standardGrandTotal) : '0'}
                          className="input-field pl-7 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">Reason / Note</label>
                      <input
                        type="text"
                        value={overrideNote}
                        onChange={e => setOverrideNote(e.target.value)}
                        placeholder="e.g. Returning guest, Group discount"
                        className="input-field text-sm"
                        maxLength={200}
                      />
                    </div>
                  </div>

                  {/* Discount preview */}
                  {targetGrandTotal !== null && standardGrandTotal > 0 && (
                    <div className={`text-xs px-3 py-2 rounded-lg flex items-center gap-2 ${discountAmount > 0 ? 'bg-green-50 text-green-800 border border-green-200' : targetGrandTotal > standardGrandTotal ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-neutral-50 text-neutral-600 border border-neutral-200'}`}>
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {discountAmount > 0
                        ? `Discount of ₹${discountAmount.toLocaleString('en-IN')} (${Math.round((discountAmount / standardGrandTotal) * 100)}% off standard ₹${standardGrandTotal.toLocaleString('en-IN')})`
                        : targetGrandTotal > standardGrandTotal
                          ? `Premium of ₹${(targetGrandTotal - standardGrandTotal).toLocaleString('en-IN')} above standard grand total`
                          : 'Same as standard grand total'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Section 4: Guest Details ── */}
          <div>
            <p className="text-sm font-semibold text-neutral-700 mb-3">Guest Details</p>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                <input className="input-field" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder="Guest full name" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Phone <span className="text-red-500">*</span></label>
                <input className="input-field" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="10-digit mobile" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Email <span className="text-red-500">*</span></label>
                <input type="email" className="input-field" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="guest@email.com" required />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">ID Type</label>
                  <select className="input-field" value={form.idProofType} onChange={e => setForm({ ...form, idProofType: e.target.value })}>
                    <option value="AADHAAR">Aadhaar</option>
                    <option value="PASSPORT">Passport</option>
                    <option value="DRIVING_LICENSE">Driving License</option>
                    <option value="VOTER_ID">Voter ID</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">ID Number <span className="text-red-500">*</span></label>
                  <input className="input-field" value={form.idProofNumber} onChange={e => setForm({ ...form, idProofNumber: e.target.value })} placeholder="ID number" required />
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 5: Payment ── */}
          <div>
            <p className="text-sm font-semibold text-neutral-700 mb-3">Payment</p>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">No. of Guests</label>
                <input type="number" min={1} max={20} className="input-field" value={form.numberOfGuests} onChange={e => setForm({ ...form, numberOfGuests: Number(e.target.value) })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Payment Method</label>
                <select className="input-field" value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })}>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="UPI">UPI</option>
                  <option value="ONLINE">Online</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Paid Now (₹)</label>
                <input type="number" min={0} className="input-field" value={form.paidAmount} onChange={e => setForm({ ...form, paidAmount: Number(e.target.value) })} />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Special Requests</label>
            <textarea className="input-field" rows={2} value={form.specialRequests} onChange={e => setForm({ ...form, specialRequests: e.target.value })} placeholder="Any special requirements…" />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2 border-t border-neutral-100">
            <button type="button" onClick={onClose} className="px-5 py-2 rounded-lg border border-neutral-300 text-neutral-700 text-sm hover:bg-neutral-50 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || selectedRoomIds.length === 0}
              className="px-5 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {submitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {submitting ? 'Creating…' : 'Create Booking'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
