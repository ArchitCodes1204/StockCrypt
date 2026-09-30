import { useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Check, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import { AuthField, AuthLayout } from './AuthLayout';
import { Button, IconButton } from './ui';

const NETWORK_ERROR = "Can't reach StockCrypt right now. Check your connection and try again.";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;
const MISMATCH = 'Passwords do not match';
const MISMATCH_INLINE = "Doesn't match the password above";

function validate({ username, email, password, confirmPassword }) {
    const errors = {};
    if (!username.trim()) errors.username = 'Choose a username';
    if (!email.trim()) errors.email = 'Enter your email address';
    else if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter a valid email address';
    if (!password) errors.password = 'Create a password';
    else if (password.length < MIN_PASSWORD) errors.password = `Use at least ${MIN_PASSWORD} characters`;
    if (!confirmPassword) errors.confirmPassword = 'Repeat your password';
    else if (password !== confirmPassword) errors.confirmPassword = MISMATCH_INLINE;
    return errors;
}

function Hint({ ok, children }) {
    return (
        <span className="auth-hint">
            {ok ? <Check size={13} aria-hidden="true" /> : <span className="auth-hint-dot" aria-hidden="true" />}
            {children}
        </span>
    );
}

const Signup = () => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    const [fieldErrors, setFieldErrors] = useState({});
    const [confirmTouched, setConfirmTouched] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { signup } = useContext(AuthContext);
    const navigate = useNavigate();

    const { username, email, password, confirmPassword } = formData;

    useEffect(() => {
        document.title = 'Create account · StockCrypt';
    }, []);

    const onChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        if (fieldErrors[name]) setFieldErrors({ ...fieldErrors, [name]: undefined });
        // Editing the password re-checks a confirmation that was flagged.
        if (name === 'password' && fieldErrors.confirmPassword === MISMATCH_INLINE) {
            setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
        }
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        if (submitting) return;
        setError('');
        const errors = validate(formData);
        setFieldErrors(errors);
        setConfirmTouched(true);
        const firstInvalid = Object.keys(errors)[0];
        if (firstInvalid) {
            // Same message as before the redesign when the passwords are the only problem.
            if (errors.confirmPassword === MISMATCH_INLINE && Object.keys(errors).length === 1) {
                setError(MISMATCH);
                setAttempt((n) => n + 1);
            }
            e.currentTarget.elements.namedItem(firstInvalid)?.focus();
            return;
        }
        setSubmitting(true);
        try {
            await signup(username, email, password);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.message || (err.response ? 'Signup failed' : NETWORK_ERROR));
            setAttempt((n) => n + 1);
            setSubmitting(false);
        }
    };

    const lengthOk = password.length >= MIN_PASSWORD;
    const matches = confirmPassword.length > 0 && confirmPassword === password;
    // Live mismatch message once the confirmation is at least as long as the password (or was left).
    const liveMismatch = confirmPassword.length > 0 && !matches
        && (confirmTouched || confirmPassword.length >= password.length);
    const confirmError = fieldErrors.confirmPassword || (liveMismatch ? MISMATCH_INLINE : undefined);

    const reveal = (
        <IconButton
            size="sm"
            icon={showPassword ? EyeOff : Eye}
            label={showPassword ? 'Hide passwords' : 'Show passwords'}
            aria-pressed={showPassword}
            aria-controls="signup-password signup-confirm"
            onClick={() => setShowPassword((v) => !v)}
            className="auth-reveal"
            data-testid="auth-reveal"
        />
    );

    return (
        <AuthLayout
            title="Create your account"
            subtitle="Free to use. Track stocks and crypto with real market data."
            footer={(
                <p className="auth-switch-text">
                    Already have an account?{' '}
                    <Link to="/login" className="auth-switch" data-testid="auth-switch">Sign in</Link>
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
                    id="signup-username"
                    label="Username"
                    icon={User}
                    type="text"
                    name="username"
                    value={username}
                    onChange={onChange}
                    error={fieldErrors.username}
                    required
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus
                    placeholder="e.g. alex"
                    data-testid="auth-username"
                />
                <AuthField
                    id="signup-email"
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
                    placeholder="you@example.com"
                    data-testid="auth-email"
                />
                <AuthField
                    id="signup-password"
                    label="Password"
                    icon={Lock}
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={password}
                    onChange={onChange}
                    error={fieldErrors.password}
                    hint={<Hint ok={lengthOk}>At least {MIN_PASSWORD} characters</Hint>}
                    status={lengthOk ? 'ok' : undefined}
                    required
                    minLength={MIN_PASSWORD}
                    autoComplete="new-password"
                    placeholder="Create a password"
                    data-testid="auth-password"
                    trailing={reveal}
                />
                <AuthField
                    id="signup-confirm"
                    label="Confirm password"
                    icon={Lock}
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={confirmPassword}
                    onChange={onChange}
                    onBlur={() => setConfirmTouched(true)}
                    error={confirmError}
                    hint={matches ? <Hint ok>Passwords match</Hint> : undefined}
                    status={matches ? 'ok' : undefined}
                    required
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    data-testid="auth-confirm"
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
                    {submitting ? 'Creating your account…' : 'Create account'}
                </Button>
                <p className="auth-fineprint">
                    Signals in StockCrypt come from rule-based technical analysis and are not financial advice.
                </p>
            </form>
        </AuthLayout>
    );
};

export default Signup;
