/**
 * Sync the coordinator request badge count across all admin views.
 * Stores the count in localStorage for persistence and broadcasts
 * a custom event so open tabs (same or different) can update immediately.
 */
export const broadcastCoordinatorRequestCount = (count: number) => {
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;

  try {
    localStorage.setItem('coordinatorReqCount', String(safeCount));
  } catch (error) {
    console.error('Failed to persist coordinator request count:', error);
  }

  try {
    window.dispatchEvent(
      new CustomEvent('coordinatorRequestCountUpdated', {
        detail: { count: safeCount },
      }),
    );
  } catch (error) {
    console.error('Failed to broadcast coordinator request count:', error);
  }
};


