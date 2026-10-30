import Link from 'next/link';

export const metadata = { title: 'Kers Secure — Pricing' };
const plans = [
  { name: 'Free', price: '$0', per: 'forever', items: ['1 project', '3 hosted scripts', '50 whitelist entries', 'Light obfuscation', 'Community loader'], cta: 'Start free', href: '/login', accent: false },
  { name: 'Developer', price: '$5', per: 'per month', items: ['5 projects', 'Unlimited scripts', '1,000 whitelist entries', 'Balanced obfuscation', 'Discord bot integration'], cta: 'Sign in to upgrade', href: '/login', accent: true },
  { name: 'Studio', price: '$20', per: 'per month', items: ['Unlimited projects', 'Unlimited whitelist', 'Maximum obfuscation + VM', 'Admin API access', 'Priority support'], cta: 'Sign in to upgrade', href: '/login', accent: false },
];
export default function PricingPage() {
  return (
    <div className="shell" style={{ display: 'block' }}>
      <main style={{ maxWidth: 980, margin: '0 auto', padding: '48px 24px 80px' }}>
        <Link href="/" className="brand" style={{ display: 'inline-block' }}>KERS<span>SECURE</span></Link>
        <h1 style={{ fontSize: 34, margin: '28px 0 8px' }}>Pricing</h1>
        <p className="muted">Every plan runs on the same engine and the same loaders. Upgrade only when your whitelist outgrows the free tier.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, marginTop: 28 }}>
          {plans.map(p => (
            <div key={p.name} className="card" style={{ borderColor: p.accent ? '#e8c869' : undefined }}>
              <div className="muted" style={{ fontSize: 12 }}>{p.name}</div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{p.price}<span className="muted" style={{ fontSize: 13, fontWeight: 400 }}> {p.per}</span></div>
              <ul style={{ margin: '14px 0', paddingLeft: 18, lineHeight: 1.9, fontSize: 13 }}>{p.items.map(i => <li key={i}>{i}</li>)}</ul>
              <Link href={p.href} className={'btn' + (p.accent ? ' primary' : '')} style={{ display: 'inline-block', textAlign: 'center', width: '100%' }}>{p.cta}</Link>
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 24 }}>Plan changes are applied by the platform owner. Prices are the published list and can change.</p>
      </main>
    </div>
  );
}
