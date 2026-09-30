import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useToast } from '../hooks/useToast';

const AuthContext = createContext(null);

// Use environment variable or fallback to localhost
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const TOKEN_KEY = 'token';
const SESSION_EXPIRED = 'Your session expired. Please sign in again.';

function readToken() {
    try {
        return localStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
}

function writeToken(token) {
    try {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
    } catch {
        /* storage unavailable */
    }
}

function setDefaultAuthHeader(token) {
    if (token) axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    else delete axios.defaults.headers.common.Authorization;
}

function sentAuthHeader(config) {
    const headers = config?.headers;
    if (!headers) return null;
    if (typeof headers.get === 'function') return headers.get('Authorization') || null;
    return headers.Authorization || headers.authorization || null;
}

const isAuthEndpoint = (url = '') => /\/auth\/(login|signup)(?:[/?#]|$)/.test(url);

// Requests fired before the provider mounts (or from pages that rely on the
// axios default) carry the stored token from the start.
setDefaultAuthHeader(readToken());

/**
 * Auth state: { user, token, login, signup, logout, loading }.
 * - Validates a stored token with /auth/me (a null user counts as logged out).
 * - Any 401 from a request that carried the current token (except login/signup)
 *   logs out and shows "Your session expired. Please sign in again."
 */
export const AuthProvider = ({ children }) => {
    const toast = useToast();
    const [token, setToken] = useState(readToken);
    const [user, setUser] = useState(null);
    const [checkedToken, setCheckedToken] = useState(null);

    // Loading only while a stored token is being validated.
    const loading = Boolean(token) && !user && checkedToken !== token;

    const logout = useCallback(() => {
        writeToken(null);
        setDefaultAuthHeader(null);
        setToken(null);
        setUser(null);
    }, []);

    // Session-expiry guard for every axios request in the app.
    useEffect(() => {
        const id = axios.interceptors.response.use(
            (response) => response,
            (error) => {
                const current = readToken();
                if (
                    error?.response?.status === 401
                    && current
                    && !isAuthEndpoint(error.config?.url)
                    && sentAuthHeader(error.config) === `Bearer ${current}`
                ) {
                    logout();
                    toast.info(SESSION_EXPIRED);
                }
                return Promise.reject(error);
            }
        );
        return () => axios.interceptors.response.eject(id);
    }, [logout, toast]);

    // Validate the token and load the user whenever the token changes.
    useEffect(() => {
        setDefaultAuthHeader(token);
        if (!token) return undefined;
        let cancelled = false;
        axios.get(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => {
                if (cancelled) return;
                if (res.data && typeof res.data === 'object') setUser(res.data);
                else logout(); // account no longer exists
            })
            .catch((err) => {
                if (cancelled) return;
                const status = err?.response?.status;
                if (status === 401 || status === 403 || status === 404) {
                    logout();
                } else {
                    // Network/server trouble: keep the session, pages show their own errors.
                    console.warn('Could not verify the session', err?.message || err);
                }
            })
            .finally(() => {
                if (!cancelled) setCheckedToken(token);
            });
        return () => {
            cancelled = true;
        };
    }, [token, logout]);

    const login = useCallback(async (email, password) => {
        const res = await axios.post(`${API_URL}/auth/login`, { email, password });
        writeToken(res.data.token);
        setDefaultAuthHeader(res.data.token);
        setUser(res.data.user);
        setToken(res.data.token);
        return res.data;
    }, []);

    const signup = useCallback(async (username, email, password) => {
        const res = await axios.post(`${API_URL}/auth/signup`, { username, email, password });
        writeToken(res.data.token);
        setDefaultAuthHeader(res.data.token);
        setUser(res.data.user);
        setToken(res.data.token);
        return res.data;
    }, []);

    const value = useMemo(
        () => ({ user, token, login, signup, logout, loading }),
        [user, token, login, signup, logout, loading]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
