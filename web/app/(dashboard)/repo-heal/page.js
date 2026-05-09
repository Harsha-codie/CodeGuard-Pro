'use client';

import { useState, useRef, useEffect } from 'react';

// Bug type badge colors
const BUG_TYPE_COLORS = {
    LINTING: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
    SYNTAX: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
    LOGIC: { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
    TYPE_ERROR: { bg: '#fce7f3', color: '#9d174d', border: '#f9a8d4' },
    IMPORT: { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
    INDENTATION: { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
};

// Status badge styles
const STATUS_STYLES = {
    PASSED: { bg: '#d1fae5', color: '#065f46', icon: '✅' },
    FAILED: { bg: '#fee2e2', color: '#991b1b', icon: '❌' },
    PENDING: { bg: '#fef3c7', color: '#92400e', icon: '⏳' },
    RUNNING: { bg: '#dbeafe', color: '#1e40af', icon: '🔄' },
    NO_CI: { bg: '#f3f4f6', color: '#374151', icon: '⚪' },
    SKIPPED: { bg: '#f3f4f6', color: '#374151', icon: '⏭️' },
    RETRYING: { bg: '#fef3c7', color: '#92400e', icon: '🔁' },
};

export default function RepoHealPage() {
    // Input state
    const [repoUrl, setRepoUrl] = useState('');
    const [teamName, setTeamName] = useState('');
    const [leaderName, setLeaderName] = useState('');

    // Execution state
    const [isRunning, setIsRunning] = useState(false);
    const [currentStage, setCurrentStage] = useState('');
    const [progressLogs, setProgressLogs] = useState([]);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);

    const logsEndRef = useRef(null);

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [progressLogs]);

    /**
     * Start the healing process
     */
    const handleRunAgent = async () => {
        if (!repoUrl || !teamName || !leaderName) {
            setError('Please fill in all fields');
            return;
        }

        setIsRunning(true);
        setError(null);
        setResults(null);
        setProgressLogs([]);
        setCurrentStage('Starting...');

        try {
            const response = await fetch('/api/repo-heal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    repo_url: repoUrl,
                    team_name: teamName,
                    leader_name: leaderName,
                }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to start healing');
            }

            // Read SSE stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const event = JSON.parse(line.substring(6));

                            if (event.stage === 'result') {
                                setResults(event.results);
                                setCurrentStage('Complete');
                            } else if (event.stage === 'error') {
                                setError(event.message);
                                if (event.results) setResults(event.results);
                                setCurrentStage('Error');
                            } else {
                                setCurrentStage(event.stage);
                                setProgressLogs((prev) => [...prev, {
                                    time: new Date(event.timestamp).toLocaleTimeString(),
                                    stage: event.stage,
                                    message: event.message || '',
                                }]);
                            }
                        } catch (e) {
                            // Skip malformed events
                        }
                    }
                }
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsRunning(false);
        }
    };

    // Calculate score
    const calculateScore = (results) => {
        if (!results) return { base: 100, speedBonus: 0, efficiencyPenalty: 0, final: 100 };

        const base = 100;
        const executionMinutes = results.execution_time / 60000;
        const speedBonus = executionMinutes < 3 ? Math.round((3 - executionMinutes) * 10) : 0;
        const unfixed = results.total_failures_detected - results.total_fixes_applied;
        const efficiencyPenalty = unfixed * 5 + results.retry_count * 3;
        const final = Math.max(0, Math.min(100, base + speedBonus - efficiencyPenalty));

        return { base, speedBonus, efficiencyPenalty: -efficiencyPenalty, final };
    };

    const score = calculateScore(results);

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            {/* Hero Header with Description */}
            <div style={{ 
                marginBottom: '40px',
                animation: 'fadeInUp 0.6s ease-out',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '16px' }}>
                    <div style={{
                        width: '72px', 
                        height: '72px', 
                        borderRadius: '18px',
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        boxShadow: '0 8px 24px rgba(139, 92, 246, 0.35)',
                        animation: 'float 3s ease-in-out infinite',
                        color: 'white',
                    }}>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                        </svg>
                    </div>
                    <div>
                        <h1 style={{ 
                            fontSize: '2.75rem', 
                            fontWeight: '700', 
                            marginBottom: '8px',
                            letterSpacing: '-0.02em',
                            background: 'linear-gradient(135deg, var(--text-primary) 0%, #8b5cf6 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}>Autonomous Repo Heal</h1>
                        <p style={{ 
                            color: 'var(--text-muted)', 
                            fontSize: '1.125rem',
                            maxWidth: '600px',
                        }}>
                            AI-powered autonomous code healing agent
                        </p>
                    </div>
                </div>
                
                {/* Feature Description Cards */}
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(4, 1fr)', 
                    gap: '16px',
                    marginTop: '28px',
                }}>
                    {[
                        { icon: (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>), title: 'Detect Issues', desc: 'Scans for linting, syntax, and logic errors', color: '#8b5cf6' },
                        { icon: (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>), title: 'Generate Fixes', desc: 'AI creates targeted fixes for each issue', color: '#a78bfa' },
                        { icon: (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>), title: 'Test & Verify', desc: 'Runs tests in Docker sandbox', color: '#22c55e' },
                        { icon: (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>), title: 'Create PR', desc: 'Submits fixes via pull request', color: '#8b5cf6' },
                    ].map((item, idx) => (
                        <div key={idx} style={{
                            padding: '20px',
                            background: 'var(--bg-secondary)',
                            borderRadius: '14px',
                            border: '1px solid var(--border-color)',
                            animation: `fadeInUp 0.5s ease-out ${0.1 + idx * 0.1}s both`,
                            transition: 'border-color 0.2s ease, transform 0.2s ease',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = item.color + '40'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                            <div style={{ 
                                width: '40px',
                                height: '40px',
                                borderRadius: '10px',
                                background: `linear-gradient(135deg, ${item.color}20, ${item.color}10)`,
                                border: `1px solid ${item.color}30`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: item.color,
                                marginBottom: '12px',
                            }}>{item.icon}</div>
                            <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '4px', color: 'var(--text-primary)' }}>{item.title}</h4>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ===== INPUT SECTION ===== */}
            <div style={{
                background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-tertiary) 100%)', 
                borderRadius: '16px', 
                padding: '32px',
                border: '1px solid var(--border-color)', 
                marginBottom: '32px',
                animation: 'fadeInUp 0.5s ease-out 0.3s both',
            }}>
                <h2 style={{ 
                    fontSize: '1.5rem', 
                    fontWeight: '600', 
                    marginBottom: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                }}>
                    <span style={{ fontSize: '1.25rem' }}>🚀</span> Run Healing Agent
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                    <div>
                        <label style={{ 
                            display: 'block', 
                            fontSize: '0.9375rem', 
                            fontWeight: '600', 
                            marginBottom: '10px', 
                            color: 'var(--text-secondary)' 
                        }}>
                            Repository URL
                        </label>
                        <input
                            type="text"
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                            placeholder="https://github.com/owner/repo"
                            disabled={isRunning}
                            style={{
                                width: '100%', 
                                padding: '14px 18px', 
                                borderRadius: '12px',
                                border: '1px solid var(--border-color)', 
                                background: 'var(--bg-primary)',
                                color: 'var(--text-primary)', 
                                fontSize: '1rem',
                                outline: 'none', 
                                boxSizing: 'border-box',
                                transition: 'border-color 0.2s ease',
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ 
                            display: 'block', 
                            fontSize: '0.9375rem', 
                            fontWeight: '600', 
                            marginBottom: '10px', 
                            color: 'var(--text-secondary)' 
                        }}>
                            Team Name
                        </label>
                        <input
                            type="text"
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                            placeholder="e.g., Rift Organisers"
                            disabled={isRunning}
                            style={{
                                width: '100%', 
                                padding: '14px 18px', 
                                borderRadius: '12px',
                                border: '1px solid var(--border-color)', 
                                background: 'var(--bg-primary)',
                                color: 'var(--text-primary)', 
                                fontSize: '1rem',
                                outline: 'none', 
                                boxSizing: 'border-box',
                                transition: 'border-color 0.2s ease',
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ 
                            display: 'block', 
                            fontSize: '0.9375rem', 
                            fontWeight: '600', 
                            marginBottom: '10px', 
                            color: 'var(--text-secondary)' 
                        }}>
                            Leader Name
                        </label>
                        <input
                            type="text"
                            value={leaderName}
                            onChange={(e) => setLeaderName(e.target.value)}
                            placeholder="e.g., Saiyam Kumar"
                            disabled={isRunning}
                            style={{
                                width: '100%', 
                                padding: '14px 18px', 
                                borderRadius: '12px',
                                border: '1px solid var(--border-color)', 
                                background: 'var(--bg-primary)',
                                color: 'var(--text-primary)', 
                                fontSize: '1rem',
                                outline: 'none', 
                                boxSizing: 'border-box',
                                transition: 'border-color 0.2s ease',
                            }}
                        />
                    </div>
                </div>

                {/* Branch Preview */}
                {teamName && leaderName && (
                    <div style={{
                        padding: '14px 18px', 
                        borderRadius: '10px', 
                        marginBottom: '24px',
                        background: 'var(--bg-primary)', 
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-secondary)', 
                        fontSize: '0.9375rem', 
                        fontFamily: 'var(--font-mono)',
                    }}>
                        Branch: <span style={{ color: '#10b981', fontWeight: '600' }}>
                            {`${teamName.toUpperCase().replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, '_')}_${leaderName.toUpperCase().replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, '_')}_AI_Fix`}
                        </span>
                    </div>
                )}

                <button
                    onClick={handleRunAgent}
                    disabled={isRunning || !repoUrl || !teamName || !leaderName}
                    style={{
                        padding: '16px 40px', 
                        borderRadius: '12px', 
                        border: 'none',
                        background: isRunning ? '#6b7280' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white', 
                        fontWeight: '700', 
                        fontSize: '1.0625rem',
                        cursor: isRunning ? 'not-allowed' : 'pointer',
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '10px',
                        boxShadow: isRunning ? 'none' : '0 6px 20px rgba(16, 185, 129, 0.4)',
                        transition: 'all 0.25s ease',
                    }}
                >
                    {isRunning ? (
                        <>
                            <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⚙️</span>
                            Running Agent...
                        </>
                    ) : (
                        <>🤖 Run Healing Agent</>
                    )}
                </button>

                {error && (
                    <div style={{
                        marginTop: '16px', 
                        padding: '16px 20px', 
                        borderRadius: '12px',
                        background: 'rgba(239, 68, 68, 0.1)', 
                        color: '#ef4444', 
                        fontSize: '1rem',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                    }}>
                        ❌ {error}
                    </div>
                )}
            </div>

            {/* ===== PROGRESS LOGS ===== */}
            {progressLogs.length > 0 && (
                <div style={{
                    background: '#0f172a', borderRadius: '12px', padding: '16px',
                    marginBottom: '24px', maxHeight: '250px', overflowY: 'auto',
                    border: '1px solid #1e293b', fontFamily: 'monospace', fontSize: '0.82rem',
                }}>
                    <div style={{ color: '#64748b', marginBottom: '8px', fontWeight: '600', fontFamily: 'sans-serif' }}>
                        📋 Agent Logs
                    </div>
                    {progressLogs.map((log, i) => (
                        <div key={i} style={{ color: '#e2e8f0', lineHeight: '1.6' }}>
                            <span style={{ color: '#64748b' }}>[{log.time}]</span>{' '}
                            <span style={{ color: '#10b981' }}>[{log.stage}]</span>{' '}
                            {log.message}
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            )}

            {/* ===== RESULTS SECTION ===== */}
            {results && (
                <>
                    {/* Run Summary + Score — side by side */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>

                        {/* Run Summary Card */}
                        <div style={{
                            background: 'var(--bg-secondary)', borderRadius: '12px', padding: '24px',
                            border: '1px solid var(--border-color)',
                        }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '16px' }}>
                                📊 Run Summary
                            </h2>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <SummaryItem label="Repository" value={`${results.repo.split('/').slice(-2).join('/')}`} />
                                <SummaryItem label="Branch Created" value={results.branch_created} mono />
                                <SummaryItem label="Failures Detected" value={results.total_failures_detected} highlight="red" />
                                <SummaryItem label="Fixes Applied" value={results.total_fixes_applied} highlight="green" />
                                <SummaryItem
                                    label="CI Status"
                                    value={
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                            padding: '2px 10px', borderRadius: '999px', fontSize: '0.82rem',
                                            fontWeight: '600',
                                            background: STATUS_STYLES[results.final_ci_status]?.bg || '#f3f4f6',
                                            color: STATUS_STYLES[results.final_ci_status]?.color || '#374151',
                                        }}>
                                            {STATUS_STYLES[results.final_ci_status]?.icon} {results.final_ci_status}
                                        </span>
                                    }
                                />
                                <SummaryItem label="Total Time" value={formatTime(results.execution_time)} />
                            </div>

                            {results.pr_url && (
                                <a
                                    href={results.pr_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'inline-block', marginTop: '16px', padding: '8px 20px',
                                        borderRadius: '8px', background: '#8b5cf6', color: 'white',
                                        textDecoration: 'none', fontWeight: '500', fontSize: '0.9rem',
                                    }}
                                >
                                    🔗 View Pull Request
                                </a>
                            )}
                        </div>

                        {/* Score Breakdown Panel */}
                        <div style={{
                            background: 'var(--bg-secondary)', borderRadius: '12px', padding: '24px',
                            border: '1px solid var(--border-color)',
                        }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '16px' }}>
                                🏆 Score Breakdown
                            </h2>

                            <div style={{
                                textAlign: 'center', marginBottom: '20px',
                            }}>
                                <div style={{
                                    fontSize: '3.5rem', fontWeight: '800',
                                    background: score.final >= 80 ? 'linear-gradient(135deg, #10b981, #059669)' :
                                               score.final >= 50 ? 'linear-gradient(135deg, #f59e0b, #d97706)' :
                                                                    'linear-gradient(135deg, #ef4444, #dc2626)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    lineHeight: '1.1',
                                }}>
                                    {score.final}
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                                    out of 100
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <ScoreRow label="Base Score" value={score.base} color="#8b5cf6" />
                                <ScoreRow label="Speed Bonus" value={score.speedBonus > 0 ? `+${score.speedBonus}` : '0'} color="#10b981" />
                                <ScoreRow label="Efficiency Penalty" value={score.efficiencyPenalty} color="#ef4444" />
                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                                    <ScoreRow label="Final Score" value={score.final} color="#8b5cf6" bold />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Fixes Applied Table */}
                    {results.fixes && results.fixes.length > 0 && (
                        <div style={{
                            background: 'var(--bg-secondary)', borderRadius: '12px', padding: '24px',
                            border: '1px solid var(--border-color)', marginBottom: '24px',
                        }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '16px' }}>
                                🔧 Fixes Applied
                            </h2>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                            <th style={thStyle}>File</th>
                                            <th style={thStyle}>Bug Type</th>
                                            <th style={thStyle}>Line</th>
                                            <th style={thStyle}>Commit Message</th>
                                            <th style={thStyle}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.fixes.map((fix, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={tdStyle}>
                                                    <code style={{ fontSize: '0.8rem' }}>{fix.file}</code>
                                                </td>
                                                <td style={tdStyle}>
                                                    <BugTypeBadge type={fix.bug_type} />
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'center' }}>{fix.line}</td>
                                                <td style={tdStyle}>
                                                    <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                                        {fix.commitMessage || '—'}
                                                    </span>
                                                </td>
                                                <td style={tdStyle}>
                                                    <StatusBadge status={fix.status} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* CI/CD Timeline */}
                    {results.ci_timeline && results.ci_timeline.length > 0 && (
                        <div style={{
                            background: 'var(--bg-secondary)', borderRadius: '12px', padding: '24px',
                            border: '1px solid var(--border-color)', marginBottom: '24px',
                        }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '16px' }}>
                                🔄 CI/CD Timeline
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {results.ci_timeline.map((entry, i) => (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'center', gap: '16px',
                                        padding: '12px 16px', borderRadius: '8px',
                                        background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                                    }}>
                                        <div style={{
                                            width: '32px', height: '32px', borderRadius: '50%',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '0.85rem', fontWeight: '700', color: 'white',
                                            background: entry.status === 'PASSED' ? '#10b981' :
                                                       entry.status === 'FAILED' ? '#ef4444' : '#6b7280',
                                        }}>
                                            {entry.iteration}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                                                Attempt #{entry.iteration}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {new Date(entry.timestamp).toLocaleString()}
                                                {entry.commitSha && ` • commit ${entry.commitSha}`}
                                            </div>
                                        </div>
                                        <span style={{
                                            padding: '4px 12px', borderRadius: '999px',
                                            fontSize: '0.8rem', fontWeight: '600',
                                            background: STATUS_STYLES[entry.status]?.bg || '#f3f4f6',
                                            color: STATUS_STYLES[entry.status]?.color || '#374151',
                                        }}>
                                            {STATUS_STYLES[entry.status]?.icon} {entry.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* CSS Keyframes */}
            <style jsx>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-8px); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }
            `}</style>
        </div>
    );
}

// ===== Sub-components =====

function SummaryItem({ label, value, mono, highlight }) {
    return (
        <div style={{ padding: '8px 0' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
            <div style={{
                fontSize: '0.95rem', fontWeight: '600',
                fontFamily: mono ? 'monospace' : 'inherit',
                color: highlight === 'red' ? '#ef4444' : highlight === 'green' ? '#10b981' : 'var(--text-primary)',
                wordBreak: 'break-all',
            }}>
                {value}
            </div>
        </div>
    );
}

function ScoreRow({ label, value, color, bold }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: bold ? '600' : '400' }}>{label}</span>
            <span style={{ color, fontWeight: bold ? '700' : '600', fontSize: bold ? '1.1rem' : '0.95rem' }}>{value}</span>
        </div>
    );
}

function BugTypeBadge({ type }) {
    const style = BUG_TYPE_COLORS[type] || { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
    return (
        <span style={{
            display: 'inline-block', padding: '2px 10px', borderRadius: '999px',
            fontSize: '0.75rem', fontWeight: '700', fontFamily: 'monospace',
            background: style.bg, color: style.color, border: `1px solid ${style.border}`,
        }}>
            {type}
        </span>
    );
}

function StatusBadge({ status }) {
    const map = {
        applied: { bg: '#d1fae5', color: '#065f46', label: '✅ Applied' },
        skipped: { bg: '#f3f4f6', color: '#6b7280', label: '⏭️ Skipped' },
        unfixable: { bg: '#fef3c7', color: '#92400e', label: '⚠️ Unfixable' },
        error: { bg: '#fee2e2', color: '#991b1b', label: '❌ Error' },
        commit_failed: { bg: '#fee2e2', color: '#991b1b', label: '❌ Commit Failed' },
    };
    const s = map[status] || { bg: '#f3f4f6', color: '#374151', label: status };
    return (
        <span style={{
            display: 'inline-block', padding: '2px 10px', borderRadius: '999px',
            fontSize: '0.75rem', fontWeight: '600', background: s.bg, color: s.color,
        }}>
            {s.label}
        </span>
    );
}

// Helper functions
function formatTime(ms) {
    if (!ms) return '—';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    if (minutes === 0) return `${seconds}s`;
    return `${minutes}m ${remaining}s`;
}

// Table styles
const thStyle = {
    textAlign: 'left', padding: '10px 12px', fontWeight: '600',
    color: 'var(--text-muted)', fontSize: '0.82rem',
};

const tdStyle = {
    padding: '10px 12px', verticalAlign: 'middle',
};
