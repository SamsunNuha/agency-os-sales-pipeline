import Image from 'next/image';

export default function Logo() {
  return (
    <div className="sidebar-logo" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px 20px', borderBottom: '1px solid var(--border)' }}>
      <Image src="/logo.jpeg" alt="Agency OS" width={120} height={120} style={{ objectFit: 'contain' }} />
    </div>
  );
}
