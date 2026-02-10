import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/auth/check
 * Verify the end-to-end OAuth flow is working:
 *  1. GitHub OAuth → NextAuth session exists
 *  2. Session has githubId
 *  3. User exists in database
 *  4. User has projects
 */
export async function GET() {
    try {
        // Step 1: Check if session exists
        const session = await getServerSession(authOptions);
        
        if (!session) {
            return NextResponse.json({
                authenticated: false,
                status: 'NOT_AUTHENTICATED',
                message: 'No active session. Please log in via GitHub OAuth.',
                loginUrl: '/login',
            });
        }

        // Step 2: Verify session has GitHub data
        if (!session.user?.githubId) {
            return NextResponse.json({
                authenticated: true,
                status: 'MISSING_GITHUB_ID',
                message: 'Session exists but GitHub ID is missing. Re-authenticate.',
                session: { name: session.user?.name, email: session.user?.email },
            });
        }

        // Step 3: Check user in database
        const user = await prisma.user.findUnique({
            where: { githubId: String(session.user.githubId) },
            include: {
                projects: {
                    select: {
                        id: true,
                        repoName: true,
                        repoOwner: true,
                        installationId: true,
                        _count: { select: { rules: true, analyses: true } }
                    }
                }
            }
        });

        if (!user) {
            return NextResponse.json({
                authenticated: true,
                status: 'USER_NOT_IN_DB',
                message: 'Authenticated but user not found in database. Projects may need to be added.',
                githubId: session.user.githubId,
                name: session.user.name,
            });
        }

        // Step 4: Full success
        return NextResponse.json({
            authenticated: true,
            status: 'OK',
            message: 'OAuth flow is fully working!',
            user: {
                id: user.id,
                name: user.name,
                githubId: user.githubId,
                email: user.email,
            },
            projects: user.projects.map(p => ({
                name: `${p.repoOwner}/${p.repoName}`,
                installationId: p.installationId,
                rules: p._count.rules,
                analyses: p._count.analyses,
            })),
            totalProjects: user.projects.length,
        });

    } catch (error) {
        console.error('[AuthCheck] Error:', error);
        return NextResponse.json({
            authenticated: false,
            status: 'ERROR',
            message: error.message,
        }, { status: 500 });
    }
}
