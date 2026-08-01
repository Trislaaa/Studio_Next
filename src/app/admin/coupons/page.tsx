'use client';

import { useState, useEffect } from 'react';

interface Coupon {
    id: string;
    code: string;
    discountType: 'PERCENTAGE' | 'FIXED';
    discountValue: number;
    validFrom: string;
    validUntil: string;
    maxUses: number | null;
    currentUses: number;
    isActive: boolean;
}

export default function CouponsAdminPage() {
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [code, setCode] = useState('');
    const [type, setType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
    const [value, setValue] = useState('');
    const [validFrom, setValidFrom] = useState('');
    const [validUntil, setValidUntil] = useState('');
    const [maxUses, setMaxUses] = useState('');
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        fetchCoupons();
    }, []);

    async function fetchCoupons() {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/coupons');
            if (!res.ok) throw new Error('Failed to fetch coupons');
            const data = await res.json();
            setCoupons(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleToggleStatus(id: string, currentStatus: boolean) {
        try {
            const res = await fetch('/api/admin/coupons', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, isActive: !currentStatus }),
            });
            if (!res.ok) throw new Error('Failed to update status');
            fetchCoupons();
        } catch (err: any) {
            alert(err.message);
        }
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setFormError(null);
        
        try {
            if (editingId) {
                // Edit existing coupon
                const res = await fetch('/api/admin/coupons', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: editingId,
                        validFrom,
                        validUntil,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to update coupon');
            } else {
                // Create new coupon
                const res = await fetch('/api/admin/coupons', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code: code.toUpperCase(),
                        discountType: type,
                        discountValue: Number(value),
                        validFrom,
                        validUntil,
                        maxUses: maxUses ? Number(maxUses) : null,
                        isActive: true,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to create coupon');
            }
            
            fetchCoupons();
            closeForm();
        } catch (err: any) {
            setFormError(err.message);
        }
    }

    function closeForm() {
        setIsCreating(false);
        setEditingId(null);
        setCode('');
        setValue('');
        setMaxUses('');
        setValidFrom('');
        setValidUntil('');
        setFormError(null);
    }

    function handleEditDate(coupon: Coupon) {
        // Format ISO date as YYYY-MM-DD in IST for the date input
        const formatIST = (iso: string) => {
            const d = new Date(iso);
            // Add IST offset (+05:30) to get the local IST date
            const istMs = d.getTime() + 5.5 * 60 * 60 * 1000;
            const istDate = new Date(istMs);
            const pad = (n: number) => n.toString().padStart(2, '0');
            return `${istDate.getUTCFullYear()}-${pad(istDate.getUTCMonth() + 1)}-${pad(istDate.getUTCDate())}`;
        };
        
        setEditingId(coupon.id);
        setCode(coupon.code);
        setType(coupon.discountType);
        setValue(coupon.discountValue.toString());
        setMaxUses(coupon.maxUses?.toString() || '');
        setValidFrom(formatIST(coupon.validFrom));
        setValidUntil(formatIST(coupon.validUntil));
        setIsCreating(true);
    }


    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-serif text-[#1e2f27]">Discount Coupons</h1>
                    <p className="text-sm text-[#4f5c55] mt-1">Manage promotional codes and discounts</p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="bg-[#1e2f27] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#2a4237] transition-colors"
                >
                    + Generate Coupon
                </button>
            </div>

            {isCreating && (
                <div className="mb-8 bg-white p-6 rounded-2xl border border-[#e7ddcf] shadow-sm">
                    <h2 className="text-xl font-serif mb-4 text-[#1e2f27]">
                        {editingId ? 'Update Coupon Validity' : 'New Coupon Code'}
                    </h2>
                    <form onSubmit={handleSave} className="grid md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#4f5c55] mb-2">Code</label>
                            <input 
                                type="text"
                                required
                                minLength={3}
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                disabled={!!editingId}
                                className={`w-full border border-[#d9cdbd] rounded-lg px-4 py-2.5 font-mono uppercase bg-[#fbf8f3] outline-none ${editingId ? 'opacity-50 cursor-not-allowed' : 'focus:border-[#1e2f27]'}`}
                                placeholder="e.g. SUMMER20"
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-[#4f5c55] mb-2">Type</label>
                                <select 
                                    value={type}
                                    onChange={(e) => setType(e.target.value as any)}
                                    disabled={!!editingId}
                                    className={`w-full border border-[#d9cdbd] rounded-lg px-4 py-2.5 bg-[#fbf8f3] outline-none ${editingId ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <option value="PERCENTAGE">Percentage (%)</option>
                                    <option value="FIXED">Fixed Amount (₹)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-[#4f5c55] mb-2">Value</label>
                                <input 
                                    type="number"
                                    required
                                    min={1}
                                    value={value}
                                    onChange={(e) => setValue(e.target.value)}
                                    disabled={!!editingId}
                                    className={`w-full border border-[#d9cdbd] rounded-lg px-4 py-2.5 bg-[#fbf8f3] outline-none ${editingId ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    placeholder={type === 'PERCENTAGE' ? "20" : "1500"}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#4f5c55] mb-2">Valid From</label>
                            <input 
                                type="date"
                                required
                                value={validFrom}
                                onChange={(e) => setValidFrom(e.target.value)}
                                className="w-full border border-[#d9cdbd] rounded-lg px-4 py-2.5 bg-[#fbf8f3] outline-none focus:border-[#1e2f27]"
                            />
                            <p className="text-[10px] text-[#9aaa9f] mt-1">Coupon active from start of this day (IST)</p>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#4f5c55] mb-2">Valid Until</label>
                            <input 
                                type="date"
                                required
                                value={validUntil}
                                onChange={(e) => setValidUntil(e.target.value)}
                                className="w-full border border-[#d9cdbd] rounded-lg px-4 py-2.5 bg-[#fbf8f3] outline-none focus:border-[#1e2f27]"
                            />
                            <p className="text-[10px] text-[#9aaa9f] mt-1">Coupon valid through end of this day (IST 23:59)</p>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#4f5c55] mb-2">Max Uses (Optional)</label>
                            <input 
                                type="number"
                                min={1}
                                value={maxUses}
                                onChange={(e) => setMaxUses(e.target.value)}
                                disabled={!!editingId}
                                className={`w-full border border-[#d9cdbd] rounded-lg px-4 py-2.5 bg-[#fbf8f3] outline-none ${editingId ? 'opacity-50 cursor-not-allowed' : ''}`}
                                placeholder="Leave blank for unlimited"
                            />
                        </div>

                        <div className="md:col-span-2 flex items-center justify-between pt-4 pb-2">
                            {formError ? <div className="text-red-500 text-sm font-medium">{formError}</div> : <div />}
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={closeForm}
                                    className="px-5 py-2.5 text-[#4f5c55] hover:text-[#1e2f27] font-semibold text-sm transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="bg-[#2a4237] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#1e2f27] transition-colors"
                                >
                                    {editingId ? 'Update Dates' : 'Save Coupon'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <div className="text-center py-10 text-[#7a8e82] animate-pulse">Loading coupons...</div>
            ) : error ? (
                <div className="text-red-500 bg-red-50 p-4 rounded-lg">{error}</div>
            ) : coupons.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-[#e7ddcf]">
                    <p className="text-[#7a8e82] mb-2">No coupons found.</p>
                    <p className="text-sm">Click "Generate Coupon" to create your first discount code.</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-[#e7ddcf] overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#fcfaf8] border-b border-[#e7ddcf] text-xs uppercase tracking-wider text-[#7a8e82]">
                                <th className="p-4 font-semibold">Code</th>
                                <th className="p-4 font-semibold">Discount</th>
                                <th className="p-4 font-semibold">Validity</th>
                                <th className="p-4 font-semibold">Usage</th>
                                <th className="p-4 font-semibold">Status</th>
                                <th className="p-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e7ddcf] text-sm text-[#4f5c55]">
                            {coupons.map((coupon) => {
                                const isExpired = new Date(coupon.validUntil) < new Date();
                                const statusText = !coupon.isActive ? 'Inactive' : (isExpired ? 'Expired' : 'Active');
                                const statusClass = !coupon.isActive 
                                    ? 'bg-[#fbeaea] text-[#d63b3b]' 
                                    : (isExpired ? 'bg-[#fcf0e3] text-[#d97706]' : 'bg-[#e8f5ed] text-[#1f8a4c]');

                                return (
                                <tr key={coupon.id} className="hover:bg-[#fafaf9] transition-colors">
                                    <td className="p-4">
                                        <span className="font-mono text-[#1e2f27] font-semibold bg-[#edf1ef] px-2 py-1 rounded">
                                            {coupon.code}
                                        </span>
                                    </td>
                                    <td className="p-4 font-medium text-[#1e2f27]">
                                        {coupon.discountType === 'PERCENTAGE' 
                                            ? `${coupon.discountValue}%` 
                                            : `₹${coupon.discountValue}`}
                                    </td>
                                    <td className="p-4 text-xs space-y-1">
                                        <div><span className="text-[#aeb9b3]">From:</span> {new Date(coupon.validFrom).toLocaleDateString()}</div>
                                        <div><span className="text-[#aeb9b3]">Until:</span> {new Date(coupon.validUntil).toLocaleDateString()}</div>
                                    </td>
                                    <td className="p-4">
                                        {coupon.currentUses} / {coupon.maxUses === null ? '∞' : coupon.maxUses}
                                    </td>
                                    <td className="p-4">
                                        <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider ${statusClass}`}>
                                            {statusText}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right space-x-4">
                                        <button
                                            onClick={() => {
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                                handleEditDate(coupon);
                                            }}
                                            className="text-xs font-semibold text-[#6e5d48] hover:text-[#4a3e30] transition-colors"
                                        >
                                            Edit Dates
                                        </button>
                                        <button
                                            onClick={() => handleToggleStatus(coupon.id, coupon.isActive)}
                                            className="text-xs font-semibold text-[#1f8a4c] hover:text-[#1a703d] transition-colors"
                                        >
                                            {coupon.isActive ? 'Disable' : 'Enable'}
                                        </button>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
