import React, { useEffect, useState } from 'react';
import Sidebar from '../global/sidebar';
import { fetchCoordinatorRequestsList } from '../../../services/api';
import { useNavigate } from 'react-router-dom';

const RequestsPage: React.FC = () => {
  const [items, setItems] = useState<{ batch_year: number; count: number }[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchCoordinatorRequestsList();
        const rows: any[] = Array.isArray(res?.items) ? res.items : [];
        // Deduplicate by batch_year and take the maximum count to avoid inflated totals
        const byYear = new Map<number, number>();
        for (const row of rows) {
          const year = Number(row?.batch_year);
          if (!Number.isFinite(year)) continue;
          const countVal = Number(row?.count) || 0;
          byYear.set(year, Math.max(byYear.get(year) || 0, countVal));
        }
        const deduped = Array.from(byYear.entries())
          .map(([batch_year, count]) => ({ batch_year, count }))
          .sort((a, b) => b.batch_year - a.batch_year);
        setItems(deduped);
      } catch (e) {
        setItems([]);
      }
    };
    load();
  }, []);

  const openDetails = (year: number) => {
    navigate(`/admin/requests/${year}`);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '24px 32px', backgroundColor: '#f5f6fa', marginLeft: 240 }}>
        <h2 style={{ margin: 0, color: '#0b2a55' }}>Coordinator Requests</h2>
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {items.length === 0 ? (
            <div style={{ background: 'white', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>No requests yet.</div>
          ) : (
            items.map((it) => (
              <div
                key={it.batch_year}
                onClick={() => openDetails(it.batch_year)}
                style={{ background: '#5A6DFE', color: 'white', borderRadius: 20, padding: 20, cursor: 'pointer' }}
              >
                <div style={{ background: 'white', height: 120, borderRadius: 0, marginBottom: 12 }} />
                <p style={{ fontSize: 12, margin: 0 }}>CLASS OF {it.batch_year}</p>
                <p style={{ fontSize: 12, margin: 0 }}>OJT: {it.count}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestsPage;


