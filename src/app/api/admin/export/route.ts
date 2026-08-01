import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toNum(v: unknown): number {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'object' && v !== null && 'toNumber' in v && typeof (v as any).toNumber === 'function') {
        return (v as any).toNumber();
    }
    return Number(v) || 0;
}

function readMeta(v: Prisma.JsonValue | null): Record<string, unknown> {
    if (!v || Array.isArray(v) || typeof v !== 'object') return {};
    return v as Record<string, unknown>;
}

function fmtDate(d: Date | null | undefined): string {
    if (!d) return '';
    return d.toISOString().split('T')[0];
}

function fmtCurrency(n: number): number {
    return Math.round(n * 100) / 100;
}

// ─── Style helpers ───────────────────────────────────────────────────────────

function styleHeaderRow(sheet: ExcelJS.Worksheet, color: string) {
    const row = sheet.getRow(1);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    row.height = 28;
    row.eachCell((cell) => {
        cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' },
        };
    });
}

function addSummaryHeader(sheet: ExcelJS.Worksheet, title: string, colSpan: number) {
    const titleRow = sheet.addRow([title]);
    titleRow.font = { bold: true, size: 14, color: { argb: 'FF1A1A2E' } };
    sheet.mergeCells(titleRow.number, 1, titleRow.number, colSpan);
    const dateRow = sheet.addRow([`Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`]);
    dateRow.font = { italic: true, size: 10, color: { argb: 'FF666666' } };
    sheet.mergeCells(dateRow.number, 1, dateRow.number, colSpan);
    sheet.addRow([]);
}

// ─── GET /api/admin/export ───────────────────────────────────────────────────

