import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

const PrivateRoute = ({ children }) => {
    const { token, loading } = useContext(AuthContext);

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                background: '#000',
                color: '#fff'
            }}>
                Loading...
            </div>
        );
    }

    return token ? children : <Navigate to="/login" />;
};

export default PrivateRoute;
