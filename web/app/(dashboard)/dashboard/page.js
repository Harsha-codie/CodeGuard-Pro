'use client';

import { useState, useEffect } from 'react';

// Modern SVG Icons
const Icons = {
    folder: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
    ),
    shield: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="m9 12 2 2 4-4"/>
        </svg>
    ),
    analytics: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18"/>
            <path d="M18 17V9"/>
            <path d="M13 17V5"/>
            <path d="M8 17v-3"/>
        </svg>
    ),
    checkCircle: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
    ),
    plus: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
        </svg>
    ),
    rocket: (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
            <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
            <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
        </svg>
    ),
    activity: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
    ),
};

export default function DashboardPage() {
    const [stats, setStats] = useState(null);
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const res = await fetch('/api/dashboard/stats');
            const data = await res.json();
            if (data.success) {
                setStats(data.stats);
                setRecentActivity(data.recentActivity || []);
            }
        } catch (err) {
            console.error('Error fetching dashboard data:', err);
        } finally {
            setLoading(false);
        }
    };

    const timeAgo = (date) => {
        if (!date) return 'N/A';
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
        return `${Math.floor(seconds / 86400)} days ago`;
    };

    return (
        <div style={{ maxWidth: '1400px' }}>
            {/* Hero Header */}
            <div style={{ 
                marginBottom: '48px',
                animation: 'fadeInUp 0.6s ease-out',
            }}>
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '16px',
                    marginBottom: '16px' 
                }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(139, 92, 246, 0.1))',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#8b5cf6',
                        animation: 'float 3s ease-in-out infinite',
                    }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                        </svg>
                    </div>
                    <h1 style={{ 
                        fontSize: '2.75rem', 
                        fontWeight: '700',
                        letterSpacing: '-0.02em',
                        background: 'linear-gradient(135deg, var(--text-primary) 0%, #8b5cf6 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}>Welcome back!</h1>
                </div>
                <p style={{ 
                    fontSize: '1.25rem', 
                    color: 'var(--text-secondary)',
                    maxWidth: '600px',
                }}>
                    Here's an overview of your code compliance status and recent activity.
                </p>
            </div>

            {/* Loading State */}
            {loading && (
                <div style={{ 
                    textAlign: 'center', 
                    padding: '80px 40px',
                    animation: 'fadeIn 0.3s ease-out',
                }}>
                    <div style={{ 
                        width: '56px', 
                        height: '56px', 
                        border: '3px solid var(--border-color)', 
                        borderTopColor: 'var(--accent-primary)', 
                        borderRadius: '50%', 
                        animation: 'spin 1s linear infinite', 
                        margin: '0 auto 24px' 
                    }} />
                    <p style={{ fontSize: '1.125rem', color: 'var(--text-muted)' }}>Loading your dashboard...</p>
                </div>
            )}

            {!loading && (
                <>
                    {/* Stats Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '24px',
                        marginBottom: '40px',
                    }}>
                        <StatCard 
                            title="Active Projects" 
                            value={stats?.projectsCount || 0} 
                            icon={Icons.folder}
                            color="#8b5cf6"
                            delay={0}
                        />
                        <StatCard 
                            title="Total Rules" 
                            value={stats?.rulesCount || 0} 
                            icon={Icons.shield}
                            color="#8b5cf6"
                            delay={0.1}
                        />
                        <StatCard 
                            title="PRs Analyzed" 
                            value={stats?.analysesCount || 0} 
                            icon={Icons.analytics}
                            color="#8b5cf6"
                            delay={0.2}
                        />
                        <StatCard 
                            title="Success Rate" 
                            value={`${stats?.fixRate || 0}%`} 
                            icon={Icons.checkCircle}
                            color="#22c55e"
                            delay={0.3}
                        />
                    </div>

                    {/* Quick Actions (shown when no data) */}
                    {stats?.projectsCount === 0 && (
                        <div className="card" style={{ 
                            textAlign: 'center', 
                            padding: '60px 40px', 
                            marginBottom: '32px',
                            background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-tertiary) 100%)',
                            border: '1px dashed var(--border-color)',
                            animation: 'fadeInUp 0.6s ease-out 0.4s both',
                            position: 'relative',
                            overflow: 'hidden',
                        }}>
                            {/* Background animated gradient */}
                            <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                width: '300px',
                                height: '300px',
                                background: 'radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 70%)',
                                transform: 'translate(-50%, -50%)',
                                animation: 'pulse 4s ease-in-out infinite',
                            }} />
                            
                            <div style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(139, 92, 246, 0.1))',
                                border: '1px solid rgba(139, 92, 246, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#8b5cf6',
                                margin: '0 auto 24px',
                                animation: 'float 3s ease-in-out infinite',
                                position: 'relative',
                            }}>{Icons.rocket}</div>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: '600', marginBottom: '12px' }}>Get Started with CodeGuard</h3>
                            <p style={{ 
                                fontSize: '1.125rem', 
                                color: 'var(--text-muted)', 
                                marginBottom: '32px',
                                maxWidth: '500px',
                                margin: '0 auto 32px',
                            }}>
                                Add your first project and configure compliance rules to start monitoring your code quality.
                            </p>
                            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                                <a href="/projects" className="btn btn-primary" style={{ 
                                    padding: '16px 32px', 
                                    fontSize: '1.0625rem',
                                    background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
                                }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 5v14M5 12h14"/>
                                    </svg>
                                    Add First Project
                                </a>
                                <a href="/rules/templates" className="btn btn-secondary" style={{ 
                                    padding: '16px 32px', 
                                    fontSize: '1.0625rem' 
                                }}>
                                    Browse Rule Templates
                                </a>
                            </div>
                        </div>
                    )}

                    {/* Recent Activity */}
                    <div className="card" style={{ 
                        padding: '32px',
                        animation: 'fadeInUp 0.6s ease-out 0.5s both',
                        position: 'relative',
                        overflow: 'hidden',
                    }}>
                        {/* Subtle animated border gradient */}
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '2px',
                            background: 'linear-gradient(90deg, transparent, #8b5cf6, transparent)',
                            opacity: 0.5,
                        }} />
                        
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            marginBottom: '24px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '10px',
                                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(139, 92, 246, 0.1))',
                                    border: '1px solid rgba(139, 92, 246, 0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#8b5cf6',
                                }}>{Icons.activity}</div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '4px' }}>Recent Analysis Runs</h3>
                                        {/* Live indicator */}
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '4px 10px',
                                            borderRadius: '9999px',
                                            background: 'rgba(34, 197, 94, 0.15)',
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            color: '#22c55e',
                                        }}>
                                            <span style={{
                                                width: '6px',
                                                height: '6px',
                                                borderRadius: '50%',
                                                background: '#22c55e',
                                                animation: 'pulse 1.5s ease-in-out infinite',
                                            }} />
                                            LIVE
                                        </span>
                                    </div>
                                    <p style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>
                                        Latest PR compliance checks from your projects
                                    </p>
                                </div>
                            </div>
                            {recentActivity.length > 0 && (
                                <a href="/history" style={{ 
                                    fontSize: '1rem', 
                                    color: '#8b5cf6',
                                    textDecoration: 'none',
                                    fontWeight: '500',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'gap 0.2s ease',
                                }}>
                                    View all 
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M5 12h14M12 5l7 7-7 7"/>
                                    </svg>
                                </a>
                            )}
                        </div>
                        
                        {recentActivity.length === 0 ? (
                            <div style={{ 
                                textAlign: 'center', 
                                padding: '48px', 
                                background: 'var(--bg-secondary)',
                                borderRadius: 'var(--radius-lg)',
                            }}>
                                <div style={{ 
                                    width: '60px',
                                    height: '60px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(139, 92, 246, 0.1))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto 16px',
                                    color: '#8b5cf6',
                                    opacity: 0.6,
                                }}>{Icons.analytics}</div>
                                <p style={{ 
                                    fontSize: '1.125rem', 
                                    color: 'var(--text-muted)',
                                    maxWidth: '400px',
                                    margin: '0 auto',
                                }}>
                                    No analyses yet. Connect a GitHub repository and set up a webhook to start analyzing PRs.
                                </p>
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                                        <th style={{ padding: '16px 0', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Project</th>
                                        <th style={{ padding: '16px 0', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PR</th>
                                        <th style={{ padding: '16px 0', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                                        <th style={{ padding: '16px 0', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Violations</th>
                                        <th style={{ padding: '16px 0', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentActivity.map((activity, idx) => (
                                        <TableRow 
                                            key={activity.id}
                                            project={activity.project}
                                            pr={`#${activity.prNumber}`}
                                            status={activity.status?.toLowerCase() || 'pending'}
                                            violations={activity.violationsCount}
                                            time={timeAgo(activity.createdAt)}
                                            delay={idx * 0.05}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            )}

            <style jsx>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
                @keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            `}</style>
        </div>
    );
}

function StatCard({ title, value, icon, color, delay = 0 }) {
    const [isHovered, setIsHovered] = useState(false);
    
    return (
        <div 
            style={{ 
                background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-tertiary) 100%)',
                border: `1px solid ${isHovered ? color + '40' : 'var(--border-color)'}`,
                borderRadius: '16px',
                padding: '28px',
                display: 'flex', 
                alignItems: 'center', 
                gap: '20px',
                position: 'relative',
                overflow: 'hidden',
                animation: `fadeInUp 0.5s ease-out ${delay}s both`,
                transition: 'all 0.3s ease',
                cursor: 'default',
                transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                boxShadow: isHovered ? `0 8px 30px ${color}20` : 'none',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Animated background gradient */}
            <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '200px',
                height: '200px',
                background: `radial-gradient(circle, ${color}12 0%, transparent 70%)`,
                transform: isHovered ? 'scale(1.2)' : 'scale(1)',
                transition: 'transform 0.4s ease',
            }} />
            
            {/* Shimmer effect on hover */}
            {isHovered && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '50%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)',
                    animation: 'shimmer 1.5s ease-in-out infinite',
                }} />
            )}
            
            <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '14px',
                background: `linear-gradient(135deg, ${color}20, ${color}10)`,
                border: `1px solid ${color}30`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: color,
                position: 'relative',
                transition: 'all 0.3s ease',
                transform: isHovered ? 'scale(1.05)' : 'scale(1)',
            }}>
                {icon}
                {/* Live pulse indicator */}
                <div style={{
                    position: 'absolute',
                    top: '-3px',
                    right: '-3px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: color,
                    animation: 'pulse 2s ease-in-out infinite',
                    boxShadow: `0 0 8px ${color}`,
                }} />
            </div>
            <div style={{ position: 'relative', zIndex: 1 }}>
                <p style={{ 
                    fontSize: '0.9375rem', 
                    color: 'var(--text-muted)', 
                    marginBottom: '6px',
                    fontWeight: '500',
                }}>{title}</p>
                <p style={{ 
                    fontSize: '2.25rem', 
                    fontWeight: '700',
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.02em',
                }}>{value}</p>
            </div>
        </div>
    );
}

function TableRow({ project, pr, status, violations, time, delay = 0 }) {
    const [isHovered, setIsHovered] = useState(false);
    
    const statusColors = {
        success: '#22c55e',
        completed: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        failed: '#ef4444',
        pending: '#8b5cf6',
    };
    const statusLabels = {
        success: 'Passed',
        completed: 'Passed',
        warning: 'Warnings',
        error: 'Failed',
        failed: 'Failed',
        pending: 'Pending',
    };
    
    const color = statusColors[status] || statusColors.pending;
    const label = statusLabels[status] || 'Pending';

    return (
        <tr 
            style={{ 
                borderBottom: '1px solid var(--border-color)',
                animation: `fadeIn 0.4s ease-out ${delay}s both`,
                background: isHovered ? 'rgba(139, 92, 246, 0.04)' : 'transparent',
                transition: 'background 0.2s ease',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <td style={{ padding: '18px 0', fontSize: '1rem', fontWeight: '500' }}>{project}</td>
            <td style={{ padding: '18px 0', fontSize: '1rem', color: '#8b5cf6', fontWeight: '500' }}>{pr}</td>
            <td style={{ padding: '18px 0' }}>
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    background: `${color}18`,
                    color: color,
                }}>
                    <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: color,
                        animation: status === 'pending' ? 'pulse 1.5s ease-in-out infinite' : 'none',
                    }} />
                    {label}
                </span>
            </td>
            <td style={{ padding: '18px 0', fontSize: '1rem' }}>{violations}</td>
            <td style={{ padding: '18px 0', fontSize: '1rem', color: 'var(--text-muted)' }}>{time}</td>
        </tr>
    );
}
