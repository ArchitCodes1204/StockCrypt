import { useContext } from 'react';
import AuthContext from '../context/AuthContext';

const Dashboard = () => {
    const { user, logout } = useContext(AuthContext);

    return (
        <div className="dashboard-container">
            <div className="dashboard-content">
                <header className="dashboard-header">
                    <h1 className="title text-blue" style={{ marginBottom: 0, textAlign: 'left' }}>StockCrypt Dashboard</h1>
                    <button onClick={logout} className="btn-logout">
                        Logout
                    </button>
                </header>
                <div className="card" style={{ maxWidth: '100%' }}>
                    <h2 className="title" style={{ fontSize: '1.5rem', textAlign: 'left' }}>Welcome, {user?.username}!</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        This is your protected dashboard. You can only see this if you are logged in.
                    </p>
                    <div className="user-details">
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem' }}>User Details:</h3>
                        <p><span style={{ color: 'var(--text-secondary)' }}>Email:</span> {user?.email}</p>
                        <p><span style={{ color: 'var(--text-secondary)' }}>User ID:</span> {user?._id || user?.id}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
