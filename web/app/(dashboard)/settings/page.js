'use client';

import { useState, useEffect } from 'react';

const defaultSettings = {
    orgName: '',
    defaultSeverity: 'WARNING',
    autoCreateJira: false,
    jiraProject: '',
    jiraApiUrl: '',
    jiraEmail: '',
    notifyOnSuccess: false,
    notifyOnFailure: true,
    slackWebhook: '',
    openaiApiKey: '',
};

export default function SettingsPage() {
    const [settings, setSettings] = useState(defaultSettings);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Load settings from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem('complianceSettings');
        if (stored) {
            try {
                setSettings({ ...defaultSettings, ...JSON.parse(stored) });
            } catch (e) {
                console.error('Error loading settings:', e);
            }
        }
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            // Save to localStorage
            localStorage.setItem('complianceSettings', JSON.stringify(settings));
            
            // Also could save to API in future
            // await fetch('/api/settings', { method: 'POST', body: JSON.stringify(settings) });
            
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            alert('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAllRules = async () => {
        if (!confirm('Are you sure you want to delete ALL rules from ALL projects? This cannot be undone!')) return;
        if (!confirm('This is your final warning. ALL rules will be permanently deleted. Continue?')) return;

        setDeleting(true);
        try {
            const res = await fetch('/api/rules?deleteAll=true', { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                alert(`Deleted ${data.count || 0} rules successfully`);
            } else {
                alert('Failed to delete rules: ' + data.error);
            }
        } catch (err) {
            alert('Error deleting rules');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div>
            <style jsx>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-6px); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
            `}</style>

            {/* Header */}
            <div style={{ 
                marginBottom: '40px',
                animation: 'fadeInUp 0.5s ease-out'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        boxShadow: '0 8px 32px rgba(139, 92, 246, 0.25)',
                        animation: 'float 3s ease-in-out infinite'
                    }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                        </svg>
                    </div>
                    <div>
                        <h1 style={{ 
                            fontSize: '2.5rem', 
                            fontWeight: '700',
                            margin: 0,
                            background: 'linear-gradient(135deg, var(--text-primary) 0%, #8b5cf6 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text'
                        }}>Settings</h1>
                        <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '1.125rem' }}>
                            Configure your organization's compliance preferences
                        </p>
                    </div>
                </div>
            </div>

            {/* Environment Config Info */}
            <div className="card" style={{ 
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(139, 92, 246, 0.05))', 
                borderColor: 'rgba(139, 92, 246, 0.3)',
                marginBottom: '32px',
                padding: '24px',
                animation: 'fadeInUp 0.5s ease-out 0.1s both'
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(139, 92, 246, 0.1))',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#8b5cf6',
                        flexShrink: 0
                    }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="16" x2="12" y2="12"/>
                            <line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                    </div>
                    <div>
                        <strong style={{ color: '#8b5cf6', fontSize: '1.125rem' }}>Server Configuration</strong>
                        <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: '1.6' }}>
                            Core integrations (Slack, JIRA, Gemini AI) are configured via environment variables on the server. 
                            The settings below are stored in your browser for UI preferences.
                        </p>
                        <div style={{ 
                            marginTop: '16px', 
                            fontSize: '0.9rem', 
                            fontFamily: 'monospace', 
                            color: 'var(--text-muted)',
                            display: 'flex',
                            gap: '12px',
                            flexWrap: 'wrap'
                        }}>
                            <code style={{ background: 'rgba(139, 92, 246, 0.15)', padding: '4px 10px', borderRadius: '6px' }}>SLACK_WEBHOOK_URL</code>
                            <code style={{ background: 'rgba(139, 92, 246, 0.15)', padding: '4px 10px', borderRadius: '6px' }}>JIRA_HOST</code>
                            <code style={{ background: 'rgba(139, 92, 246, 0.15)', padding: '4px 10px', borderRadius: '6px' }}>GEMINI_API_KEY</code>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>
                {/* General Settings */}
                <div className="card" style={{ 
                    padding: '28px',
                    animation: 'fadeInUp 0.5s ease-out 0.2s both'
                }}>
                    <h3 style={{ marginBottom: '24px', fontSize: '1.375rem', fontWeight: '600' }}>Organization</h3>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '10px', fontWeight: '500' }}>
                            Organization Name
                        </label>
                        <input
                            type="text"
                            className="input"
                            placeholder="Your Company Name"
                            value={settings.orgName}
                            onChange={(e) => setSettings({ ...settings, orgName: e.target.value })}
                            style={{ fontSize: '1rem', padding: '14px 16px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '10px', fontWeight: '500' }}>
                            Default Rule Severity
                        </label>
                        <select
                            className="input"
                            value={settings.defaultSeverity}
                            onChange={(e) => setSettings({ ...settings, defaultSeverity: e.target.value })}
                            style={{ fontSize: '1rem', padding: '14px 16px' }}
                        >
                            <option value="WARNING">Warning</option>
                            <option value="CRITICAL">Critical</option>
                        </select>
                    </div>
                </div>

                {/* AI Configuration */}
                <div className="card" style={{ 
                    padding: '28px',
                    animation: 'fadeInUp 0.5s ease-out 0.3s both'
                }}>
                    <h3 style={{ marginBottom: '24px', fontSize: '1.375rem', fontWeight: '600' }}>AI Configuration</h3>
                    
                    <div style={{ 
                        padding: '16px', 
                        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05))', 
                        borderRadius: '12px',
                        marginBottom: '20px',
                        fontSize: '0.95rem',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px'
                    }}>
                        <span style={{ fontSize: '1.25rem' }}>💡</span>
                        <span>AI features use <code style={{ background: 'rgba(245, 158, 11, 0.2)', padding: '2px 8px', borderRadius: '4px' }}>GEMINI_API_KEY</code> from server environment. 
                        This field stores a reference for future user-specific keys.</span>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '10px', fontWeight: '500' }}>
                            OpenAI API Key (Optional)
                        </label>
                        <input
                            type="password"
                            className="input"
                            placeholder="sk-..."
                            value={settings.openaiApiKey}
                            onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                            style={{ fontSize: '1rem', padding: '14px 16px' }}
                        />
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                            For future per-user AI features. Currently server uses Gemini.
                        </p>
                    </div>
                </div>

                {/* Jira Integration */}
                <div className="card" style={{ 
                    padding: '28px',
                    animation: 'fadeInUp 0.5s ease-out 0.4s both'
                }}>
                    <h3 style={{ marginBottom: '24px', fontSize: '1.375rem', fontWeight: '600' }}>Jira Integration</h3>
                    
                    <div style={{ 
                        padding: '16px', 
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(139, 92, 246, 0.05))', 
                        borderRadius: '12px',
                        marginBottom: '20px',
                        fontSize: '0.95rem',
                        color: 'var(--text-secondary)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <span style={{ fontSize: '1.25rem' }}>⚙️</span>
                            <div>
                                <span>JIRA integration is configured via server environment variables:</span>
                                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <code style={{ background: 'rgba(139, 92, 246, 0.15)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>JIRA_HOST</code>
                                    <code style={{ background: 'rgba(139, 92, 246, 0.15)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>JIRA_EMAIL</code>
                                    <code style={{ background: 'rgba(139, 92, 246, 0.15)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>JIRA_API_TOKEN</code>
                                    <code style={{ background: 'rgba(139, 92, 246, 0.15)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>JIRA_PROJECT_KEY</code>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px',
                            cursor: 'pointer',
                        }}>
                            <input
                                type="checkbox"
                                checked={settings.autoCreateJira}
                                onChange={(e) => setSettings({ ...settings, autoCreateJira: e.target.checked })}
                                style={{ width: '22px', height: '22px', accentColor: 'var(--accent-primary)' }}
                            />
                            <span style={{ fontSize: '1rem' }}>Auto-create Jira tickets for CRITICAL violations (UI preference)</span>
                        </label>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '10px', fontWeight: '500' }}>
                            Jira Project Key
                        </label>
                        <input
                            type="text"
                            className="input"
                            placeholder="e.g., COMP"
                            value={settings.jiraProject}
                            onChange={(e) => setSettings({ ...settings, jiraProject: e.target.value })}
                            disabled={!settings.autoCreateJira}
                            style={{ opacity: settings.autoCreateJira ? 1 : 0.5, fontSize: '1rem', padding: '14px 16px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '10px', fontWeight: '500' }}>
                            Jira API URL
                        </label>
                        <input
                            type="text"
                            className="input"
                            placeholder="https://yourcompany.atlassian.net"
                            value={settings.jiraApiUrl}
                            onChange={(e) => setSettings({ ...settings, jiraApiUrl: e.target.value })}
                            disabled={!settings.autoCreateJira}
                            style={{ opacity: settings.autoCreateJira ? 1 : 0.5, fontSize: '1rem', padding: '14px 16px' }}
                        />
                    </div>
                </div>

                {/* Notifications */}
                <div className="card" style={{ 
                    padding: '28px',
                    animation: 'fadeInUp 0.5s ease-out 0.5s both'
                }}>
                    <h3 style={{ marginBottom: '24px', fontSize: '1.375rem', fontWeight: '600' }}>Notifications</h3>
                    
                    <div style={{ 
                        padding: '16px', 
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(139, 92, 246, 0.05))', 
                        borderRadius: '12px',
                        marginBottom: '20px',
                        fontSize: '0.95rem',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        <span style={{ fontSize: '1.25rem' }}>⚙️</span>
                        <span>Slack notifications use <code style={{ background: 'rgba(139, 92, 246, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>SLACK_WEBHOOK_URL</code> from server environment.</span>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px',
                            cursor: 'pointer',
                        }}>
                            <input
                                type="checkbox"
                                checked={settings.notifyOnSuccess}
                                onChange={(e) => setSettings({ ...settings, notifyOnSuccess: e.target.checked })}
                                style={{ width: '22px', height: '22px', accentColor: 'var(--accent-primary)' }}
                            />
                            <span style={{ fontSize: '1rem' }}>Notify on successful checks (UI preference)</span>
                        </label>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px',
                            cursor: 'pointer',
                        }}>
                            <input
                                type="checkbox"
                                checked={settings.notifyOnFailure}
                                onChange={(e) => setSettings({ ...settings, notifyOnFailure: e.target.checked })}
                                style={{ width: '22px', height: '22px', accentColor: 'var(--accent-primary)' }}
                            />
                            <span style={{ fontSize: '1rem' }}>Notify on failed checks</span>
                        </label>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '10px', fontWeight: '500' }}>
                            Slack Webhook URL
                        </label>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <input
                                type="text"
                                className="input"
                                placeholder="https://hooks.slack.com/services/..."
                                value={settings.slackWebhook}
                                onChange={(e) => setSettings({ ...settings, slackWebhook: e.target.value })}
                                style={{ flex: 1, fontSize: '1rem', padding: '14px 16px' }}
                            />
                            <button 
                                className="btn btn-secondary"
                                style={{ padding: '14px 24px', fontSize: '1rem', fontWeight: '500' }}
                                onClick={async () => {
                                    if (!settings.slackWebhook) {
                                        alert('Please enter a Slack webhook URL first');
                                        return;
                                    }
                                    try {
                                        const res = await fetch('/api/notifications/test', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ type: 'slack', destination: settings.slackWebhook })
                                        });
                                        const data = await res.json();
                                        alert(data.success ? 'Test notification sent!' : 'Failed to send: ' + data.error);
                                    } catch (err) {
                                        alert('Error sending test notification');
                                    }
                                }}
                            >
                                Test
                            </button>
                        </div>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="card" style={{ 
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    padding: '28px',
                    animation: 'fadeInUp 0.5s ease-out 0.6s both'
                }}>
                    <h3 style={{ marginBottom: '24px', color: 'var(--accent-error)', fontSize: '1.375rem', fontWeight: '600' }}>Danger Zone</h3>

                    <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.6' }}>
                        These actions are irreversible. Proceed with caution.
                    </p>

                    <button 
                        className="btn" 
                        onClick={handleDeleteAllRules}
                        disabled={deleting}
                        style={{
                            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.1))',
                            color: 'var(--accent-error)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            opacity: deleting ? 0.5 : 1,
                            padding: '14px 24px',
                            fontSize: '1rem',
                            fontWeight: '500',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {deleting ? 'Deleting...' : 'Delete All Rules'}
                    </button>
                </div>
            </div>

            {/* Save Button */}
            <div style={{ 
                marginTop: '32px', 
                display: 'flex', 
                justifyContent: 'flex-end', 
                alignItems: 'center', 
                gap: '20px',
                animation: 'fadeInUp 0.5s ease-out 0.7s both'
            }}>
                {saved && (
                    <span style={{ 
                        color: 'var(--accent-success)', 
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        animation: 'fadeInUp 0.3s ease-out'
                    }}>
                        <span style={{ 
                            width: '24px', 
                            height: '24px', 
                            borderRadius: '50%', 
                            background: 'rgba(34, 197, 94, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>✓</span>
                        Settings saved!
                    </span>
                )}
                <button 
                    className="btn btn-primary" 
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        padding: '16px 32px',
                        fontSize: '1.0625rem',
                        fontWeight: '600',
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                        boxShadow: '0 4px 16px rgba(139, 92, 246, 0.3)'
                    }}
                >
                    {saving ? 'Saving...' : 'Save Settings'}
                </button>
            </div>
        </div>
    );
}
