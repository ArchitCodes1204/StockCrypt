import { useContext } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { SplashScreen } from './layout/SplashScreen';

/** Renders children (or the nested routes) for signed-in users; otherwise redirects to /login. */
const PrivateRoute = ({ children }) => {
    const { token, loading } = useContext(AuthContext);
    const location = useLocation();

    if (loading) return <SplashScreen />;

    if (!token) return <Navigate to="/login" replace state={{ from: location }} />;

    return children ?? <Outlet />;
};

export default PrivateRoute;
