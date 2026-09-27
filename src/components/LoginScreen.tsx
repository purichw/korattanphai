import { type FormEvent, type ReactNode, useState } from 'react';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import type { AuthScope } from '../authScope';

export function LoginFrame({ children, scope }: { children: ReactNode; scope: AuthScope }) {
  return <main className="login-page" lang="th">
    <section className="login-card" aria-labelledby="login-title">
      <div className="login-brand">
        <img src="/brand/korat-tan-phai-emblem.webp" width="768" height="768" alt="" aria-hidden="true" decoding="async" />
        <div><p className="eyebrow">Korat Tan Phai</p><h1 id="login-title">{scope === 'admin' ? 'เข้าสู่ระบบผู้ดูแล' : 'เข้าสู่ระบบ'}</h1></div>
      </div>
      {children}
    </section>
  </main>;
}

export function LoginPage({ scope, onLogin, pending, error }: {
  scope: AuthScope; onLogin: (email: string, password: string) => Promise<void>; pending: boolean; error: string | null;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const submitLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pending) void onLogin(email, password);
  };
  return <LoginFrame scope={scope}>
    <p>{scope === 'admin' ? 'จัดการข้อมูล · โคราชทันภัย' : 'โคราชทันภัย'}</p>
    <form className="login-form" onSubmit={submitLogin} aria-busy={pending}>
      <label htmlFor="login-email">อีเมล</label>
      <input id="login-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false}
        required autoFocus value={email} disabled={pending} onChange={event => setEmail(event.target.value)} />
      <label htmlFor="login-password">รหัสผ่าน</label>
      <div className="login-password-field">
        <input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
          required value={password} disabled={pending} onChange={event => setPassword(event.target.value)} />
        <button type="button" className="login-password-toggle" aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
          title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} aria-controls="login-password" aria-pressed={showPassword}
          disabled={pending} onClick={() => setShowPassword(value => !value)}>
          {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
        </button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="primary-button" disabled={pending}>{pending ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</button>
    </form>
    {scope === 'admin' && <a className="login-return secondary-button" href="/"><ArrowLeft size={16} aria-hidden="true" />กลับเว็บไซต์</a>}
  </LoginFrame>;
}
