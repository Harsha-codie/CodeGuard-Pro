/**
 * GET /api/repo-heal/results — Fetch stored healing results
 * POST /api/repo-heal/results — Store healing results
 * 
 * Uses an in-memory store for now (can be extended to DB).
 */

// In-memory results store (persists during server runtime)
const resultsStore = new Map();

export async function POST(request) {
    try {
        const body = await request.json();
        const id = body.id || `heal-${Date.now()}`;
        
        resultsStore.set(id, {
            ...body,
            storedAt: new Date().toISOString(),
        });

        return Response.json({ success: true, id });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
        const result = resultsStore.get(id);
        if (!result) {
            return Response.json({ error: 'Result not found' }, { status: 404 });
        }
        return Response.json(result);
    }

    // Return all results
    const all = Array.from(resultsStore.entries()).map(([id, data]) => ({ id, ...data }));
    return Response.json(all);
}
