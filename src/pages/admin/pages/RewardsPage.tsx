import React from 'react';
import Sidebar from '../global/sidebar';

type Person = {
  id: string;
  name: string;
  subtitle?: string;
};

const EligibleItem: React.FC<{ person: Person }> = ({ person }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          aria-hidden
          style={{
            width: 32,
            height: 32,
            borderRadius: '9999px',
            background: '#e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#374151',
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          {person.name
            .split(' ')
            .map((x) => x[0])
            .slice(0, 2)
            .join('')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 500, color: '#111827' }}>{person.name}</span>
          {person.subtitle ? (
            <span style={{ fontSize: 12, color: '#6b7280' }}>{person.subtitle}</span>
          ) : null}
        </div>
      </div>
      <span aria-hidden style={{ color: '#9ca3af', fontWeight: 600 }}>{'>'}</span>
    </div>
  );
};

const Card: React.FC<{ title: string; badge?: string; children: React.ReactNode }> = ({ title, badge, children }) => {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: 12,
        padding: 16,
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h3 style={{ margin: 0, color: '#111827', fontSize: 18 }}>{title}</h3>
        {badge ? (
          <span
            style={{
              background: '#eef2ff',
              color: '#4f46e5',
              padding: '2px 8px',
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {badge}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
};

const RewardsPage: React.FC = () => {
  const eligiblePeople: Person[] = [
    { id: '1', name: 'Alice Johnson' },
    { id: '2', name: 'Bob Smith' },
    { id: '3', name: 'Charlie Davis' },
    { id: '4', name: 'Eva Brown' },
  ];

  const recentRecipients: Person[] = [
    { id: '5', name: 'Frank White', subtitle: 'Just now' },
    { id: '6', name: 'Charlie White', subtitle: '5 mins ago' },
    { id: '7', name: 'Charlie Yesterday', subtitle: '5 days ago' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '24px 32px', backgroundColor: '#f5f6fa', marginLeft: 240 }}>
        <h2 style={{ margin: 0, color: '#0b2a55' }}>Rewards</h2>
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card title="Eligible for Rewards" badge={`0/15`}>
            <div>
              {eligiblePeople.map((p) => (
                <EligibleItem key={p.id} person={p} />
              ))}
            </div>
          </Card>

          <Card title="Recent Reward Recipients">
            <div>
              {recentRecipients.map((p) => (
                <EligibleItem key={p.id} person={p} />
              ))}
              <div style={{ marginTop: 8 }}>
                <a href="#" style={{ color: '#2563eb', fontSize: 14, textDecoration: 'underline' }}>
                  View Full History
                </a>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RewardsPage;


