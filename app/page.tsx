import Link from 'next/link';

export default function Home(){return (
<main>
<nav className="lnav">
  <Link href="/" className="brand"><span className="brand-mark">K</span><span className="brand-gold">Kers Secure</span></Link>
  <div className="lnav-links">
    <Link href="/docs">Docs</Link>
    <Link href="/dashboard">Dashboard</Link>
    <a href="#features">Features</a>
    <a href="#faq">F.A.Q</a>
    <a href="#pricing">Pricing</a>
  </div>
  <div className="lnav-auth">
    <Link href="/login" className="lnav-signin">Sign in with Discord</Link>
    <Link href="/login" className="btn gold">Sign in</Link>
  </div>
</nav>

<section className="lhero">
  <h1>Protect &amp; Monetize your code<br/>with <span className="gold">Kers Secure</span></h1>
  <p>The standard and go-to solution for protecting, monetizing,<br/>and managing your scripts easily.</p>
  <div className="hero-actions">
    <Link href="/login" className="btn gold">Sign in with Discord</Link>
    <a href="#features" className="btn outline">See features</a>
  </div>
  <div className="hero-panel">
    <div className="panel-bar"><span className="dot"/><span className="dot"/><span className="dot"/><span className="panel-title">KERS SECURE / WORKSPACE OVERVIEW</span></div>
    <div className="panel-preview">
      <div className="preview-side">
        <div className="preview-line" style={{width:'82%'}}/>
        <div className="preview-line gold-line" style={{width:'64%'}}/>
        <div className="preview-line" style={{width:'74%'}}/>
        <div className="preview-line" style={{width:'52%'}}/>
        <div className="preview-line" style={{width:'68%'}}/>
      </div>
      <div className="preview-main">
        <div className="eyebrow gold-eyebrow">WORKSPACE OVERVIEW</div>
        <h3>Your scripts, locked down.</h3>
        <div className="preview-stats">
          <div className="preview-stat"><span className="muted">Projects</span><b>—</b></div>
          <div className="preview-stat"><span className="muted">Hosted scripts</span><b>—</b></div>
          <div className="preview-stat"><span className="muted">Licenses</span><b>—</b></div>
        </div>
        <div className="panel-note">Keys, devices and executions are checked server-side on every load.</div>
      </div>
    </div>
  </div>
</section>

<section id="features" className="lsec">
  <h2>A <span className="gold">stability-first</span> approach to whitelist security.</h2>
  <p className="lsub">Built with <span className="gold">security</span> and <span className="gold">stability</span> in mind.</p>
  <Link href="/docs" className="lsec-link">See how it exactly works →</Link>
  <div className="mini-grid">
    <div><div className="mini-icon">⚡</div><h3>Super Fast</h3><p>Kers Secure runs on Cloudflare&apos;s edge network, so whitelist checks come back in milliseconds and your users never wait on a load.</p></div>
    <div><div className="mini-icon">🔧</div><h3>Easy to Integrate</h3><p>Upload your script to the dashboard and you are done. The whitelist and licensing layer is applied automatically on every delivery.</p></div>
    <div><div className="mini-icon">🔒</div><h3>Top Security</h3><p>Keys are HMAC-hashed, devices are fingerprinted and every execution decision is logged server-side. Your source never ships unchecked.</p></div>
    <div><div className="mini-icon">📈</div><h3>Reliable</h3><p>Edge deployment means 99.9%+ uptime for your script loads. Your users will never see whitelist related downtime.</p></div>
  </div>
</section>

<section className="lsec">
  <h2>Powerful <span className="gold">Features</span> You&apos;ll Love</h2>
  <p className="lsub">Everything you need to manage your scripts and users automatically.</p>
  <div className="feat-grid">
    <article><div className="feat-icon">🤖</div><h3>Discord Authentication</h3><p>Secure Discord OAuth2 sign-in with owner, administrator and user roles.</p></article>
    <article><div className="feat-icon">🔑</div><h3>Key Stocking</h3><p>Generate day-locked or lifetime license keys per project and hand them out on your own storefront or community.</p></article>
    <article><div className="feat-icon">📜</div><h3>Device Binding</h3><p>Every key is bound to a hardware fingerprint with configurable device limits, so shared keys stop working on their own.</p></article>
    <article><div className="feat-icon">🛑</div><h3>One Click Kill Switch</h3><p>Suspend or revoke a license anytime and it takes effect immediately for future executions.</p></article>
    <article><div className="feat-icon">🗂️</div><h3>Private Script Hosting</h3><p>Store Lua and Luau releases in private object storage with version history, never exposed to the public web.</p></article>
    <article><div className="feat-icon">🗝️</div><h3>Key Check API</h3><p>The loader checks key details before the script ever runs, so invalid, expired or suspended keys fail before payload delivery.</p></article>
    <article><div className="feat-icon">📊</div><h3>Execution Logs</h3><p>Every authorization decision is recorded with outcome and reason, making support and abuse tracking straightforward.</p></article>
    <article><div className="feat-icon">🛡️</div><h3>Automatic Integration</h3><p>The Luarmor-style bootstrap loader is served straight from your script URL. One loadstring line and your users are in.</p></article>
  </div>
</section>

<section className="lsec">
  <h2>Here are our stats</h2>
  <p className="lsub">Actively used by script developers.</p>
  <div className="stats-band">
    <div><h3>99.9%</h3><p>Uptime on script loads</p></div>
    <div><h3>&lt;100ms</h3><p>Median whitelist check</p></div>
    <div><h3>24/7</h3><p>Edge coverage worldwide</p></div>
  </div>
</section>

<section id="pricing" className="lsec">
  <h2>Simple and Flat Pricing</h2>
  <p className="lsub">Choose the plan that&apos;s right for you.</p>
  <div className="price-grid">
    <div className="price-card">
      <h3>Basic</h3><p className="price-sub">If you just started developing scripts, this plan is ideal for you.</p>
      <div className="price-line"><span className="price-num">$5</span><span className="price-per">/month</span></div>
      <ul><li>✓ 1 project folder</li><li>✓ Up to 2 scripts at once</li><li>✓ Up to 100 keys at once</li><li>✓ Device binding</li><li>✓ Execution logs</li><li className="off">× Webhook logs</li></ul>
      <Link href="/login" className="btn outline wide">Get started</Link>
    </div>
    <div className="price-card popular">
      <div className="pop-badge">Most Popular</div>
      <h3>Premium</h3><p className="price-sub">Best plan for most users. If your script hub is growing fast, this plan is recommended.</p>
      <div className="price-line"><span className="price-num">$10</span><span className="price-per">/month</span></div>
      <ul><li>✓ 3 project folders</li><li>✓ Up to 8 scripts at once</li><li>✓ Up to 500 keys at once</li><li>✓ Device binding</li><li>✓ Execution logs</li><li>✓ Priority support</li></ul>
      <Link href="/login" className="btn gold wide">Get started</Link>
    </div>
    <div className="price-card">
      <h3>Pro</h3><p className="price-sub">Everything in Premium with higher usage limits for established hubs.</p>
      <div className="price-line"><span className="price-num">$20</span><span className="price-per">/month</span></div>
      <ul><li>✓ 6 project folders</li><li>✓ Up to 18 scripts at once</li><li>✓ Up to 2,000 keys at once</li><li>✓ Device binding</li><li>✓ Execution logs</li><li>✓ Priority support</li></ul>
      <Link href="/login" className="btn outline wide">Get started</Link>
    </div>
    <div className="price-card">
      <h3>Enterprise</h3><p className="price-sub">For large hubs with specialized needs. Custom limits and features on request.</p>
      <div className="price-line"><span className="price-num">Custom</span></div>
      <ul><li>💎 Custom limits</li><li>💎 Custom loader options</li><li>💎 Dedicated support</li><li>✓ Everything in Pro</li></ul>
      <Link href="/docs" className="btn outline wide">Contact us</Link>
    </div>
  </div>
</section>

<section id="faq" className="lsec">
  <h2>Frequently asked <span className="gold">questions</span></h2>
  <div className="faq-list">
    <div className="faq-item"><b>How do I sign in?</b><p>Sign in securely with your Discord account using OAuth2. The configured owner Discord ID receives owner permissions; other accounts receive standard workspace access.</p></div>
    <div className="faq-item"><b>How do users run my script?</b><p>They run a single loadstring line pointing at your script&apos;s loader URL, optionally with their key attached. The loader checks the whitelist, binds the device and then runs the script.</p></div>
    <div className="faq-item"><b>What happens when a key runs out of devices?</b><p>The loader denies the execution and reports the reason. You can see every denial and its cause in your project logs.</p></div>
    <div className="faq-item"><b>Can I turn a key off instantly?</b><p>Yes. Suspending or revoking a license takes effect on the very next execution.</p></div>
  </div>
</section>

<footer className="lfooter">
  <div className="lfooter-grid">
    <div>
      <div className="brand" style={{marginBottom:14}}><span className="brand-mark">K</span><span className="brand-gold">Kers Secure</span></div>
      <p className="muted" style={{fontSize:12,maxWidth:280,lineHeight:1.8}}>Protect, monetize and manage your Lua and Luau scripts with per-key licensing and device binding.</p>
    </div>
    <div><h4>Product</h4><Link href="/docs">Documentation</Link><Link href="/dashboard">Dashboard</Link><a href="#pricing">Pricing</a></div>
    <div><h4>Resources</h4><a href="#features">Features</a><a href="#faq">F.A.Q</a><Link href="/docs">API Documentation</Link></div>
  </div>
  <div className="lfooter-bottom">© {new Date().getFullYear()} Kers Secure · Not affiliated with Luarmor or Roblox.</div>
</footer>
</main>
)
}
