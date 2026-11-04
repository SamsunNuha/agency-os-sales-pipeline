import Image from 'next/image';

export default function Logo() {
  return (
    <div className="sidebar-logo" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px 20px', borderBottom: '1px solid var(--border)' }}>
      <Image src="/agency-logo.jpg" alt="Agency OS" width={48} height={48} style={{ objectFit: 'contain', borderRadius: 10 }} />
    </div>
  );
}
