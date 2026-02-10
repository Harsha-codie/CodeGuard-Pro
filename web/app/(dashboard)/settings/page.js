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
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ marginBottom: '8px' }}>Settings</h1>
                <p style={{ color: 'var(--text-muted)' }}>
                    Configure your organization's compliance preferences.
                </p>
            </div>

            {/* Environment Config Info */}
            <div className="card" style={{ 
                background: 'rgba(59, 130, 246, 0.1)', 
                borderColor: 'rgba(59, 130, 246, 0.3)',
                marginBottom: '24px'
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <span style={{ fontSize: '1.25rem' }}>ℹ️</span>
                    <div>
                        <strong style={{ color: 'var(--accent-primary)' }}>Server Configuration</strong>
                        <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            Core integrations (Slack, JIRA, Gemini AI) are configured via environment variables on the server. 
                            The settings below are stored in your browser for UI preferences.
                        </p>
                        <div style={{ marginTop: '12px', fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                            <code>SLACK_WEBHOOK_URL</code> • <code>JIRA_HOST</code> • <code>GEMINI_API_KEY</code>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* General Settings */}
                <div className="card">
                    <h3 style={{ marginBottom: '20px' }}>Organization</h3>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            Organization Name
                        </label>
                        <input
                            type="text"
                            className="input"
                            placeholder="Your Company Name"
                            value={settings.orgName}
                            onChange={(e) => setSettings({ ...settings, orgName: e.target.value })}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            Default Rule Severity
                        </label>
                        <select
                            className="input"
                            value={settings.defaultSeverity}
                            onChange={(e) => setSettings({ ...settings, defaultSeverity: e.target.value })}
                        >
                            <option value="WARNING">Warning</option>
                            <option value="CRITICAL">Critical</option>
                        </select>
                    </div>
                </div>

                {/* AI Configuration */}
                <div className="card">
                    <h3 style={{ marginBottom: '20px' }}>AI Configuration</h3>
                    
                    <div style={{ 
                        padding: '12px', 
                        background: 'rgba(245, 158, 11, 0.1)', 
                        borderRadius: '8px',
                        marginBottom: '16px',
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)'
                    }}>
                        💡 AI features use <code>GEMINI_API_KEY</code> from server environment. 
                        This field stores a reference for future user-specific keys.
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            OpenAI API Key (Optional)
                        </label>
                        <input
                            type="password"
                            className="input"
                            placeholder="sk-..."
                            value={settings.openaiApiKey}
                            onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                        />
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                            For future per-user AI features. Currently server uses Gemini.
                        </p>
                    </div>
                </div>

                {/* Jira Integration */}
                <div className="card">
                    <h3 style={{ marginBottom: '20px' }}>Jira Integration</h3>
                    
                    <div style={{ 
                        padding: '12px', 
                        background: 'rgba(59, 130, 246, 0.1)', 
                        borderRadius: '8px',
                        marginBottom: '16px',
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)'
                    }}>
                        ⚙️ JIRA integration is configured via server environment variables: 
                        <code style={{ display: 'block', marginTop: '4px' }}>JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY</code>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                        }}>
                            <input
                                type="checkbox"
                                checked={settings.autoCreateJira}
                                onChange={(e) => setSettings({ ...settings, autoCreateJira: e.target.checked })}
                                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                            />
                            <span style={{ fontSize: '0.875rem' }}>Auto-create Jira tickets for CRITICAL violations (UI preference)</span>
                        </label>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            Jira Project Key
                        </label>
                        <input
                            type="text"
                            className="input"
                            placeholder="e.g., COMP"
                            value={settings.jiraProject}
                            onChange={(e) => setSettings({ ...settings, jiraProject: e.target.value })}
                            disabled={!settings.autoCreateJira}
                            style={{ opacity: settings.autoCreateJira ? 1 : 0.5 }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            Jira API URL
                        </label>
                        <input
                            type="text"
                            className="input"
                            placeholder="https://yourcompany.atlassian.net"
                            value={settings.jiraApiUrl}
                            onChange={(e) => setSettings({ ...settings, jiraApiUrl: e.target.value })}
                            disabled={!settings.autoCreateJira}
                            style={{ opacity: settings.autoCreateJira ? 1 : 0.5 }}
                        />
                    </div>
                </div>

                {/* Notifications */}
                <div className="card">
                    <h3 style={{ marginBottom: '20px' }}>Notifications</h3>
                    
                    <div style={{ 
                        padding: '12px', 
                        background: 'rgba(59, 130, 246, 0.1)', 
                        borderRadius: '8px',
                        marginBottom: '16px',
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)'
                    }}>
                        ⚙️ Slack notifications use <code>SLACK_WEBHOOK_URL</code> from server environment.
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                        }}>
                            <input
                                type="checkbox"
                                checked={settings.notifyOnSuccess}
                                onChange={(e) => setSettings({ ...settings, notifyOnSuccess: e.target.checked })}
                                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                            />
                            <span style={{ fontSize: '0.875rem' }}>Notify on successful checks (UI preference)</span>
                        </label>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                        }}>
                            <input
                                type="checkbox"
                                checked={settings.notifyOnFailure}
                                onChange={(e) => setSettings({ ...settings, notifyOnFailure: e.target.checked })}
                                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                            />
                            <span style={{ fontSize: '0.875rem' }}>Notify on failed checks</span>
                        </label>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            Slack Webhook URL
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                className="input"
                                placeholder="https://hooks.slack.com/services/..."
                                value={settings.slackWebhook}
                                onChange={(e) => setSettings({ ...settings, slackWebhook: e.target.value })}
                                style={{ flex: 1 }}
                            />
                            <button 
                                className="btn btn-secondary"
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
                <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                    <h3 style={{ marginBottom: '20px', color: 'var(--accent-error)' }}>Danger Zone</h3>

                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                        These actions are irreversible. Proceed with caution.
                    </p>

                    <button 
                        className="btn" 
                        onClick={handleDeleteAllRules}
                        disabled={deleting}
                        style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: 'var(--accent-error)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            opacity: deleting ? 0.5 : 1,
                        }}
                    >
                        {deleting ? 'Deleting...' : 'Delete All Rules'}
                    </button>
                </div>
            </div>

            {/* Save Button */}
            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px' }}>
                {saved && (
                    <span style={{ color: 'var(--accent-success)', fontSize: '0.875rem' }}>
                        ✓ Settings saved!
                    </span>
                )}
                <button 
                    className="btn btn-primary" 
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? 'Saving...' : 'Save Settings'}
                </button>
            </div>
        </div>
    );
}
