'use client';

import { useState, useEffect } from 'react';

// Icons - Larger sizes
const Icons = {
    plus: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14"/><path d="M5 12h14"/>
        </svg>
    ),
    close: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
        </svg>
    ),
    github: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
    ),
    delete: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
    ),
    rules: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
    ),
    external: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
    ),
    folder: (
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
    )
};

export default function ProjectsPage() {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [deleting, setDeleting] = useState(null);

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const res = await fetch('/api/projects');
            const data = await res.json();
            if (data.success) {
                setProjects(data.projects || []);
            }
        } catch (err) {
            console.error('Error fetching projects:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProject = async (projectId) => {
        if (!confirm('Are you sure you want to delete this project? All associated rules and analysis history will be lost.')) return;
        
        setDeleting(projectId);
        try {
            const res = await fetch(`/api/projects?id=${projectId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                setProjects(projects.filter(p => p.id !== projectId));
            } else {
                alert('Failed to delete project: ' + data.error);
            }
        } catch (err) {
            alert('Error deleting project');
        } finally {
            setDeleting(null);
        }
    };

    const handleProjectAdded = (newProject) => {
        setProjects([newProject, ...projects]);
        setShowAddModal(false);
    };

    return (
        <div style={{ maxWidth: '1400px' }}>
            {/* Header */}
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
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
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
                        }}>Connected Projects</h1>
                        <p style={{ 
                            fontSize: '1.125rem', 
                            color: 'var(--text-secondary)',
                            maxWidth: '500px',
                        }}>
                            Manage your GitHub repositories linked to compliance monitoring.
                        </p>
                    </div>
                </div>
                <button 
                    className="btn btn-primary" 
                    onClick={() => setShowAddModal(true)} 
                    style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '10px',
                        padding: '16px 28px',
                        fontSize: '1.0625rem',
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
                        boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)',
                    }}
                >
                    {Icons.plus} Add Project
                </button>
            </div>

            {/* Loading State */}
            {loading && (
                <div style={{ 
                    textAlign: 'center', 
                    padding: '80px 20px',
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
                    <p style={{ fontSize: '1.125rem', color: 'var(--text-muted)' }}>Loading projects...</p>
                </div>
            )}

            {/* Empty State */}
            {!loading && projects.length === 0 && (
                <div className="card" style={{ 
                    textAlign: 'center', 
                    padding: '80px 40px',
                    background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-tertiary) 100%)',
                    border: '1px dashed var(--border-color)',
                    animation: 'fadeInUp 0.5s ease-out',
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    {/* Animated background gradient */}
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: '400px',
                        height: '400px',
                        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 70%)',
                        transform: 'translate(-50%, -50%)',
                        animation: 'pulse 4s ease-in-out infinite',
                    }} />
                    
                    <div style={{ 
                        width: '100px', 
                        height: '100px', 
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(139, 92, 246, 0.1))',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 32px',
                        animation: 'float 3s ease-in-out infinite',
                        color: '#8b5cf6',
                        position: 'relative',
                    }}>
                        {Icons.folder}
                    </div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: '600', marginBottom: '16px' }}>No projects yet</h2>
                    <p style={{ 
                        fontSize: '1.125rem',
                        color: 'var(--text-muted)', 
                        marginBottom: '32px', 
                        maxWidth: '450px', 
                        margin: '0 auto 32px',
                        lineHeight: '1.7',
                    }}>
                        Add a GitHub repository to start monitoring code compliance on pull requests.
                    </p>
                    <button 
                        className="btn btn-primary" 
                        onClick={() => setShowAddModal(true)} 
                        style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '12px',
                            padding: '18px 36px',
                            fontSize: '1.125rem',
                            background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
                        }}
                    >
                        {Icons.github} Add Your First Project
                    </button>
                </div>
            )}

            {/* Projects Grid */}
            {!loading && projects.length > 0 && (
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', 
                    gap: '24px' 
                }}>
                    {projects.map((project, idx) => (
                        <ProjectCard 
                            key={project.id} 
                            project={project} 
                            onDelete={() => handleDeleteProject(project.id)}
                            deleting={deleting === project.id}
                            delay={idx * 0.1}
                        />
                    ))}
                </div>
            )}

            {/* Add Project Modal */}
            {showAddModal && (
                <AddProjectModal 
                    onClose={() => setShowAddModal(false)} 
                    onProjectAdded={handleProjectAdded}
                />
            )}

            <style jsx>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
            `}</style>
        </div>
    );
}

function ProjectCard({ project, onDelete, deleting, delay = 0 }) {
    const timeAgo = (date) => {
        if (!date) return 'Never';
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
        return `${Math.floor(seconds / 86400)} days ago`;
    };

    return (
        <div className="card" style={{ 
            position: 'relative',
            padding: '28px',
            animation: `fadeInUp 0.5s ease-out ${delay}s both`,
            transition: 'all 0.3s ease',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ 
                        width: '56px', 
                        height: '56px', 
                        borderRadius: '14px', 
                        background: 'linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-hover) 100%)',
                        border: '1px solid var(--border-color)',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        color: 'var(--text-secondary)' 
                    }}>
                        {Icons.github}
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '4px' }}>{project.repoName}</h3>
                        <p style={{ fontSize: '0.9375rem', color: 'var(--text-muted)' }}>{project.repoOwner}</p>
                    </div>
                </div>
                <a 
                    href={project.repoUrl || `https://github.com/${project.repoOwner}/${project.repoName}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ 
                        color: 'var(--text-muted)', 
                        padding: '8px',
                        borderRadius: '8px',
                        transition: 'all 0.2s ease',
                    }}
                    title="Open in GitHub"
                    onMouseEnter={(e) => e.target.style.color = 'var(--accent-primary)'}
                    onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
                >
                    {Icons.external}
                </a>
            </div>

            {/* Stats */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '20px', 
                paddingTop: '20px', 
                borderTop: '1px solid var(--border-color)' 
            }}>
                <div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>Rules</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--accent-primary)' }}>{project.rulesCount || 0}</p>
                </div>
                <div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>Analyses</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--accent-success)' }}>{project.analysisCount || 0}</p>
                </div>
            </div>

            {/* Footer */}
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                marginTop: '20px', 
                paddingTop: '20px', 
                borderTop: '1px solid var(--border-color)' 
            }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    Added {timeAgo(project.createdAt)}
                </span>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <a 
                        href={`/rules?projectId=${project.id}`} 
                        className="btn btn-secondary" 
                        style={{ 
                            padding: '10px 18px', 
                            fontSize: '0.9375rem', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px' 
                        }}
                    >
                        {Icons.rules} Rules
                    </a>
                    <button 
                        onClick={onDelete} 
                        disabled={deleting}
                        style={{ 
                            padding: '10px 14px', 
                            background: 'rgba(239, 68, 68, 0.1)', 
                            color: '#ef4444', 
                            border: '1px solid rgba(239, 68, 68, 0.3)', 
                            borderRadius: '10px', 
                            cursor: deleting ? 'wait' : 'pointer', 
                            opacity: deleting ? 0.5 : 1,
                            transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => { if (!deleting) { e.target.style.background = 'rgba(239, 68, 68, 0.2)'; }}}
                        onMouseLeave={(e) => { e.target.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                    >
                        {Icons.delete}
                    </button>
                </div>
            </div>
            
            <style jsx>{`
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}

function AddProjectModal({ onClose, onProjectAdded }) {
    const [formData, setFormData] = useState({ repoOwner: '', repoName: '', repoUrl: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.repoOwner.trim() || !formData.repoName.trim()) {
            setError('Repository owner and name are required');
            return;
        }

        setSaving(true);
        try {
            const repoUrl = formData.repoUrl || `https://github.com/${formData.repoOwner}/${formData.repoName}`;
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    repoOwner: formData.repoOwner.trim(),
                    repoName: formData.repoName.trim(),
                    repoUrl: repoUrl,
                    githubRepoId: Date.now() // Temporary ID for manual creation
                })
            });

            const data = await res.json();
            if (data.success) {
                onProjectAdded(data.project);
            } else {
                setError(data.error || 'Failed to create project');
            }
        } catch (err) {
            setError('Error creating project');
        } finally {
            setSaving(false);
        }
    };

    const handleRepoUrlChange = (url) => {
        setFormData({ ...formData, repoUrl: url });
        // Auto-extract owner/name from GitHub URL
        const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (match) {
            setFormData({ repoUrl: url, repoOwner: match[1], repoName: match[2].replace('.git', '') });
        }
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--card)', borderRadius: '16px', padding: '24px', width: '500px', maxWidth: '90vw' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ margin: 0 }}>Add Project</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>{Icons.close}</button>
                </div>

                <form onSubmit={handleSubmit}>
                    {error && (
                        <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', marginBottom: '20px', color: '#ef4444', fontSize: '14px' }}>
                            {error}
                        </div>
                    )}

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>GitHub Repository URL (optional)</label>
                        <input
                            type="text"
                            value={formData.repoUrl}
                            onChange={(e) => handleRepoUrlChange(e.target.value)}
                            placeholder="https://github.com/owner/repo"
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '14px' }}
                        />
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>Paste a URL to auto-fill owner and repo name</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Repository Owner *</label>
                            <input
                                type="text"
                                value={formData.repoOwner}
                                onChange={(e) => setFormData({ ...formData, repoOwner: e.target.value })}
                                placeholder="e.g. acme-corp"
                                required
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '14px' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Repository Name *</label>
                            <input
                                type="text"
                                value={formData.repoName}
                                onChange={(e) => setFormData({ ...formData, repoName: e.target.value })}
                                placeholder="e.g. backend-api"
                                required
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '14px' }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {saving ? 'Adding...' : <>{Icons.plus} Add Project</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
