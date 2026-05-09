import Sidebar from '../../components/Sidebar';

export default function DashboardLayout({ children }) {
    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />
            <main style={{
                marginLeft: '280px',
                flex: 1,
                padding: '40px',
                background: 'var(--bg-primary)',
            }}>
                {children}
            </main>
        </div>
    );
}
