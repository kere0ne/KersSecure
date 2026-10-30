import Link from 'next/link';

const sections = [
  { id: 'overview', title: 'Overview', body: 'KersSecure is a private Lua/Luau script control plane. It is designed to bring script hosting, license issuance, access decisions and audit history into one workspace.' },
  { id: 'setup', title: 'Getting started', body: 'Deploy the application with its required environment variables configured. Start with the repository README and .env.example. Do not commit real credentials or secrets.' },
  { id: 'configuration', title: 'Environment configuration', body: 'The application expects a PostgreSQL DATABASE_URL, a strong SESSION_SECRET, APP_URL, Discord OAuth credentials and callback URL, and an OWNER_DISCORD_ID. Private script storage uses S3-compatible credentials (Cloudflare R2 is supported by configuration). Optional rate limiting uses Upstash Redis.' },
  { id: 'discord', title: 'Discord sign-in', body: 'Create a Discord application, configure the OAuth redirect URI to match DISCORD_REDIRECT_URI, then set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET in your deployment environment. Set OWNER_DISCORD_ID to the Discord account that should receive owner privileges.' },
  { id: 'storage', title: 'Private storage', body: 'Configure S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY for your private object-storage bucket. Keep the bucket private; do not expose storage credentials in browser code.' },
  { id: 'database', title: 'Database', body: 'KersSecure uses Prisma with PostgreSQL. After configuring DATABASE_URL, generate the Prisma client and apply the schema using the project scripts. Back up your database before schema changes.' },
  { id: 'security', title: 'Security notes', body: 'Use unique random values for SESSION_SECRET and LICENSE_HASH_SECRET. Keep all secrets in Cloudflare environment variables, never in source control. Restrict access to your database and object-storage bucket, and review authorization logs regularly.' },
  { id: 'status', title: 'Implementation status', body: 'This documentation describes the project configuration and intended capabilities. Verify each feature in your deployed environment before relying on it in production. A successful homepage response does not by itself confirm OAuth, database, storage or license endpoints are configured.' }
];

export default function DocsPage() {
  return (
    <main>
      <nav className="top">
        <Link href="/" className="brand">KERS<span>SECURE</span></Link>
        <Link href="/" className="btn">← Back home</Link>
      </nav>
      <section className="hero" style={{ marginTop: 40 }}>
        <div className="eyebrow">KERSSECURE · DOCUMENTATION</div>
        <h1 style={{ fontSize: 'clamp(38px,6vw,60px)' }}>Developer docs<span style={{ color: 'var(--accent)' }}>.</span></h1>
        <p>Setup, deployment and security configuration for your script control plane.</p>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', marginTop: 38 }}>
          {sections.map((section, index) => (
            <a key={section.id} href={'#' + section.id} className="card">
              <div className="eyebrow">0{index + 1}</div>
              <h3>{section.title}</h3>
              <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>Jump to section →</p>
            </a>
          ))}
        </div>
        <div style={{ display: 'grid', gap: 16, marginTop: 28 }}>
          {sections.map((section, index) => (
            <article id={section.id} key={section.id} className="card" style={{ scrollMarginTop: 24 }}>
              <div className="eyebrow">SECTION 0{index + 1}</div>
              <h2 style={{ margin: '12px 0' }}>{section.title}</h2>
              <p className="muted" style={{ lineHeight: 1.8, margin: 0 }}>{section.body}</p>
            </article>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 28 }}>KersSecure documentation · Keep deployment secrets private.</p>
      </section>
    </main>
  );
}
