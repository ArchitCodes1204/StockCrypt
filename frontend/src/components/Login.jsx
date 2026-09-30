import { useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import { AuthField, AuthLayout } from './AuthLayout';
import { Button, IconButton } from './ui';

const NETWORK_ERROR = "Can't reach StockCrypt right now. Check your connection and try again.";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate({ email, password }) {
    const errors = {};
    if (!email.trim()) errors.email = 'Enter your email address';
    else if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter a valid email address';
    if (!password) errors.password = 'Enter your password';
    return errors;
}

const Login = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    const [fieldErrors, setFieldErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const { email, password } = formData;

    useEffect(() => {
        document.title = 'Sign in · StockCrypt';
    }, []);

    const onChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        if (fieldErrors[name]) setFieldErrors({ ...fieldErrors, [name]: undefined });
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        if (submitting) return;
        setError('');
        const errors = validate(formData);
        setFieldErrors(errors);
        const firstInvalid = Object.keys(errors)[0];
        if (firstInvalid) {
            e.currentTarget.elements.namedItem(firstInvalid)?.focus();
            return;
        }
        setSubmitting(true);
        try {
            await login(email, password);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.message || (err.response ? 'Login failed' : NETWORK_ERROR));
            setAttempt((n) => n + 1);
            setSubmitting(false);
        }
    };

    return (
        <AuthLayout
            title="Welcome back"
            subtitle="Sign in to pick up your portfolio, watchlist and research."
            footer={(
                <p className="auth-switch-text">
                    New to StockCrypt?{' '}
                    <Link to="/signup" className="auth-switch" data-testid="auth-switch">Create an account</Link>
                </p>
            )}
        >
            <form className="auth-form" onSubmit={onSubmit} noValidate data-testid="auth-form">
                {error && (
                    <div key={attempt} className="auth-alert" role="alert" data-testid="auth-error">
                        <AlertCircle size={16} aria-hidden="true" />
                        <span>{error}</span>
                    </div>
                )}
                <AuthField
                    id="login-email"
                    label="Email"
                    icon={Mail}
                    type="email"
                    name="email"
                    value={email}
                    onChange={onChange}
                    error={fieldErrors.email}
                    required
                    autoComplete="email"
                    inputMode="email"
                    autoFocus
                    placeholder="you@example.com"
                    data-testid="auth-email"
                />
                <AuthField
                    id="login-password"
                    label="Password"
                    icon={Lock}
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={password}
                    onChange={onChange}
                    error={fieldErrors.password}
                    required
                    autoComplete="current-password"
                    placeholder="Your password"
                    data-testid="auth-password"
                    trailing={(
                        <IconButton
                            size="sm"
                            icon={showPassword ? EyeOff : Eye}
                            label={showPassword ? 'Hide password' : 'Show password'}
                            aria-pressed={showPassword}
                            aria-controls="login-password"
                            onClick={() => setShowPassword((v) => !v)}
                            className="auth-reveal"
                            data-testid="auth-reveal"
                        />
                    )}
                />
                <Button
                    type="submit"
                    size="lg"
                    fullWidth
                    loading={submitting}
                    icon={submitting ? ArrowRight : undefined}
                    iconRight={submitting ? undefined : ArrowRight}
                    className="auth-submit"
                    data-testid="auth-submit"
                >
                    {submitting ? 'Signing in…' : 'Sign in'}
                </Button>
            </form>
        </AuthLayout>
    );
};

export default Login;
