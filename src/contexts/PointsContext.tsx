import React, { createContext, useContext, useCallback } from 'react';
import { getUserPoints } from '../services/api';

interface PointsContextType {
  refreshPoints: (userId: number) => Promise<void>;
  refreshPointsCallback?: () => void;
}

const PointsContext = createContext<PointsContextType>({
  refreshPoints: async () => {},
});

export const usePoints = () => useContext(PointsContext);

interface PointsProviderProps {
  children: React.ReactNode;
  onPointsUpdated?: (points: any) => void;
}

export const PointsProvider: React.FC<PointsProviderProps> = ({ children, onPointsUpdated }) => {
  const refreshPoints = useCallback(async (userId: number) => {
    try {
      const points = await getUserPoints(userId);
      if (onPointsUpdated) {
        onPointsUpdated(points);
      }
      // Dispatch custom event for components that listen to it
      window.dispatchEvent(new CustomEvent('pointsUpdated', { detail: { userId, points } }));
    } catch (error) {
      console.error('Error refreshing points:', error);
    }
  }, [onPointsUpdated]);

  return (
    <PointsContext.Provider value={{ refreshPoints }}>
      {children}
    </PointsContext.Provider>
  );
};

