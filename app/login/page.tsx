import LoginForm from './login-form';

export const metadata = { title: 'Owner access — Kers Secure' };

export default function LoginPage() {
  return <main className="min-h-screen flex items-center justify-center px-5 py-16" style={{background:'var(--background, #08090d)'}}>
    <section className="card" style={{width:'100%',maxWidth:440,margin:'auto',padding:32}}>
      <a href="/" className="brand" style={{display:'inline-flex',marginBottom:30}}><span className="brand-mark">K</span><span className="brand-gold">Kers Secure</span></a>
      <div className="eyebrow">PRIVATE OWNER ACCESS</div>
      <h1 className="h1" style={{fontSize:30,marginTop:10}}>Enter your owner key</h1>
      <p className="lead" style={{fontSize:13}}>Authenticate with your private Kers Secure API key. No Discord connection or account password is used.</p>
      <LoginForm />
      <p className="muted" style={{fontSize:11,marginTop:22,lineHeight:1.6}}>Your key is checked server-side and never stored in the browser. Keep it private.</p>
    </section>
  </main>;
}
