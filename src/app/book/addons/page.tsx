'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AddonsRedirectContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const query = searchParams.toString();
        router.replace(query ? `/book/guest-details?${query}` : '/book');
    }, [router, searchParams]);

    return (
        <div className="min-h-screen bg-[#f6f3ee] flex items-center justify-center px-4">
            <div className="text-center bg-white border border-[#e7ddcf] rounded-3xl p-10 max-w-xl">
                <h2 className="text-2xl md:text-3xl font-serif text-[#17261f] mb-4">
                    Redirecting to Guest Details
                </h2>
                <p className="text-[#4f5c55]">
                    Add-ons step has been removed. Please continue from guest details.
                </p>
            </div>
        </div>
    );
}

export default function AddonsPage() {
    return (
        <Suspense fallback={null}>
            <AddonsRedirectContent />
        </Suspense>
    );
}
