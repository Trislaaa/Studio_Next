'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';

type ManageBookingResponse = {
  success: true;
  token: {
    bookingReference: string;
    issuedAt: string;
    expiresAt: string;
  };
  booking: {
    id: string;
    bookingReference: string;
    status: string;
    checkIn: string;
    checkOut: string;
    totalAmount: number;
    room: {
      number: string;
      type: string;
    };
    guest: {
      name: string;
      email: string;
    };
    transaction: {
      status: string;
      amount: number;
      paymentMethod: string | null;
      refundedAmount: number;
    } | null;
  };
  cancellation: {
    canCancel: boolean;
    blockReason: string | null;
    policyWindow: 'full' | 'partial' | 'none';
    refundPercentage: number;
    platformFeePercentage: number;
    platformFeeAmount: number;
    paidAmount: number;
    refundAmount: number;
    cancellationCharge: number;
    hoursUntilCheckIn: number;
  };
};

type CancelResponse = {
  success: true;
  booking: {
    id: string;
    bookingReference: string;
    status: string;
  };
  cancellation: {
    policyWindow: 'full' | 'partial' | 'none';
    refundPercentage: number;
    platformFeePercentage: number;
    platformFeeAmount: number;
    paidAmount: number;
    refundAmount: number;
    cancellationCharge: number;
    refundGatewayId: string | null;
  };
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatCurrency(value: number) {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export default function ManageBookingTokenPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === 'string' ? params.token : '';

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [data, setData] = useState<ManageBookingResponse | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [reason, setReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelResult, setCancelResult] = useState<CancelResponse | null>(null);

  useEffect(() => {
    if (!token) return;

    let active = true;

    async function loadDetails() {
      setLoading(true);
      setLoadError(null);

      try {
        const response = await fetch(`/api/bookings/manage/token?token=${encodeURIComponent(token)}`, {
          method: 'GET',
        });

        const payload = await response.json();

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error ?? 'Unable to load manage booking details');
        }

        if (!active) return;
        setData(payload as ManageBookingResponse);
      } catch (loadError) {
        if (!active) return;
        setLoadError(loadError instanceof Error ? loadError.message : 'Unable to load manage booking details');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadDetails();

    return () => {
      active = false;
    };
  }, [token]);

  const policyLabel = useMemo(() => {
    if (!data) return '';

    switch (data.cancellation.policyWindow) {
      case 'full':
        return '95% refund window (> 48 hours before check-in). A 5% platform fee is deducted to cover payment gateway charges.';
      case 'partial':
        return '50% refund window (24 to 48 hours before check-in)';
      default:
        return 'No refund window (< 24 hours before check-in)';
    }
  }, [data]);

  async function handleCancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !confirmChecked) {
      return;
    }

    setIsCancelling(true);
    setActionError(null);

    try {
      const response = await fetch('/api/bookings/manage/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          reason: reason.trim() || undefined,
        }),
      });

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? 'Unable to cancel booking');
      }

      setActionError(null);
      setCancelResult(payload as CancelResponse);
    } catch (cancelError) {
      setActionError(cancelError instanceof Error ? cancelError.message : 'Unable to cancel booking');
    } finally {
      setIsCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f3ee] px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-b-2 border-t-2 border-[#1f3128]" />
          <p className="text-sm text-[#4f5c55]">Loading secure booking details...</p>
        </div>
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f3ee] px-6">
        <div className="w-full max-w-xl rounded-3xl border border-[#e4d7c6] bg-white p-8 text-center">
          <h1 className="text-3xl font-serif text-[#17261f]">Link Unavailable</h1>
          <p className="mt-4 text-[#5b6861]">
            {loadError ?? 'The manage booking link is invalid or expired. Please request a new secure link.'}
          </p>
          <Link
            href="/manage"
            className="mt-6 inline-flex items-center rounded-full bg-[#1f3128] px-6 py-3 text-sm font-semibold tracking-[0.12em] uppercase text-white"
          >
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f3ee] pb-14">
      <section className="border-b border-[#e8dfd3] bg-[radial-gradient(circle_at_top,rgba(29,49,40,0.2),rgba(246,243,238,0.88)_48%,#f6f3ee_100%)]">
        <div className="mx-auto max-w-5xl px-6 py-10 md:py-12">
          <p className="inline-flex rounded-full border border-[#cab89e] bg-[#fbf5eb] px-3 py-1 text-[11px] tracking-[0.14em] uppercase text-[#68553a]">
            Secure Cancellation Window
          </p>
          <h1 className="mt-5 text-4xl font-serif text-[#17261f] md:text-5xl">Manage Booking {data.booking.bookingReference}</h1>
          <p className="mt-4 text-[#5b6861]">
            Link valid until {new Date(data.token.expiresAt).toLocaleString('en-IN')}. Cancellation policy is applied at
            confirmation time on the server.
          </p>
        </div>
      </section>

      <main className="mx-auto mt-8 grid max-w-5xl gap-6 px-6 md:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-[#e7ddcf] bg-white p-6 shadow-[0_14px_42px_rgba(22,34,28,0.08)] md:p-8">
          <h2 className="text-2xl font-serif text-[#17261f]">Booking Snapshot</h2>

          <div className="mt-5 grid gap-3 rounded-2xl border border-[#eadfce] bg-[#fbf8f3] p-5 text-sm text-[#425149]">
            <div className="flex justify-between">
              <span>Status</span>
              <span className="font-semibold text-[#1f3128]">{data.booking.status}</span>
            </div>
            <div className="flex justify-between">
              <span>Guest</span>
              <span className="font-semibold text-[#1f3128]">{data.booking.guest.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Room</span>
              <span className="font-semibold text-[#1f3128]">
                {data.booking.room.number} ({data.booking.room.type})
              </span>
            </div>
            <div className="flex justify-between">
              <span>Check-in</span>
              <span className="font-semibold text-[#1f3128]">{formatDate(data.booking.checkIn)}</span>
            </div>
            <div className="flex justify-between">
              <span>Check-out</span>
              <span className="font-semibold text-[#1f3128]">{formatDate(data.booking.checkOut)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Amount</span>
              <span className="font-semibold text-[#1f3128]">{formatCurrency(data.booking.totalAmount)}</span>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-[#e6d6c0] bg-[#fff6ec] p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-[#8b6a45]">Cancellation Preview</p>
            <p className="mt-2 text-sm text-[#6f5a41]">{policyLabel}</p>
            <div className="mt-4 space-y-2 text-sm text-[#4f5d55]">
              <div className="flex justify-between">
                <span>Paid Amount</span>
                <span>{formatCurrency(data.cancellation.paidAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Refund Percentage</span>
                <span>{data.cancellation.refundPercentage}%</span>
              </div>
              {data.cancellation.platformFeeAmount > 0 && (
                <div className="flex justify-between text-[#8b6a45]">
                  <span>Platform Fee (5%)</span>
                  <span>- {formatCurrency(data.cancellation.platformFeeAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Refund Amount</span>
                <span className="font-semibold text-[#1f3128]">{formatCurrency(data.cancellation.refundAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cancellation Charge</span>
                <span>{formatCurrency(data.cancellation.cancellationCharge)}</span>
              </div>
            </div>
          </div>

          {cancelResult ? (
            <div className="mt-6 rounded-2xl border border-[#cfe2d3] bg-[#f1f8f2] p-5 text-sm text-[#2e5b36]">
              <p className="font-semibold">Booking cancelled successfully.</p>
              <p className="mt-2">Refund amount: {formatCurrency(cancelResult.cancellation.refundAmount)}</p>
              {cancelResult.cancellation.platformFeeAmount > 0 && (
                <p>Platform fee (5%): {formatCurrency(cancelResult.cancellation.platformFeeAmount)}</p>
              )}
              <p>Cancellation charge: {formatCurrency(cancelResult.cancellation.cancellationCharge)}</p>
              {cancelResult.cancellation.refundGatewayId ? (
                <p>Refund reference: {cancelResult.cancellation.refundGatewayId}</p>
              ) : null}
            </div>
          ) : null}

          {actionError ? (
            <div className="mt-6 rounded-2xl border border-[#ebcaca] bg-[#fff3f3] p-4 text-sm text-[#8a2f2f]">{actionError}</div>
          ) : null}
        </section>

        <aside className="space-y-4">
          <form
            onSubmit={handleCancel}
            className="rounded-3xl border border-[#e7ddcf] bg-white p-6 shadow-[0_12px_36px_rgba(22,34,28,0.06)]"
          >
            <h3 className="text-xl font-serif text-[#17261f]">Confirm Cancellation</h3>
            {data.cancellation.canCancel ? (
              <>
                <p className="mt-3 text-sm text-[#5f6f66]">
                  This action cannot be undone. Refunds are processed back to your original payment method.
                </p>

                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-medium text-[#415048]">Reason (optional)</span>
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={4}
                    maxLength={500}
                    className="w-full rounded-xl border border-[#d7c8b4] bg-[#fffdfa] px-3 py-2 text-sm text-[#1f2d26] outline-none focus:border-[#8a6540]"
                    placeholder="Tell us why you are cancelling"
                  />
                </label>

                <label className="mt-4 flex items-start gap-2 text-sm text-[#4a5951]">
                  <input
                    type="checkbox"
                    checked={confirmChecked}
                    onChange={(event) => setConfirmChecked(event.target.checked)}
                    className="mt-1"
                  />
                  I understand that this cancellation is final, a 5% platform fee will be deducted from refunds, and the refund policy will be applied.
                </label>

                <button
                  type="submit"
                  disabled={isCancelling || !confirmChecked || Boolean(cancelResult)}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#8f2e2a] px-4 py-3 text-sm font-semibold tracking-[0.12em] uppercase text-white transition hover:bg-[#792521] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCancelling ? 'Cancelling Booking...' : cancelResult ? 'Already Cancelled' : 'Cancel Booking'}
                </button>
              </>
            ) : (
              <div className="mt-3 rounded-2xl border border-[#ebd4d4] bg-[#fff4f4] p-4 text-sm text-[#8d3636]">
                {data.cancellation.blockReason ?? 'This booking cannot be cancelled online.'}
              </div>
            )}
          </form>

          <div className="rounded-3xl border border-[#ddd2c3] bg-[#fbf7f1] p-6">
            <h4 className="text-lg font-serif text-[#4a3828]">Need Assistance?</h4>
            <p className="mt-2 text-sm text-[#6f624f]">Our reception team is available 24/7 for urgent support.</p>
            <a
              href="tel:8928584198"
              className="mt-4 inline-flex rounded-full border border-[#8a6540] px-4 py-2 text-xs uppercase text-[#8a6540]"
            >
              Call 8928584198
            </a>
          </div>
        </aside>
      </main>
    </div>
  );
}
