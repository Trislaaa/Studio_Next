'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';

function ManageBookingStartPageContent() {
  const searchParams = useSearchParams();
  const [reference, setReference] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initialReference = searchParams.get('reference');
    if (initialReference) {
      setReference(initialReference.toUpperCase());
    }
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/bookings/manage/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: reference.trim().toUpperCase(),
          email: email.trim().toLowerCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? 'Unable to send secure link');
      }

      setMessage(
        data?.message ??
          'If your booking details match our records, a secure manage-booking link has been sent to your email.'
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to send secure link');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f3ee]">
      <section className="border-b border-[#e8dfd3] bg-[radial-gradient(circle_at_top,rgba(29,49,40,0.18),rgba(246,243,238,0.9)_48%,#f6f3ee_100%)]">
        <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
          <p className="inline-flex rounded-full border border-[#c8b79d] bg-[#f9f4ec] px-3 py-1 text-[11px] tracking-[0.14em] uppercase text-[#6a5538]">
            Secure Manage Booking
          </p>
          <h1 className="mt-5 text-4xl font-serif leading-tight text-[#17261f] md:text-5xl">
            Review or Cancel Your Reservation
          </h1>
          <p className="mt-4 max-w-3xl text-[#4f5c55]">
            Enter your booking reference and registered email address. We will send you a secure, time-limited link
            to proceed.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-6 py-10 md:py-14">
        <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-[#e7ddcf] bg-white p-6 shadow-[0_14px_42px_rgba(22,34,28,0.08)] md:p-8"
          >
            <h2 className="text-2xl font-serif text-[#17261f]">Request Secure Link</h2>
            <p className="mt-2 text-sm text-[#617168]">
              The link expires in 15 minutes and should only be used on your trusted device.
            </p>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#3f4f46]">Booking Reference</span>
                <input
                  value={reference}
                  onChange={(event) => setReference(event.target.value.toUpperCase())}
                  placeholder="OMK-YYYYMMDD-XXXX"
                  required
                  className="w-full rounded-xl border border-[#d7c8b4] bg-[#fffdfa] px-4 py-3 text-sm text-[#1f2d26] outline-none focus:border-[#8a6540]"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#3f4f46]">Booking Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full rounded-xl border border-[#d7c8b4] bg-[#fffdfa] px-4 py-3 text-sm text-[#1f2d26] outline-none focus:border-[#8a6540]"
                />
              </label>
            </div>

            {message ? (
              <div className="mt-5 rounded-xl border border-[#cfe2d3] bg-[#f1f8f2] px-4 py-3 text-sm text-[#2a5a33]">
                {message}
              </div>
            ) : null}

            {error ? (
              <div className="mt-5 rounded-xl border border-[#e7c8c8] bg-[#fff3f3] px-4 py-3 text-sm text-[#8a2f2f]">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#1f3128] px-4 py-3 text-sm font-semibold tracking-[0.12em] uppercase text-white transition hover:bg-[#2d4337] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Sending Secure Link...' : 'Send Secure Link'}
            </button>
          </form>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-[#e7ddcf] bg-white p-6">
              <h3 className="text-lg font-serif text-[#17261f]">How it Works</h3>
              <ol className="mt-4 space-y-3 text-sm text-[#59675f]">
                <li>1. Enter booking reference and registered email.</li>
                <li>2. Open the secure link sent to your inbox.</li>
                <li>3. Review refund details and confirm cancellation.</li>
              </ol>
            </div>

            <div className="rounded-3xl border border-[#dcd2c3] bg-[#fbf7f1] p-6">
              <h3 className="text-lg font-serif text-[#4a3828]">Need Help?</h3>
              <p className="mt-2 text-sm text-[#6f624f]">If you cannot access your booking email, contact reception.</p>
              <a
                href="tel:8928584198"
                className="mt-4 inline-flex items-center rounded-full border border-[#8a6540] px-4 py-2 text-xs uppercase text-[#8a6540]"
              >
                8928584198
              </a>
              <Link
                href="/"
                className="mt-3 block text-sm font-medium text-[#2f4f3d] underline decoration-[#cab79a] underline-offset-4"
              >
                Back to Home
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

export default function ManageBookingStartPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f6f3ee] flex items-center justify-center">
          <p className="text-sm text-[#617168]">Loading manage booking...</p>
        </div>
      }
    >
      <ManageBookingStartPageContent />
    </Suspense>
  );
}
