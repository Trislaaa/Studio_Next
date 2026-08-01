'use client';

import { useCallback, useEffect, useState } from 'react';

type CancellationActor = 'ADMIN' | 'GUEST' | 'UNKNOWN';
type PolicyWindow = 'full' | 'partial' | 'none' | 'unknown';

interface CancellationItem {
  bookingId: string;
  bookingReference: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  roomNumber: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  cancelledAt: string;
  cancelledBy: CancellationActor;
  cancellationReason: string | null;
  policyWindow: PolicyWindow;
  paidAmount: number;
  refundAmount: number;
  refundPercentage: number;
  cancellationCharge: number;
  refundGatewayId: string | null;
  paymentMethod: string | null;
}

interface CancellationSummary {
  totalCancellations: number;
  totalRefundAmount: number;
  fullRefundCount: number;
  partialRefundCount: number;
  noRefundCount: number;
  adminCancelledCount: number;
  guestCancelledCount: number;
}

interface CancellationPagination {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
}

interface CancellationApiResponse {
  cancellations: CancellationItem[];
  summary: CancellationSummary;
  pagination?: CancellationPagination;
}

const EMPTY_SUMMARY: CancellationSummary = {
  totalCancellations: 0,
  totalRefundAmount: 0,
  fullRefundCount: 0,
  partialRefundCount: 0,
  noRefundCount: 0,
  adminCancelledCount: 0,
  guestCancelledCount: 0,
};

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function formatDate(value: string) {
  const date = new Date(value);

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function policyWindowLabel(windowType: PolicyWindow) {
  if (windowType === 'full') return '95% Refund';
  if (windowType === 'partial') return 'Partial Refund';
  if (windowType === 'none') return 'No Refund';
  return 'Unknown';
}

function policyWindowStyle(windowType: PolicyWindow) {
  if (windowType === 'full') {
    return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
  }

  if (windowType === 'partial') {
    return 'bg-amber-100 text-amber-700 border border-amber-200';
  }

  if (windowType === 'none') {
    return 'bg-red-100 text-red-700 border border-red-200';
  }

  return 'bg-slate-100 text-slate-700 border border-slate-200';
}

function actorStyle(actor: CancellationActor) {
  if (actor === 'GUEST') {
    return 'bg-indigo-100 text-indigo-700 border border-indigo-200';
  }

  if (actor === 'ADMIN') {
    return 'bg-slate-100 text-slate-700 border border-slate-200';
  }

  return 'bg-zinc-100 text-zinc-700 border border-zinc-200';
}

export default function AdminCancellationHistoryPage() {
  const [history, setHistory] = useState<CancellationItem[]>([]);
  const [summary, setSummary] = useState<CancellationSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [searchDraft, setSearchDraft] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [actorFilter, setActorFilter] = useState<'all' | 'ADMIN' | 'GUEST'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchCancellationHistory = useCallback(async (options?: { append?: boolean; cursor?: string | null }) => {
    const append = options?.append ?? false;

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(null);
    }

    try {
      const params = new URLSearchParams();

      params.append('limit', '100');
      if (searchTerm) params.append('search', searchTerm);
      if (actorFilter !== 'all') params.append('actor', actorFilter);
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);
      if (options?.cursor) params.append('cursor', options.cursor);

      const response = await fetch(`/api/admin/cancellations?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to load cancellation history');
      }

      const data = (await response.json()) as CancellationApiResponse;
      const pageHistory = data.cancellations || [];
      const pageSummary = data.summary || EMPTY_SUMMARY;
      const pagination = data.pagination;

      setHistory((prev) => (append ? [...prev, ...pageHistory] : pageHistory));
      setSummary(pageSummary);

      setHasMore(Boolean(pagination?.hasMore));
      setNextCursor(pagination?.nextCursor ?? null);
    } catch (fetchError) {
      console.error('Error fetching cancellation history:', fetchError);
      setError('Unable to load cancellation history right now.');
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, [actorFilter, fromDate, searchTerm, toDate]);

  useEffect(() => {
    fetchCancellationHistory();
  }, [fetchCancellationHistory]);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextSearchTerm = searchDraft.trim();
    if (nextSearchTerm === searchTerm) {
      void fetchCancellationHistory();
      return;
    }

    setSearchTerm(nextSearchTerm);
  };

  const clearFilters = () => {
    setSearchDraft('');
    setSearchTerm('');
    setActorFilter('all');
    setFromDate('');
    setToDate('');
  };

  const handleLoadMore = () => {
    if (!hasMore || !nextCursor || loadingMore) {
      return;
    }

    void fetchCancellationHistory({ append: true, cursor: nextCursor });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200" />
            <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-slate-500">Loading cancellations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <p className="text-slate-500">
          Track cancelled bookings, refund outcomes, and who initiated each cancellation.
        </p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Cancellations</p>
          <p className="mt-2 text-2xl font-bold text-slate-800">{summary.totalCancellations}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Refunded</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{formatCurrency(summary.totalRefundAmount)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Policy Distribution</p>
          <p className="mt-2 text-sm font-medium text-slate-700">
            Full {summary.fullRefundCount} • Partial {summary.partialRefundCount} • None {summary.noRefundCount}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Initiated By</p>
          <p className="mt-2 text-sm font-medium text-slate-700">
            Guest {summary.guestCancelledCount} • Admin {summary.adminCancelledCount}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 border border-slate-200/60 shadow-sm">
        <div className="flex flex-col gap-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Search by booking ref, guest, email, or room..."
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Search
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select
              value={actorFilter}
              onChange={(event) => setActorFilter(event.target.value as 'all' | 'ADMIN' | 'GUEST')}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            >
              <option value="all">All Initiators</option>
              <option value="GUEST">Guest Initiated</option>
              <option value="ADMIN">Admin Initiated</option>
            </select>

            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />

            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />

            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-275">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Booking</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Guest</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Stay</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cancelled On</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">By</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Policy</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Refund Breakdown</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Reason</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item, index) => (
                <tr
                  key={`${item.bookingId}-${item.cancelledAt}`}
                  className={`hover:bg-slate-50/50 transition-colors ${
                    index !== history.length - 1 ? 'border-b border-slate-100' : ''
                  }`}
                >
                  <td className="px-6 py-4">
                    <p className="text-sm font-mono text-slate-700">{item.bookingReference}</p>
                    <p className="text-xs text-slate-500">Room {item.roomNumber} ({item.roomType})</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-slate-800">{item.guestName}</p>
                    <p className="text-xs text-slate-500">{item.guestEmail}</p>
                    <p className="text-xs text-slate-500">{item.guestPhone}</p>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600">
                    <p>{formatDate(item.checkIn)} to {formatDate(item.checkOut)}</p>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600">
                    {formatDateTime(item.cancelledAt)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${actorStyle(item.cancelledBy)}`}>
                      {item.cancelledBy}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${policyWindowStyle(item.policyWindow)}`}>
                      {policyWindowLabel(item.policyWindow)}
                    </span>
                    <p className="text-xs text-slate-500 mt-1">Refund {item.refundPercentage}%</p>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600">
                    <p>Paid: {formatCurrency(item.paidAmount)}</p>
                    <p className="text-emerald-700">Refunded: {formatCurrency(item.refundAmount)}</p>
                    <p className="text-red-700">Charge: {formatCurrency(item.cancellationCharge)}</p>
                    {item.refundGatewayId && (
                      <p className="mt-1 text-slate-500">Refund ID: {item.refundGatewayId}</p>
                    )}
                    {item.paymentMethod && (
                      <p className="text-slate-500">Method: {item.paymentMethod}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600 max-w-70">
                    {item.cancellationReason || 'No reason captured'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {history.length === 0 && (
          <div className="p-16 text-center">
            <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-slate-500 text-sm">No cancelled bookings match your current filters.</p>
          </div>
        )}

        {history.length > 0 && (
          <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between">
            <p className="text-xs text-slate-500">Loaded {history.length} cancellations</p>
            {hasMore ? (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loadingMore ? 'Loading more...' : 'Load More'}
              </button>
            ) : (
              <p className="text-xs text-slate-500">End of results</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}