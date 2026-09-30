import { LogoMark } from '../ui/Logo';

/** Full-screen branded loading state (auth check). Fades in after a beat so fast loads don't flash. */
export function SplashScreen({ label = 'Loading StockCrypt' }) {
    return (
        <div className="shell-splash" role="status" aria-live="polite">
            <div className="shell-splash-inner">
                <span className="shell-splash-mark">
                    <LogoMark size={52} />
                </span>
                <span className="shell-splash-bar" aria-hidden="true" />
                <span className="sr-only">{label}</span>
            </div>
        </div>
    );
}

export default SplashScreen;
