import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <div className="login-wrap">
      <div className="login-art" aria-hidden />
      <div className="login-card glass">
        <span className="brand-mark" aria-hidden style={{ display: 'block', width: 44, height: 44, borderRadius: 14 }} />
        <h1 style={{ fontSize: 28, letterSpacing: '-0.03em', margin: '6px 0 4px' }}>Welcome back</h1>
        <p className="muted" style={{ margin: '0 0 20px' }}>Enter your password to see your money.</p>
        <LoginForm />
      </div>
    </div>
  );
}
