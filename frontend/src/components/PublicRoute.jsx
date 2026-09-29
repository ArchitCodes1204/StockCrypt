import { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { SplashScreen } from './layout/SplashScreen';

/** Login/signup wrapper: signed-in users are sent to the dashboard. */
const PublicRoute = ({ children }) => {
    const { token, loading } = useContext(AuthContext);

    if (loading) return <SplashScreen />;

    if (token) return <Navigate to="/dashboard" replace />;

    return children ?? <Outlet />;
};

export default PublicRoute;
