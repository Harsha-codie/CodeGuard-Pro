/**
 * POST /api/repo-heal — Autonomous Repository Healing Endpoint
 * 
 * Input: { repo_url, team_name, leader_name }
 * Output: Streaming progress events + final results.json
 * 
 * This is SEPARATE from the PR review webhook.
 * PR review remains untouched at /api/github/webhook
 */

import { RepoHealerEngine } from '../../../lib/repo-healer/index';

export const maxDuration = 300; // 5 min max for serverless (Vercel)
export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const body = await request.json();
        const { repo_url, team_name, leader_name } = body;

        // Validate input
        if (!repo_url || !team_name || !leader_name) {
            return Response.json(
                { error: 'Missing required fields: repo_url, team_name, leader_name' },
                { status: 400 }
            );
        }

        // Validate GitHub URL
        if (!repo_url.includes('github.com')) {
            return Response.json(
                { error: 'Only GitHub repository URLs are supported' },
                { status: 400 }
            );
        }

        console.log(`[RepoHeal API] Starting healing for ${repo_url}`);
        console.log(`[RepoHeal API] Team: ${team_name}, Leader: ${leader_name}`);

        // Create engine
        const engine = new RepoHealerEngine({
            repoUrl: repo_url,
            teamName: team_name,
            leaderName: leader_name,
        });

        // Use Server-Sent Events for real-time progress
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                // Send progress events
                engine.onProgress((event) => {
                    const data = `data: ${JSON.stringify(event)}\n\n`;
                    controller.enqueue(encoder.encode(data));
                });

                try {
                    // Run the healing pipeline
                    const results = await engine.run();

                    // Send final results
                    const finalEvent = `data: ${JSON.stringify({ stage: 'result', results })}\n\n`;
                    controller.enqueue(encoder.encode(finalEvent));
                    controller.close();
                } catch (error) {
                    const errorEvent = `data: ${JSON.stringify({
                        stage: 'error',
                        message: error.message,
                        results: engine.results,
                    })}\n\n`;
                    controller.enqueue(encoder.encode(errorEvent));
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        });

    } catch (error) {
        console.error('[RepoHeal API] Error:', error);
        return Response.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/repo-heal — Get last healing result (polling fallback)
 */
export async function GET() {
    return Response.json({
        status: 'ready',
        mode: 'repo_heal',
        description: 'POST with { repo_url, team_name, leader_name } to start healing',
    });
}