export async function GET(request: NextRequest) {
    try {
        const guard = await requireAuth(request, ['ADMIN', 'MANAGER']);
        if (guard.error) return guard.error;

        const { searchParams } = new URL(request.url);
        const fromDate = searchParams.get('from');
        const toDate = searchParams.get('to');

        // Date filter for bookings
        const dateFilter: Prisma.BookingWhereInput = {};
        if (fromDate) dateFilter.createdAt = { ...(dateFilter.createdAt as any), gte: new Date(fromDate) };
        if (toDate) {
            const to = new Date(toDate);
            to.setHours(23, 59, 59, 999);
            dateFilter.createdAt = { ...(dateFilter.createdAt as any), lte: to };
        }

        // Fetch all data
        const [bookings, guests] = await Promise.all([
            prisma.booking.findMany({
                where: dateFilter,
                include: {
                    guest: true,
                    rooms: { include: { room: true } },
                    transaction: true,
                    addons: true,
                    coupon: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.guest.findMany({ orderBy: { createdAt: 'desc' } }),
        ]);

        // ── Build Workbook ───────────────────────────────────────────────────
        const wb = new ExcelJS.Workbook();
        wb.creator = 'STUDIO NEXT';
        wb.created = new Date();

        // ════════════════════════════════════════════════════════════════════
        // SHEET 1: All Bookings
        // ════════════════════════════════════════════════════════════════════
        const bookingsSheet = wb.addWorksheet('All Bookings', {
            properties: { tabColor: { argb: 'FF0D9488' } },
        });

        const bookingCols = [
            { header: 'Booking Ref', key: 'ref', width: 22 },
            { header: 'Guest Name', key: 'guest', width: 22 },
            { header: 'Email', key: 'email', width: 28 },
            { header: 'Phone', key: 'phone', width: 16 },
            { header: 'Room(s)', key: 'rooms', width: 14 },
            { header: 'Room Type', key: 'roomType', width: 14 },
            { header: 'Check-In', key: 'checkIn', width: 14 },
            { header: 'Check-Out', key: 'checkOut', width: 14 },
            { header: 'Nights', key: 'nights', width: 8 },
            { header: 'Guests', key: 'guests', width: 8 },
            { header: 'Status', key: 'status', width: 14 },
            { header: 'Base Amount (₹)', key: 'baseAmt', width: 16 },
            { header: 'Tax/GST (₹)', key: 'tax', width: 14 },
            { header: 'Discount (₹)', key: 'discount', width: 14 },
            { header: 'Total (₹)', key: 'total', width: 14 },
            { header: 'Paid (₹)', key: 'paid', width: 14 },
            { header: 'Payment Method', key: 'method', width: 16 },
            { header: 'Payment Status', key: 'payStatus', width: 16 },
            { header: 'Coupon', key: 'coupon', width: 14 },
            { header: 'Addons', key: 'addons', width: 22 },
            { header: 'Special Requests', key: 'special', width: 28 },
            { header: 'Booked On', key: 'bookedOn', width: 14 },
        ];

        bookingsSheet.columns = bookingCols;
        styleHeaderRow(bookingsSheet, 'FF0D9488');

        for (const b of bookings) {
            const totalAmt = toNum(b.totalAmount);
            const taxAmt = toNum(b.taxAmount);
            const discountAmt = toNum(b.discountAmount);
            const baseAmt = fmtCurrency(totalAmt - taxAmt + discountAmt);
            const paidAmt = b.transaction ? toNum(b.transaction.amount) : 0;
            const nights = Math.ceil((b.checkOut.getTime() - b.checkIn.getTime()) / (1000 * 60 * 60 * 24));
            const addonStr = b.addons.map(a => `${a.name} x${a.quantity} (₹${toNum(a.price)})`).join(', ');

            const row = bookingsSheet.addRow({
                ref: b.bookingReference,
                guest: b.guest.fullName,
                email: b.guest.email,
                phone: b.guest.phone,
                rooms: b.rooms.map(r => r.room.roomNumber).join(', '),
                roomType: b.rooms.length > 1 ? 'Multiple' : b.rooms[0]?.room.type ?? '',
                checkIn: fmtDate(b.checkIn),
                checkOut: fmtDate(b.checkOut),
                nights,
                guests: b.numberOfGuests,
                status: b.status,
                baseAmt: fmtCurrency(baseAmt),
                tax: fmtCurrency(taxAmt),
                discount: fmtCurrency(discountAmt),
                total: fmtCurrency(totalAmt),
                paid: fmtCurrency(paidAmt),
                method: b.transaction?.paymentMethod ?? 'N/A',
                payStatus: b.transaction?.status ?? 'N/A',
                coupon: b.coupon?.code ?? '',
                addons: addonStr || '',
                special: b.specialRequests ?? '',
                bookedOn: fmtDate(b.createdAt),
            });

            // Color-code status
            const statusCell = row.getCell('status');
            const statusColors: Record<string, string> = {
                CONFIRMED: 'FF3B82F6', CHECKED_IN: 'FF10B981', CHECKED_OUT: 'FF6B7280',
                CANCELLED: 'FFEF4444', PENDING: 'FFF59E0B', NO_SHOW: 'FF8B5CF6',
            };
            statusCell.font = { bold: true, color: { argb: statusColors[b.status] ?? 'FF000000' } };

            // Alternate row shading
            if (bookings.indexOf(b) % 2 === 1) {
                row.eachCell((cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FFFE' } };
                });
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // SHEET 2: Revenue Summary
        // ════════════════════════════════════════════════════════════════════
        const revenueSheet = wb.addWorksheet('Revenue Summary', {
            properties: { tabColor: { argb: 'FF10B981' } },
        });

        addSummaryHeader(revenueSheet, 'STUDIO NEXT — Revenue Report', 4);

        // Overall stats
        const confirmedBookings = bookings.filter(b => ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'].includes(b.status));
        const cancelledBookings = bookings.filter(b => b.status === 'CANCELLED');
        const totalRevenue = confirmedBookings.reduce((s, b) => s + toNum(b.totalAmount), 0);
        const totalTax = confirmedBookings.reduce((s, b) => s + toNum(b.taxAmount), 0);
        const totalDiscount = confirmedBookings.reduce((s, b) => s + toNum(b.discountAmount), 0);
        const totalPaid = confirmedBookings.reduce((s, b) => s + (b.transaction ? toNum(b.transaction.amount) : 0), 0);
        const totalRefunds = bookings.reduce((s, b) => s + (b.transaction ? toNum(b.transaction.refundAmount) : 0), 0);
        const netRevenue = totalPaid - totalRefunds;

        const summaryData = [
            ['Metric', 'Amount (₹)'],
            ['Total Bookings', bookings.length],
            ['Confirmed / Active Bookings', confirmedBookings.length],
            ['Cancelled Bookings', cancelledBookings.length],
            ['', ''],
            ['Gross Revenue (Total Amount)', fmtCurrency(totalRevenue)],
            ['Total GST Collected', fmtCurrency(totalTax)],
            ['Total Discounts Given', fmtCurrency(totalDiscount)],
            ['Revenue Before Tax', fmtCurrency(totalRevenue - totalTax)],
            ['', ''],
            ['Total Amount Paid', fmtCurrency(totalPaid)],
            ['Total Refunds Issued', fmtCurrency(totalRefunds)],
            ['Net Revenue (Paid - Refunds)', fmtCurrency(netRevenue)],
        ];

        for (const row of summaryData) {
            const r = revenueSheet.addRow(row);
            if (row[0] === 'Metric') {
                r.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
                r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
            }
            if (typeof row[0] === 'string' && row[0].startsWith('Net Revenue')) {
                r.font = { bold: true, size: 12, color: { argb: 'FF059669' } };
            }
        }

        revenueSheet.getColumn(1).width = 35;
        revenueSheet.getColumn(2).width = 20;

        // Revenue by Room Type
        revenueSheet.addRow([]);
        const rtHeader = revenueSheet.addRow(['Revenue by Room Type', '', '', '']);
        rtHeader.font = { bold: true, size: 12 };

        const byRoomType: Record<string, { count: number; revenue: number; tax: number }> = {};
        for (const b of confirmedBookings) {
            const rt = b.rooms.length > 1 ? 'Multiple' : b.rooms[0]?.room.type ?? 'Unknown';
            if (!byRoomType[rt]) byRoomType[rt] = { count: 0, revenue: 0, tax: 0 };
            byRoomType[rt].count++;
            byRoomType[rt].revenue += toNum(b.totalAmount);
            byRoomType[rt].tax += toNum(b.taxAmount);
        }

        const rtColHeader = revenueSheet.addRow(['Room Type', 'Bookings', 'Revenue (₹)', 'GST (₹)']);
        rtColHeader.font = { bold: true };
        rtColHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };

        for (const [type, data] of Object.entries(byRoomType)) {
            revenueSheet.addRow([type, data.count, fmtCurrency(data.revenue), fmtCurrency(data.tax)]);
        }

        // Revenue by Payment Method
        revenueSheet.addRow([]);
        const pmHeader = revenueSheet.addRow(['Revenue by Payment Method']);
        pmHeader.font = { bold: true, size: 12 };

        const byMethod: Record<string, { count: number; total: number }> = {};
        for (const b of confirmedBookings) {
            const method = b.transaction?.paymentMethod ?? 'N/A';
            if (!byMethod[method]) byMethod[method] = { count: 0, total: 0 };
            byMethod[method].count++;
            byMethod[method].total += b.transaction ? toNum(b.transaction.amount) : 0;
        }

        const pmColHeader = revenueSheet.addRow(['Payment Method', 'Transactions', 'Amount (₹)']);
        pmColHeader.font = { bold: true };
        pmColHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };

        for (const [method, data] of Object.entries(byMethod)) {
            revenueSheet.addRow([method.toUpperCase(), data.count, fmtCurrency(data.total)]);
        }

        // ════════════════════════════════════════════════════════════════════
        // SHEET 3: Cancellations & Refunds
        // ════════════════════════════════════════════════════════════════════
        const cancelSheet = wb.addWorksheet('Cancellations & Refunds', {
            properties: { tabColor: { argb: 'FFEF4444' } },
        });

        cancelSheet.columns = [
            { header: 'Booking Ref', key: 'ref', width: 22 },
            { header: 'Guest Name', key: 'guest', width: 22 },
            { header: 'Email', key: 'email', width: 28 },
            { header: 'Room(s)', key: 'rooms', width: 14 },
            { header: 'Check-In', key: 'checkIn', width: 14 },
            { header: 'Check-Out', key: 'checkOut', width: 14 },
            { header: 'Original Amount (₹)', key: 'origAmt', width: 18 },
            { header: 'Paid (₹)', key: 'paid', width: 14 },
            { header: 'Refund Amount (₹)', key: 'refund', width: 16 },
            { header: 'Cancellation Charge (₹)', key: 'charge', width: 20 },
            { header: 'Refund %', key: 'pct', width: 10 },
            { header: 'Policy Window', key: 'window', width: 14 },
            { header: 'Cancelled By', key: 'actor', width: 14 },
            { header: 'Reason', key: 'reason', width: 30 },
            { header: 'Refund Gateway ID', key: 'gwId', width: 22 },
            { header: 'Cancelled At', key: 'cancelledAt', width: 20 },
        ];
        styleHeaderRow(cancelSheet, 'FFEF4444');

        for (const b of cancelledBookings) {
            const meta = b.transaction ? readMeta(b.transaction.metadata as Prisma.JsonValue) : {};
            const cancellation = (meta.cancellation ?? {}) as Record<string, unknown>;
            const origAmount = typeof cancellation.originalTotalAmount === 'number'
                ? cancellation.originalTotalAmount
                : toNum(b.totalAmount);
            const paidAmt = b.transaction ? toNum(b.transaction.amount) : 0;
            const refundAmt = b.transaction ? toNum(b.transaction.refundAmount) : 0;

            cancelSheet.addRow({
                ref: b.bookingReference,
                guest: b.guest.fullName,
                email: b.guest.email,
                rooms: b.rooms.map(r => r.room.roomNumber).join(', '),
                checkIn: fmtDate(b.checkIn),
                checkOut: fmtDate(b.checkOut),
                origAmt: fmtCurrency(origAmount),
                paid: fmtCurrency(paidAmt),
                refund: fmtCurrency(refundAmt),
                charge: fmtCurrency(paidAmt - refundAmt),
                pct: typeof cancellation.refundPercentage === 'number' ? `${cancellation.refundPercentage}%` : '',
                window: typeof cancellation.policyWindow === 'string' ? cancellation.policyWindow : '',
                actor: typeof cancellation.actor === 'string' ? cancellation.actor : '',
                reason: typeof cancellation.cancellationReason === 'string' ? cancellation.cancellationReason : '',
                gwId: typeof cancellation.refundGatewayId === 'string' ? cancellation.refundGatewayId : '',
                cancelledAt: typeof cancellation.cancelledAt === 'string' ? cancellation.cancelledAt.split('T')[0] : '',
            });
        }

        // ════════════════════════════════════════════════════════════════════
        // SHEET 4: Guest Directory
        // ════════════════════════════════════════════════════════════════════
        const guestSheet = wb.addWorksheet('Guest Directory', {
            properties: { tabColor: { argb: 'FF6366F1' } },
        });

        guestSheet.columns = [
            { header: 'Full Name', key: 'name', width: 24 },
            { header: 'Email', key: 'email', width: 28 },
            { header: 'Phone', key: 'phone', width: 16 },
            { header: 'ID Proof Type', key: 'idType', width: 16 },
            { header: 'ID Proof Number', key: 'idNum', width: 20 },
            { header: 'Address', key: 'address', width: 40 },
            { header: 'Total Bookings', key: 'totalBookings', width: 14 },
            { header: 'Total Spent (₹)', key: 'totalSpent', width: 16 },
            { header: 'First Booking', key: 'firstBooking', width: 14 },
            { header: 'Last Booking', key: 'lastBooking', width: 14 },
            { header: 'Registered On', key: 'registered', width: 14 },
        ];
        styleHeaderRow(guestSheet, 'FF6366F1');

        // Pre-compute guest stats
        const guestStats: Record<string, { count: number; total: number; first: Date | null; last: Date | null }> = {};
        for (const b of bookings) {
            if (!['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'].includes(b.status)) continue;
            if (!guestStats[b.guestId]) guestStats[b.guestId] = { count: 0, total: 0, first: null, last: null };
            guestStats[b.guestId].count++;
            guestStats[b.guestId].total += toNum(b.totalAmount);
            if (!guestStats[b.guestId].first || b.createdAt < guestStats[b.guestId].first!)
                guestStats[b.guestId].first = b.createdAt;
            if (!guestStats[b.guestId].last || b.createdAt > guestStats[b.guestId].last!)
                guestStats[b.guestId].last = b.createdAt;
        }

        for (const g of guests) {
            const idProof = (g.idProof ?? {}) as Record<string, string>;
            const addr = (g.address ?? {}) as Record<string, string>;
            const addrStr = [addr.street, addr.city, addr.state, addr.country, addr.zip].filter(Boolean).join(', ');
            const stats = guestStats[g.id] ?? { count: 0, total: 0, first: null, last: null };

            guestSheet.addRow({
                name: g.fullName,
                email: g.email,
                phone: g.phone,
                idType: idProof.type ?? '',
                idNum: idProof.number ?? '',
                address: addrStr,
                totalBookings: stats.count,
                totalSpent: fmtCurrency(stats.total),
                firstBooking: stats.first ? fmtDate(stats.first) : '',
                lastBooking: stats.last ? fmtDate(stats.last) : '',
                registered: fmtDate(g.createdAt),
            });
        }

        // ════════════════════════════════════════════════════════════════════
        // SHEET 5: GST Tax Report
        // ════════════════════════════════════════════════════════════════════
        const taxSheet = wb.addWorksheet('GST Tax Report', {
            properties: { tabColor: { argb: 'FFF59E0B' } },
        });

        addSummaryHeader(taxSheet, 'STUDIO NEXT — GST Tax Report', 6);

        taxSheet.addRow(['Booking Ref', 'Guest Name', 'Check-In', 'Total (₹)', 'CGST (₹)', 'SGST (₹)', 'Total GST (₹)']);
        const taxHeader = taxSheet.getRow(taxSheet.rowCount);
        taxHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        taxHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };

        taxSheet.getColumn(1).width = 22;
        taxSheet.getColumn(2).width = 22;
        taxSheet.getColumn(3).width = 14;
        taxSheet.getColumn(4).width = 16;
        taxSheet.getColumn(5).width = 14;
        taxSheet.getColumn(6).width = 14;
        taxSheet.getColumn(7).width = 14;

        let totalCGST = 0;
        let totalSGST = 0;
        let totalGST = 0;

        for (const b of confirmedBookings) {
            const tax = toNum(b.taxAmount);
            const cgst = fmtCurrency(tax / 2); // GST split 50/50 for intra-state
            const sgst = fmtCurrency(tax / 2);
            totalCGST += cgst;
            totalSGST += sgst;
            totalGST += tax;

            taxSheet.addRow([
                b.bookingReference,
                b.guest.fullName,
                fmtDate(b.checkIn),
                fmtCurrency(toNum(b.totalAmount)),
                cgst,
                sgst,
                fmtCurrency(tax),
            ]);
        }

        taxSheet.addRow([]);
        const totalRow = taxSheet.addRow(['', '', 'TOTAL', '', fmtCurrency(totalCGST), fmtCurrency(totalSGST), fmtCurrency(totalGST)]);
        totalRow.font = { bold: true, size: 12 };
        totalRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };

        // ── Generate buffer and return ───────────────────────────────────────
        const buffer = await wb.xlsx.writeBuffer();

        const fileName = `Studio next_Hotel_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

        return new NextResponse(buffer as ArrayBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        console.error('Export error:', error);
        return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
    }
}
