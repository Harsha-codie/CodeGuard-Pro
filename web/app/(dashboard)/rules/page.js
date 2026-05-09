'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

// Icons - Larger sizes
const Icons = {
    edit: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
    ),
    delete: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
    ),
    close: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
        </svg>
    ),
    check: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
        </svg>
    ),
    plus: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14"/><path d="M5 12h14"/>
        </svg>
    ),
    template: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="9" y1="21" x2="9" y2="9"/>
        </svg>
    )
};

export default function RulesPage() {
    const searchParams = useSearchParams();
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [editingRule, setEditingRule] = useState(null);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [pendingTemplates, setPendingTemplates] = useState([]);
    const [savingTemplates, setSavingTemplates] = useState(false);

    // Check for templates from localStorage on mount
    useEffect(() => {
        const fromTemplates = searchParams.get('fromTemplates');
        if (fromTemplates === 'true') {
            const storedTemplates = localStorage.getItem('selectedTemplates');
            if (storedTemplates) {
                try {
                    const templateIds = JSON.parse(storedTemplates);
                    if (templateIds.length > 0) {
                        fetchTemplatesById(templateIds);
                    }
                } catch (e) {
                    console.error('Error parsing templates:', e);
                }
                // Clear after reading
                localStorage.removeItem('selectedTemplates');
            }
        }
    }, [searchParams]);

    // Fetch templates by IDs and show modal
    const fetchTemplatesById = async (templateIds) => {
        try {
            const res = await fetch('/api/rules/templates?format=abstract');
            const data = await res.json();
            if (data.success) {
                const selectedRules = data.rules.filter(r => templateIds.includes(r.id));
                if (selectedRules.length > 0) {
                    setPendingTemplates(selectedRules);
                    setShowTemplateModal(true);
                }
            }
        } catch (err) {
            console.error('Error fetching templates:', err);
        }
    };

    // Fetch projects
    useEffect(() => {
        fetchProjects();
    }, []);

    // Fetch rules when project changes
    useEffect(() => {
        if (selectedProject) {
            fetchRules();
        }
    }, [selectedProject]);

    const fetchProjects = async () => {
        try {
            const res = await fetch('/api/projects');
            const data = await res.json();
            if (data.success && data.projects?.length > 0) {
                setProjects(data.projects);
                setSelectedProject(data.projects[0].id);
            } else {
                setProjects([]);
                setLoading(false);
            }
        } catch (err) {
            console.error('Error fetching projects:', err);
            setLoading(false);
        }
    };

    const fetchRules = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/rules?projectId=${selectedProject}`);
            const data = await res.json();
            if (data.success) {
                setRules(data.rules);
            }
        } catch (err) {
            console.error('Error fetching rules:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveTemplates = async () => {
        if (!selectedProject || pendingTemplates.length === 0) return;
        
        setSavingTemplates(true);
        try {
            const rulesToCreate = pendingTemplates.map(t => ({
                description: t.description,
                displayName: t.displayName,
                name: t.name,
                language: 'javascript',
                severity: t.severity,
                treeSitterQuery: '',
                aiExplanation: `From template: ${t.name} (${t.patternType})`
            }));

            const res = await fetch('/api/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: selectedProject,
                    rules: rulesToCreate
                })
            });

            const data = await res.json();
            if (data.success) {
                setShowTemplateModal(false);
                setPendingTemplates([]);
                fetchRules();
            } else {
                alert('Failed to save rules: ' + data.error);
            }
        } catch (err) {
            alert('Error saving rules');
        } finally {
            setSavingTemplates(false);
        }
    };

    const handleUpdateRule = async (updatedRule) => {
        try {
            const res = await fetch('/api/rules', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedRule)
            });

            const data = await res.json();
            if (data.success) {
                setRules(rules.map(r => r.id === updatedRule.id ? data.rule : r));
                setEditingRule(null);
            } else {
                alert('Failed to update rule: ' + data.error);
            }
        } catch (err) {
            alert('Error updating rule');
        }
    };

    const handleDeleteRule = async (ruleId) => {
        if (!confirm('Are you sure you want to delete this rule?')) return;
        
        try {
            const res = await fetch(`/api/rules?id=${ruleId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                setRules(rules.filter(r => r.id !== ruleId));
            }
        } catch (err) {
            alert('Error deleting rule');
        }
    };

    const handleToggleActive = async (rule) => {
        await handleUpdateRule({ id: rule.id, isActive: !rule.isActive });
    };

    if (!loading && projects.length === 0) {
        return (
            <div style={{ 
                textAlign: 'center', 
                padding: '80px 20px',
                animation: 'fadeInUp 0.5s ease-out',
            }}>
                <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: 'var(--bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px',
                    fontSize: '2.5rem',
                }}>📁</div>
                <h2 style={{ fontSize: '1.75rem', fontWeight: '600', marginBottom: '16px' }}>No Projects Found</h2>
                <p style={{ fontSize: '1.125rem', color: 'var(--text-muted)', marginBottom: '32px', maxWidth: '400px', margin: '0 auto 32px' }}>
                    Connect a GitHub repository first to start adding compliance rules.
                </p>
                <a href="/projects" className="btn btn-primary" style={{ 
                    padding: '16px 32px', 
                    fontSize: '1.0625rem',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
                }}>Go to Projects</a>
                
                <style jsx>{`
                    @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                `}</style>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1400px' }}>
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start', 
                marginBottom: '40px',
                animation: 'fadeInUp 0.5s ease-out',
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
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
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            <path d="m9 12 2 2 4-4"/>
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
                        }}>Compliance Rules</h1>
                        <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)', maxWidth: '500px' }}>
                            Define rules in plain English. AI will convert them to enforcement logic.
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                    <a href="/rules/templates" className="btn btn-secondary" style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '10px',
                        padding: '14px 24px',
                        fontSize: '1rem',
                        fontWeight: '600',
                    }}>
                        {Icons.template} Browse Templates
                    </a>
                    <a href="/rules/new" className="btn btn-primary" style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '10px',
                        padding: '14px 28px',
                        fontSize: '1rem',
                        fontWeight: '600',
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
                        boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)',
                    }}>
                        {Icons.plus} Add New Rule
                    </a>
                </div>
            </div>

            {projects.length > 1 && (
                <div style={{ marginBottom: '28px' }}>
                    <label style={{ display: 'block', marginBottom: '10px', fontSize: '1rem', fontWeight: '600' }}>Select Project</label>
                    <select
                        value={selectedProject || ''}
                        onChange={(e) => setSelectedProject(e.target.value)}
                        style={{ 
                            padding: '14px 20px', 
                            borderRadius: '10px', 
                            border: '1px solid var(--border-color)', 
                            background: 'var(--bg-card)', 
                            color: 'var(--text-primary)', 
                            fontSize: '1rem', 
                            minWidth: '300px',
                            cursor: 'pointer',
                        }}
                    >
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.repoOwner}/{p.repoName}</option>
                        ))}
                    </select>
                </div>
            )}

            {loading && (
                <div style={{ textAlign: 'center', padding: '60px' }}>
                    <div style={{ width: '48px', height: '48px', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }} />
                    <p style={{ fontSize: '1.0625rem', color: 'var(--text-muted)' }}>Loading rules...</p>
                </div>
            )}

            {!loading && rules.length === 0 ? (
                <div className="card" style={{ 
                    textAlign: 'center', 
                    padding: '64px 40px',
                    background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-tertiary) 100%)',
                    border: '1px dashed var(--border-color)',
                }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: 'var(--bg-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 24px',
                        fontSize: '2.5rem',
                    }}>⚖️</div>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '12px' }}>No rules yet</h3>
                    <p style={{ fontSize: '1.0625rem', color: 'var(--text-muted)', marginBottom: '32px', maxWidth: '400px', margin: '0 auto 32px' }}>
                        Start by adding rules from templates or creating custom ones.
                    </p>
                    <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                        <a href="/rules/templates" className="btn btn-primary" style={{ 
                            padding: '14px 28px', 
                            fontSize: '1rem',
                            background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
                        }}>Browse Templates</a>
                        <a href="/rules/new" className="btn btn-secondary" style={{ padding: '14px 28px', fontSize: '1rem' }}>Create Custom Rule</a>
                    </div>
                </div>
            ) : !loading && (
                <div className="card" style={{ padding: '24px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                                <th style={{ padding: '16px 0', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rule Description</th>
                                <th style={{ padding: '16px 0', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Language</th>
                                <th style={{ padding: '16px 0', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Severity</th>
                                <th style={{ padding: '16px 0', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                                <th style={{ padding: '16px 0', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rules.map((rule) => (
                                <RuleRow 
                                    key={rule.id} 
                                    rule={rule} 
                                    onEdit={() => setEditingRule(rule)}
                                    onDelete={() => handleDeleteRule(rule.id)}
                                    onToggleActive={() => handleToggleActive(rule)}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {editingRule && <EditRuleModal rule={editingRule} onClose={() => setEditingRule(null)} onSave={handleUpdateRule} />}
            {showTemplateModal && <TemplateImportModal templates={pendingTemplates} projects={projects} selectedProject={selectedProject} onProjectChange={setSelectedProject} onClose={() => { setShowTemplateModal(false); setPendingTemplates([]); }} onSave={handleSaveTemplates} saving={savingTemplates} />}

            <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

function RuleRow({ rule, onEdit, onDelete, onToggleActive }) {
    const severityColors = { WARNING: '#f59e0b', CRITICAL: '#ef4444' };

    return (
        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
            <td style={{ padding: '16px 0', fontSize: '0.875rem', maxWidth: '400px' }}>{rule.description}</td>
            <td style={{ padding: '16px 0' }}>
                <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{rule.language}</span>
            </td>
            <td style={{ padding: '16px 0' }}>
                <span style={{ padding: '4px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '500', background: `${severityColors[rule.severity]}20`, color: severityColors[rule.severity] }}>{rule.severity}</span>
            </td>
            <td style={{ padding: '16px 0' }}>
                <button onClick={onToggleActive} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: rule.isActive ? '#10b981' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: rule.isActive ? '#10b981' : 'var(--text-muted)' }} />
                    {rule.isActive ? 'Active' : 'Disabled'}
                </button>
            </td>
            <td style={{ padding: '16px 0' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={onEdit} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>{Icons.edit} Edit</button>
                    <button onClick={onDelete} style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', cursor: 'pointer' }}>{Icons.delete}</button>
                </div>
            </td>
        </tr>
    );
}

function EditRuleModal({ rule, onClose, onSave }) {
    const [formData, setFormData] = useState({ 
        id: rule.id, 
        description: rule.description, 
        language: rule.language, 
        severity: rule.severity, 
        treeSitterQuery: rule.treeSitterQuery || '', 
        isActive: rule.isActive 
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => { 
        e.preventDefault(); 
        setSaving(true); 
        await onSave(formData); 
        setSaving(false); 
    };

    // Input styling for consistency
    const inputStyle = {
        width: '100%',
        padding: '12px 14px',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        background: 'rgba(0, 0, 0, 0.4)',
        color: '#ffffff',
        fontSize: '0.9375rem',
        outline: 'none',
        transition: 'border-color 0.2s ease',
    };

    const selectStyle = {
        ...inputStyle,
        cursor: 'pointer',
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
        backgroundPosition: 'right 12px center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '20px',
        paddingRight: '40px',
    };

    const labelStyle = {
        display: 'block',
        marginBottom: '8px',
        fontWeight: '500',
        fontSize: '0.9375rem',
        color: 'rgba(255, 255, 255, 0.9)',
    };

    return (
        <div style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0, 0, 0, 0.8)', 
            backdropFilter: 'blur(4px)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1000 
        }}>
            <div style={{ 
                background: '#1a1a2e', 
                borderRadius: '16px', 
                padding: '28px', 
                width: '560px', 
                maxWidth: '90vw', 
                maxHeight: '90vh', 
                overflow: 'auto',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}>
                {/* Header */}
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginBottom: '28px',
                    paddingBottom: '20px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                }}>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600', color: '#ffffff' }}>Edit Rule</h2>
                    <button 
                        onClick={onClose} 
                        style={{ 
                            background: 'rgba(255, 255, 255, 0.1)', 
                            border: 'none', 
                            cursor: 'pointer', 
                            color: 'rgba(255, 255, 255, 0.6)',
                            padding: '8px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                    >
                        {Icons.close}
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Description */}
                    <div style={{ marginBottom: '24px' }}>
                        <label style={labelStyle}>Description</label>
                        <textarea 
                            value={formData.description} 
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                            rows={3} 
                            style={{ 
                                ...inputStyle,
                                resize: 'vertical',
                                minHeight: '80px',
                            }} 
                        />
                    </div>

                    {/* Language & Severity Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                        <div>
                            <label style={labelStyle}>Language</label>
                            <select 
                                value={formData.language} 
                                onChange={(e) => setFormData({ ...formData, language: e.target.value })} 
                                style={selectStyle}
                            >
                                <option value="javascript" style={{ background: '#1a1a2e', color: '#ffffff' }}>JavaScript</option>
                                <option value="typescript" style={{ background: '#1a1a2e', color: '#ffffff' }}>TypeScript</option>
                                <option value="python" style={{ background: '#1a1a2e', color: '#ffffff' }}>Python</option>
                                <option value="java" style={{ background: '#1a1a2e', color: '#ffffff' }}>Java</option>
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Severity</label>
                            <select 
                                value={formData.severity} 
                                onChange={(e) => setFormData({ ...formData, severity: e.target.value })} 
                                style={selectStyle}
                            >
                                <option value="WARNING" style={{ background: '#1a1a2e', color: '#ffffff' }}>Warning</option>
                                <option value="CRITICAL" style={{ background: '#1a1a2e', color: '#ffffff' }}>Critical</option>
                            </select>
                        </div>
                    </div>

                    {/* Tree-sitter Query */}
                    <div style={{ marginBottom: '24px' }}>
                        <label style={labelStyle}>Tree-sitter Query (Optional)</label>
                        <textarea 
                            value={formData.treeSitterQuery} 
                            onChange={(e) => setFormData({ ...formData, treeSitterQuery: e.target.value })} 
                            rows={4} 
                            placeholder="Leave empty to auto-generate with AI" 
                            style={{ 
                                ...inputStyle,
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                fontSize: '0.875rem',
                                resize: 'vertical',
                                minHeight: '100px',
                            }} 
                        />
                    </div>

                    {/* Active Checkbox */}
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px', 
                        marginBottom: '28px',
                        padding: '16px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '10px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}>
                        <input 
                            type="checkbox" 
                            id="isActive" 
                            checked={formData.isActive} 
                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} 
                            style={{ 
                                width: '20px', 
                                height: '20px', 
                                cursor: 'pointer',
                                accentColor: '#8b5cf6',
                            }}
                        />
                        <label 
                            htmlFor="isActive" 
                            style={{ 
                                cursor: 'pointer', 
                                fontSize: '0.9375rem',
                                color: 'rgba(255, 255, 255, 0.9)',
                                fontWeight: '500',
                            }}
                        >
                            Rule is active
                        </label>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ 
                        display: 'flex', 
                        gap: '12px', 
                        justifyContent: 'flex-end',
                        paddingTop: '20px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                    }}>
                        <button 
                            type="button" 
                            onClick={onClose} 
                            style={{
                                padding: '12px 24px',
                                fontSize: '0.9375rem',
                                fontWeight: '500',
                                borderRadius: '10px',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                background: 'transparent',
                                color: 'rgba(255, 255, 255, 0.8)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                            }}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={saving}
                            style={{
                                padding: '12px 24px',
                                fontSize: '0.9375rem',
                                fontWeight: '600',
                                borderRadius: '10px',
                                border: 'none',
                                background: saving ? 'rgba(139, 92, 246, 0.5)' : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                                color: '#ffffff',
                                cursor: saving ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: saving ? 'none' : '0 4px 14px rgba(139, 92, 246, 0.4)',
                            }}
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function TemplateImportModal({ templates, projects, selectedProject, onProjectChange, onClose, onSave, saving }) {
    const selectStyle = {
        width: '100%',
        padding: '12px 14px',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        background: 'rgba(0, 0, 0, 0.4)',
        color: '#ffffff',
        fontSize: '0.9375rem',
        cursor: 'pointer',
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
        backgroundPosition: 'right 12px center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '20px',
        paddingRight: '40px',
        outline: 'none',
    };

    return (
        <div style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0, 0, 0, 0.8)', 
            backdropFilter: 'blur(4px)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1000 
        }}>
            <div style={{ 
                background: '#1a1a2e', 
                borderRadius: '16px', 
                padding: '28px', 
                width: '560px', 
                maxWidth: '90vw', 
                maxHeight: '90vh', 
                overflow: 'auto',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}>
                {/* Header */}
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginBottom: '28px',
                    paddingBottom: '20px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                }}>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600', color: '#ffffff' }}>
                        Import {templates.length} Rules
                    </h2>
                    <button 
                        onClick={onClose} 
                        style={{ 
                            background: 'rgba(255, 255, 255, 0.1)', 
                            border: 'none', 
                            cursor: 'pointer', 
                            color: 'rgba(255, 255, 255, 0.6)',
                            padding: '8px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {Icons.close}
                    </button>
                </div>

                {/* Project Select */}
                <div style={{ marginBottom: '24px' }}>
                    <label style={{ 
                        display: 'block', 
                        marginBottom: '8px', 
                        fontWeight: '500',
                        fontSize: '0.9375rem',
                        color: 'rgba(255, 255, 255, 0.9)',
                    }}>
                        Select Project
                    </label>
                    <select 
                        value={selectedProject || ''} 
                        onChange={(e) => onProjectChange(e.target.value)} 
                        style={selectStyle}
                    >
                        {projects.map(p => (
                            <option 
                                key={p.id} 
                                value={p.id}
                                style={{ background: '#1a1a2e', color: '#ffffff' }}
                            >
                                {p.repoOwner}/{p.repoName}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Rules List */}
                <div style={{ marginBottom: '24px' }}>
                    <h4 style={{ 
                        marginBottom: '12px', 
                        fontSize: '0.9375rem', 
                        fontWeight: '500',
                        color: 'rgba(255, 255, 255, 0.9)',
                    }}>
                        Rules to Import:
                    </h4>
                    <div style={{ 
                        maxHeight: '280px', 
                        overflow: 'auto', 
                        border: '1px solid rgba(255, 255, 255, 0.1)', 
                        borderRadius: '10px',
                        background: 'rgba(0, 0, 0, 0.2)',
                    }}>
                        {templates.map((t, i) => (
                            <div 
                                key={t.id} 
                                style={{ 
                                    padding: '14px 16px', 
                                    borderBottom: i < templates.length - 1 ? '1px solid rgba(255, 255, 255, 0.08)' : 'none', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '12px' 
                                }}
                            >
                                <span style={{ color: '#10b981' }}>{Icons.check}</span>
                                <div>
                                    <div style={{ fontWeight: '500', color: '#ffffff', fontSize: '0.9375rem' }}>
                                        {t.displayName || t.name}
                                    </div>
                                    <div style={{ fontSize: '0.8125rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>
                                        {t.category} • {t.severity}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Action Buttons */}
                <div style={{ 
                    display: 'flex', 
                    gap: '12px', 
                    justifyContent: 'flex-end',
                    paddingTop: '20px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                }}>
                    <button 
                        onClick={onClose} 
                        style={{
                            padding: '12px 24px',
                            fontSize: '0.9375rem',
                            fontWeight: '500',
                            borderRadius: '10px',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            background: 'transparent',
                            color: 'rgba(255, 255, 255, 0.8)',
                            cursor: 'pointer',
                        }}
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={onSave} 
                        disabled={saving || !selectedProject}
                        style={{
                            padding: '12px 24px',
                            fontSize: '0.9375rem',
                            fontWeight: '600',
                            borderRadius: '10px',
                            border: 'none',
                            background: (saving || !selectedProject) 
                                ? 'rgba(139, 92, 246, 0.4)' 
                                : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                            color: '#ffffff',
                            cursor: (saving || !selectedProject) ? 'not-allowed' : 'pointer',
                            boxShadow: (saving || !selectedProject) ? 'none' : '0 4px 14px rgba(139, 92, 246, 0.4)',
                        }}
                    >
                        {saving ? 'Importing...' : `Import ${templates.length} Rules`}
                    </button>
                </div>
            </div>
        </div>
    );
}