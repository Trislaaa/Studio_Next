'use client';

import React, { useState } from 'react';

export interface AdminBooking {
  id: string;
  bookingReference: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestIdProof?: {
    type?: string;
    number?: string;
    image_url?: string;
  } | null;
  room: string;
  roomType: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  status: string;
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  baseAmount: number;
  paidAmount: number;
  refundAmount: number;
  guests: number;
  pmsBookingId: string | null;
  cancellationAudit: {
    actor: string | null;
    cancelledAt: string | null;
    refundAmount: number;
    refundPercentage: number;
    refundGatewayId: string | null;
    policyWindow: string | null;
    cancellationReason: string | null;
  } | null;
}

interface BookingDetailsDrawerProps {
  open: boolean;
  booking: AdminBooking | null;
  onClose: () => void;
  onChangeStatus: (bookingId: string, status: string, ref: string) => void;
}

const ID_TYPE_LABELS: Record<string, string> = {
  aadhar: 'Aadhaar Card',
  passport: 'Passport',
  driving_license: 'Driving License',
  voter_id: 'Voter ID',
};

export function BookingDetailsDrawer({ open, booking, onClose, onChangeStatus }: BookingDetailsDrawerProps) {
  const [showIdFullscreen, setShowIdFullscreen] = useState(false);

  if (!open || !booking) return null;

  const nights = Math.max(1, Math.ceil((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24)));
  const cancellationCharge = Math.max(0, booking.paidAmount - (booking.cancellationAudit?.refundAmount ?? booking.refundAmount ?? 0));

  const statusActions = [
    booking.status === 'PENDING' && { key: 'CONFIRMED', label: 'Confirm', className: 'bg-blue-500 hover:bg-blue-600' },
    booking.status === 'CONFIRMED' && { key: 'CHECKED_IN', label: 'Check-in', className: 'bg-green-500 hover:bg-green-600' },
    booking.status === 'CHECKED_IN' && { key: 'CHECKED_OUT', label: 'Check-out', className: 'bg-neutral-600 hover:bg-neutral-700' },
    !['CANCELLED','CHECKED_OUT'].includes(booking.status) && { key: 'CANCELLED', label: 'Cancel', className: 'bg-red-500 hover:bg-red-600' },
  ].filter(Boolean) as { key: string; label: string; className: string }[];

  const idProof = booking.guestIdProof;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* ID Proof Fullscreen Modal */}
      {showIdFullscreen && idProof?.image_url && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setShowIdFullscreen(false)}
        >
          <div className="relative max-w-3xl w-full">
            <button
              onClick={() => setShowIdFullscreen(false)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white text-sm flex items-center gap-1"
            >
              <span>Close</span>
              <span className="text-lg">✕</span>
            </button>
            <img
              src={idProof.image_url}
              alt="ID Proof Document"
              className="w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-full sm:w-135 bg-white shadow-xl border-l border-neutral-200 overflow-y-auto">
        <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <div className="text-xs text-neutral-500">Booking Ref</div>
            <div className="text-lg font-semibold text-neutral-900">{booking.bookingReference}</div>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-800">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Guest */}
          <section className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-neutral-500 mb-1">Guest</div>
              <div className="text-sm font-medium text-neutral-900">{booking.guestName}</div>
              <div className="text-xs text-neutral-600">{booking.guestEmail}</div>
              <div className="text-xs text-neutral-600">{booking.guestPhone}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500 mb-1">Room</div>
              <div className="text-sm font-medium text-neutral-900">Room {booking.room}</div>
              <div className="text-xs text-neutral-600">{booking.roomType}</div>
            </div>
          </section>

          {/* ID Proof Section */}
          {idProof && (idProof.type || idProof.number || idProof.image_url) && (
            <section className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-4">
              <div className="text-xs text-neutral-500 font-semibold uppercase tracking-wide mb-3 flex items-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                </svg>
                ID Verification
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {idProof.type && (
                  <div>
                    <div className="text-xs text-neutral-500 mb-0.5">Document Type</div>
                    <div className="font-medium text-neutral-900">{ID_TYPE_LABELS[idProof.type] || idProof.type}</div>
                  </div>
                )}
                {idProof.number && (
                  <div>
                    <div className="text-xs text-neutral-500 mb-0.5">Document Number</div>
                    <div className="font-medium text-neutral-900 font-mono tracking-wide">{idProof.number}</div>
                  </div>
                )}
              </div>
              {idProof.image_url && (
                <div className="mt-3 pt-3 border-t border-neutral-200">
                  <div className="text-xs text-neutral-500 mb-2">Document Photo</div>
                  <div
                    className="relative group cursor-pointer inline-block"
                    onClick={() => setShowIdFullscreen(true)}
                  >
                    <img
                      src={idProof.image_url}
                      alt="ID Proof Document"
                      className="w-40 h-28 object-cover rounded-lg border border-neutral-200 shadow-sm group-hover:shadow-md transition-shadow"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
                      <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 px-2 py-1 rounded">
                        Click to enlarge
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Stay */}
          <section className="grid grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-neutral-500 mb-1">Check-in</div>
              <div className="text-sm font-medium text-neutral-900">{booking.checkIn}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500 mb-1">Check-out</div>
              <div className="text-sm font-medium text-neutral-900">{booking.checkOut}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500 mb-1">Nights</div>
              <div className="text-sm font-medium text-neutral-900">{nights}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500 mb-1">Guests</div>
              <div className="text-sm font-medium text-neutral-900">{booking.guests}</div>
            </div>
          </section>

          {/* Payment — Price Breakdown */}
          <section className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="text-xs text-neutral-500 font-semibold uppercase tracking-wide mb-3 flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Price Breakdown
            </div>
            <div className="space-y-2 text-sm">
              {/* Base Amount (subtotal before tax & after discount) */}
              <div className="flex justify-between">
                <span className="text-neutral-600">Room / Base Amount</span>
                <span className="font-medium text-neutral-900">₹{booking.baseAmount.toLocaleString('en-IN')}</span>
              </div>

              {/* Discount */}
              {booking.discountAmount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Coupon Discount</span>
                  <span className="font-medium">-₹{booking.discountAmount.toLocaleString('en-IN')}</span>
                </div>
              )}

              {/* Tax */}
              <div className="flex justify-between">
                <span className="text-neutral-600">GST / Tax</span>
                <span className="font-medium text-neutral-900">₹{booking.taxAmount.toLocaleString('en-IN')}</span>
              </div>

              {/* Divider */}
              <div className="border-t border-neutral-200 my-1" />

              {/* Final Amount */}
              <div className="flex justify-between text-base font-semibold">
                <span className="text-neutral-900">Total Amount</span>
                <span className="text-neutral-900">₹{booking.totalAmount.toLocaleString('en-IN')}</span>
              </div>

              {/* Paid */}
              <div className="flex justify-between">
                <span className="text-neutral-600">Amount Paid</span>
                <span className="font-semibold text-green-700">₹{booking.paidAmount.toLocaleString('en-IN')}</span>
              </div>

              {/* Balance */}
              {booking.totalAmount - booking.paidAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">Balance Due</span>
                  <span className="font-semibold text-orange-700">₹{Math.max(0, booking.totalAmount - booking.paidAmount).toLocaleString('en-IN')}</span>
                </div>
              )}

              {/* Refund */}
              {booking.refundAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">Refund Issued</span>
                  <span className="font-semibold text-blue-700">₹{booking.refundAmount.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>
          </section>

          {booking.cancellationAudit && (
            <section className="rounded-lg border border-red-100 bg-red-50/40 p-4 space-y-2">
              <div className="text-xs text-red-600 font-semibold uppercase tracking-wide">Cancellation Audit</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Initiated By</div>
                  <div className="font-medium text-neutral-900">{booking.cancellationAudit.actor ?? 'Unknown'}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Cancelled At</div>
                  <div className="font-medium text-neutral-900">
                    {booking.cancellationAudit.cancelledAt
                      ? new Date(booking.cancellationAudit.cancelledAt).toLocaleString('en-IN')
                      : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Refund</div>
                  <div className="font-medium text-green-700">
                    ₹{(booking.cancellationAudit.refundAmount ?? booking.refundAmount ?? 0).toLocaleString('en-IN')}
                    {booking.cancellationAudit.refundPercentage ? ` (${booking.cancellationAudit.refundPercentage}%)` : ''}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Charge</div>
                  <div className="font-medium text-orange-700">₹{cancellationCharge.toLocaleString('en-IN')}</div>
                </div>
              </div>

              {(booking.cancellationAudit.policyWindow || booking.cancellationAudit.refundGatewayId) && (
                <div className="text-xs text-neutral-600 space-y-1">
                  {booking.cancellationAudit.policyWindow ? <div>Policy Window: {booking.cancellationAudit.policyWindow}</div> : null}
                  {booking.cancellationAudit.refundGatewayId ? <div>Refund Reference: {booking.cancellationAudit.refundGatewayId}</div> : null}
                </div>
              )}

              {booking.cancellationAudit.cancellationReason ? (
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Reason</div>
                  <div className="text-sm text-neutral-800">{booking.cancellationAudit.cancellationReason}</div>
                </div>
              ) : null}
            </section>
          )}

          {/* Actions */}
          <section className="flex flex-wrap gap-2 pt-2">
            {statusActions.map(a => (
              <button
                key={a.key}
                onClick={() => onChangeStatus(booking.id, a.key, booking.bookingReference)}
                className={`text-xs px-3 py-2 text-white rounded ${a.className}`}
              >
                {a.label}
              </button>
            ))}
          </section>

          {/* Metadata */}
          {booking.pmsBookingId && (
            <section className="pt-4">
              <div className="text-xs text-neutral-500 mb-1">PMS</div>
              <div className="text-xs text-green-700">Synced • {booking.pmsBookingId}</div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
