import React from 'react';
import { useParams } from 'react-router-dom';
import UnifiedDashboard from '../../shared/UnifiedDashboard';

export default () => {
  const { id } = useParams<{ id: string }>();
  return <UnifiedDashboard userType="admin" userId={id} />;
};
