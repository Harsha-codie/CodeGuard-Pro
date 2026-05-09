'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function IntegrationsPage() {
    const searchParams = useSearchParams();
    const installationSuccess = searchParams.get('setup_action') === 'install';
    const installationId = searchParams.get('installation_id');
    
    const [installations, setInstallations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        fetchInstallations();
    }, []);

    const fetchInstallations = async () => {
        try {
            const res = await fetch('/api/github/installations');
            const data = await res.json();
            if (data.success) {
                setInstallations(data.installations || []);
            }
        } catch (err) {
            console.error('Error fetching installations:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleInstallApp = () => {
        // Redirect to GitHub App installation page
        const appSlug = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG || 'compliance-checker';
        window.location.href = `https://github.com/apps/${appSlug}/installations/new`;
    };

    const handleSyncRepos = async (installationId) => {
        setSyncing(true);
        try {
            const res = await fetch('/api/github/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ installationId })
            });
            const data = await res.json();
            if (data.success) {
                alert(`Synced ${data.projectsCreated || 0} new repositories`);
                fetchInstallations();
            } else {
                alert('Failed to sync: ' + data.error);
            }
        } catch (err) {
            alert('Error syncing repositories');
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div style={{ maxWidth: '1200px' }}>
            {/* Header */}
            <div style={{ 
                marginBottom: '40px',
                animation: 'fadeInUp 0.5s ease-out',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
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
                    flexShrink: 0,
                }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                </div>
                <div>
                    <h1 style={{ 
                        fontSize: '2.5rem', 
                        fontWeight: '700', 
                        marginBottom: '12px',
                        letterSpacing: '-0.02em',
                        background: 'linear-gradient(135deg, var(--text-primary) 0%, #8b5cf6 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}>Integrations</h1>
                    <p style={{ 
                        fontSize: '1.125rem',
                        color: 'var(--text-secondary)',
                        maxWidth: '600px',
                    }}>
                        Connect your GitHub repositories for automated compliance checking.
                    </p>
                </div>
            </div>

            {/* Success Banner */}
            {installationSuccess && (
                <div className="card" style={{ 
                    background: 'rgba(16, 185, 129, 0.1)', 
                    borderColor: 'rgba(16, 185, 129, 0.3)',
                    marginBottom: '28px',
                    padding: '24px',
                    animation: 'fadeInUp 0.5s ease-out 0.1s both',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: 'rgba(16, 185, 129, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#10b981',
                        }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                        </div>
                        <div>
                            <strong style={{ color: '#10b981', fontSize: '1.125rem' }}>GitHub App Installed Successfully!</strong>
                            <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '1rem' }}>
                                Installation ID: {installationId}. Click "Sync Repositories" to import your repos.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* GitHub App Status */}
            <div className="card" style={{ 
                marginBottom: '28px',
                background: 'rgba(16, 185, 129, 0.1)', 
                borderColor: 'rgba(16, 185, 129, 0.3)',
                padding: '24px',
                animation: 'fadeInUp 0.5s ease-out 0.2s both',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '1.5rem' }}>✅</span>
                    <div>
                        <strong style={{ color: 'var(--accent-success)', fontSize: '1.125rem' }}>Webhook Active</strong>
                        <p style={{ margin: '6px 0 0 0', color: 'var(--text-secondary)', fontSize: '1rem' }}>
                            GitHub webhooks are configured and ready. PRs will be automatically analyzed when opened.
                        </p>
                    </div>
                </div>
            </div>

            {/* GitHub Integration Card */}
            <div className="card" style={{ 
                marginBottom: '28px', 
                padding: '32px',
                animation: 'fadeInUp 0.5s ease-out 0.3s both',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            background: 'var(--bg-tertiary)',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '2rem'
                        }}>
                            🐙
                        </div>
                        <div>
                            <h3 style={{ marginBottom: '10px', fontSize: '1.5rem', fontWeight: '600' }}>GitHub</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '550px', lineHeight: '1.6' }}>
                                Install our GitHub App to automatically analyze pull requests. 
                                The app will run compliance checks on every PR and report violations.
                            </p>
                        </div>
                    </div>
                    <button className="btn btn-primary" onClick={handleInstallApp}>
                        Install GitHub App
                    </button>
                </div>
            </div>

            {/* Installations List */}
            <div className="card">
                <h3 style={{ marginBottom: '20px' }}>Active Installations</h3>
                
                {loading ? (
                    <p style={{ color: 'var(--text-muted)' }}>Loading installations...</p>
                ) : installations.length === 0 ? (
                    <div style={{ 
                        textAlign: 'center', 
                        padding: '40px',
                        color: 'var(--text-muted)'
                    }}>
                        <p style={{ fontSize: '2rem', marginBottom: '8px' }}>🔗</p>
                        <p>No GitHub installations yet.</p>
                        <p style={{ fontSize: '0.875rem' }}>
                            Install the GitHub App to connect your repositories.
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {installations.map((inst) => (
                            <div 
                                key={inst.id}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '16px',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: '8px'
                                }}
                            >
                                <div>
                                    <strong>{inst.account || `Installation ${inst.id}`}</strong>
                                    <p style={{ 
                                        margin: 0, 
                                        color: 'var(--text-muted)', 
                                        fontSize: '0.875rem' 
                                    }}>
                                        {inst.repositoryCount || 0} repositories • 
                                        Installed {inst.createdAt ? new Date(inst.createdAt).toLocaleDateString() : 'recently'}
                                    </p>
                                </div>
                                <button 
                                    className="btn btn-secondary"
                                    onClick={() => handleSyncRepos(inst.id)}
                                    disabled={syncing}
                                >
                                    {syncing ? 'Syncing...' : 'Sync Repositories'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* How it Works */}
            <div className="card" style={{ marginTop: '24px' }}>
                <h3 style={{ marginBottom: '20px' }}>How It Works</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
                    <div>
                        <div style={{ 
                            width: '40px', 
                            height: '40px', 
                            borderRadius: '50%', 
                            background: 'var(--accent-primary)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            marginBottom: '12px'
                        }}>1</div>
                        <h4 style={{ marginBottom: '8px' }}>Install App</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                            Click "Install GitHub App" and authorize access to your repositories.
                        </p>
                    </div>
                    
                    <div>
                        <div style={{ 
                            width: '40px', 
                            height: '48px', 
                            borderRadius: '50%', 
                            background: 'linear-gradient(135deg, var(--accent-primary) 0%, #8b5cf6 100%)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            fontSize: '1.125rem',
                            marginBottom: '16px'
                        }}>2</div>
                        <h4 style={{ marginBottom: '10px', fontSize: '1.125rem', fontWeight: '600' }}>Configure Rules</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', lineHeight: '1.6' }}>
                            Set up compliance rules for each project using templates or custom definitions.
                        </p>
                    </div>
                    
                    <div>
                        <div style={{ 
                            width: '48px', 
                            height: '48px', 
                            borderRadius: '50%', 
                            background: 'linear-gradient(135deg, var(--accent-primary) 0%, #8b5cf6 100%)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            fontSize: '1.125rem',
                            marginBottom: '16px'
                        }}>3</div>
                        <h4 style={{ marginBottom: '10px', fontSize: '1.125rem', fontWeight: '600' }}>Automatic Checks</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', lineHeight: '1.6' }}>
                            PRs are automatically analyzed and violations are reported as comments.
                        </p>
                    </div>
                </div>
            </div>
            
            <style jsx>{`
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}
