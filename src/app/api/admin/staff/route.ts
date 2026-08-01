import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-guard';

// Staff roles
const VALID_ROLES = ['ADMIN', 'MANAGER', 'RECEPTION', 'STAFF'];

// GET - List all staff members
export async function GET(request: NextRequest) {
    try {
        const guard = await requireAuth(request, ['ADMIN', 'MANAGER']);
        if (guard.error) return guard.error;

        const { searchParams } = new URL(request.url);
        const role = searchParams.get('role');
        const search = searchParams.get('search');

        const where: any = {};

        if (role && VALID_ROLES.includes(role)) {
            where.role = role;
        }

        if (search) {
            where.OR = [
                { fullName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        const staff = await prisma.adminUser.findMany({
            where,
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ success: true, data: staff });
    } catch (error) {
        console.error('Error fetching staff:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch staff members' },
            { status: 500 }
        );
    }
}

// POST - Create new staff member
export async function POST(request: NextRequest) {
    try {
        const guard = await requireAuth(request, ['ADMIN']);
        if (guard.error) return guard.error;

        const body = await request.json();
        const { email, password, fullName, role } = body;

        // Validation
        if (!email || !password || !fullName || !role) {
            return NextResponse.json(
                { success: false, error: 'All fields are required' },
                { status: 400 }
            );
        }

        if (!VALID_ROLES.includes(role)) {
            return NextResponse.json(
                { success: false, error: 'Invalid role' },
                { status: 400 }
            );
        }

        // Check email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { success: false, error: 'Invalid email format' },
                { status: 400 }
            );
        }

        // Check if email already exists
        const existingUser = await prisma.adminUser.findUnique({
            where: { email },
        });

        if (existingUser) {
            return NextResponse.json(
                { success: false, error: 'Email already registered' },
                { status: 409 }
            );
        }

        // Validate password strength
        if (password.length < 8) {
            return NextResponse.json(
                { success: false, error: 'Password must be at least 8 characters long' },
                { status: 400 }
            );
        }

        if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
            return NextResponse.json(
                { success: false, error: 'Password must contain uppercase, lowercase, and a number' },
                { status: 400 }
            );
        }

        // Hash password with 12 rounds for production strength
        const passwordHash = await bcrypt.hash(password, 12);

        // Create staff member
        const newStaff = await prisma.adminUser.create({
            data: {
                email,
                passwordHash,
                fullName,
                role,
                isActive: true,
            },
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                isActive: true,
                createdAt: true,
            },
        });

        return NextResponse.json(
            { success: true, data: newStaff },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error creating staff:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create staff member' },
            { status: 500 }
        );
    }
}

// PUT - Update staff member
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, email, fullName, role, isActive, password } = body;

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Staff ID is required' },
                { status: 400 }
            );
        }

        // Check if staff exists
        const existingStaff = await prisma.adminUser.findUnique({
            where: { id },
        });

        if (!existingStaff) {
            return NextResponse.json(
                { success: false, error: 'Staff member not found' },
                { status: 404 }
            );
        }

        // If email is being changed, check for duplicates
        if (email && email !== existingStaff.email) {
            const emailExists = await prisma.adminUser.findUnique({
                where: { email },
            });
            if (emailExists) {
                return NextResponse.json(
                    { success: false, error: 'Email already registered' },
                    { status: 409 }
                );
            }
        }

        // Build update data
        const updateData: any = {};
        if (email) updateData.email = email;
        if (fullName) updateData.fullName = fullName;
        if (role && VALID_ROLES.includes(role)) updateData.role = role;
        if (typeof isActive === 'boolean') updateData.isActive = isActive;
        if (password) {
            updateData.passwordHash = await bcrypt.hash(password, 10);
        }

        const updatedStaff = await prisma.adminUser.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return NextResponse.json({ success: true, data: updatedStaff });
    } catch (error) {
        console.error('Error updating staff:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update staff member' },
            { status: 500 }
        );
    }
}

// DELETE - Remove staff member
export async function DELETE(request: NextRequest) {
    try {
        const guard = await requireAuth(request, ['ADMIN']);
        if (guard.error) return guard.error;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Staff ID is required' },
                { status: 400 }
            );
        }

        // Check if staff exists
        const existingStaff = await prisma.adminUser.findUnique({
            where: { id },
        });

        if (!existingStaff) {
            return NextResponse.json(
                { success: false, error: 'Staff member not found' },
                { status: 404 }
            );
        }

        await prisma.adminUser.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            message: 'Staff member deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting staff:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete staff member' },
            { status: 500 }
        );
    }
}
