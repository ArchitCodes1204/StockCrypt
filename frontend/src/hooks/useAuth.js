import { useContext } from 'react';
import AuthContext from '../context/AuthContext';

/** { user, token, login, signup, logout, loading } (same as useContext(AuthContext)). */
export function useAuth() {
    return useContext(AuthContext);
}

export default useAuth;
