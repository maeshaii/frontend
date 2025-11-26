import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { NotificationUpdate } from '../services/notificationWebSocket';
import './popupNotifications.css';

type PopupNotificationType = 'tracker' | 'reward';

interface PopupToast {
  instanceId: string;
  notification: NotificationUpdate;
  type: PopupNotificationType;
  title: string;
  icon: string;
  messageHtml: string;
  createdAt: number;
}

const TOAST_DURATION = 8000;

const determineNotificationType = (notification: NotificationUpdate): PopupNotificationType => {
  const type = (notification.type || '').toLowerCase();
  const subject = (notification.subject || '').toLowerCase();
  const content = (notification.content || '').toLowerCase();

  if (type.includes('reward') || subject.includes('reward') || content.includes('reward')) {
    return 'reward';
  }

  return 'tracker';
};

const deriveTitleAndIcon = (type: PopupNotificationType) => {
  if (type === 'reward') {
    return {
      title: 'Reward Request',
      icon: '🎁'
    };
  }

  return {
    title: 'Tracker Update',
    icon: '🗓️'
  };
};

const normalizeContent = (notification: NotificationUpdate) => {
  if (notification.content) {
    return notification.content.replace(/\n/g, '<br />');
  }

  const fallback = notification.subject || notification.type || 'You have a new update.';
  return fallback;
};

const PopupNotifications: React.FC = () => {
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<PopupToast[]>([]);
  const timeoutsRef = useRef<Map<string, number>>(new Map());
  const [isAdminUser] = useState(() => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return false;
      const user = JSON.parse(raw);
      const accountType = user?.account_type || {};
      return Boolean(
        accountType.admin ||
        accountType.peso ||
        accountType.coordinator ||
        accountType.staff ||
        accountType.super_admin
      );
    } catch {
      return false;
    }
  });

  const removeToast = useCallback((instanceId: string) => {
    setToasts(prev => prev.filter(toast => toast.instanceId !== instanceId));
    const existingTimeout = timeoutsRef.current.get(instanceId);
    if (existingTimeout) {
      window.clearTimeout(existingTimeout);
      timeoutsRef.current.delete(instanceId);
    }
  }, []);

  const handlePrimaryAction = useCallback((toast: PopupToast) => {
    removeToast(toast.instanceId);

    if (toast.type === 'tracker') {
      navigate('/tracker/settings');
      return;
    }

    if (toast.type === 'reward') {
      const requestIdMatch = toast.notification.content?.match(/<!--REQUEST_ID:(\d+)-->/);
      const requestId = requestIdMatch ? requestIdMatch[1] : null;

      if (requestId) {
        localStorage.setItem('openRewardDetail', requestId);
      } else {
        localStorage.setItem('openRewardRequests', 'true');
      }

      window.requestAnimationFrame(() => navigate('/rewards'));
    }
  }, [navigate, removeToast]);

  useEffect(() => {
    if (!isAdminUser) return;

    const handlePopupEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ notification: NotificationUpdate }>;
      const notification = customEvent.detail?.notification;
      if (!notification) return;

      const type = determineNotificationType(notification);
      const { title, icon } = deriveTitleAndIcon(type);
      const messageHtml = normalizeContent(notification);
      const instanceId = `${notification.id}-${Date.now()}`;

      if (type === 'reward') {
        window.dispatchEvent(new CustomEvent('rewardRequestNotificationReceived', {
          detail: { notification }
        }));
      }

      setToasts(prev => {
        const withoutDuplicate = prev.filter(item => item.notification.id !== notification.id);
        return [
          ...withoutDuplicate,
          {
            instanceId,
            notification,
            type,
            title,
            icon,
            messageHtml,
            createdAt: Date.now()
          }
        ];
      });

      const timeoutId = window.setTimeout(() => removeToast(instanceId), TOAST_DURATION);
      timeoutsRef.current.set(instanceId, timeoutId);
    };

    window.addEventListener('popupNotification', handlePopupEvent as EventListener);
    return () => {
      window.removeEventListener('popupNotification', handlePopupEvent as EventListener);
      timeoutsRef.current.forEach(id => window.clearTimeout(id));
      timeoutsRef.current.clear();
    };
  }, [removeToast, isAdminUser]);

  if (!isAdminUser || toasts.length === 0) {
    return null;
  }

  return createPortal(
    <div className="popup-notifications-container">
      {toasts.map(toast => (
        <div
          key={toast.instanceId}
          className={`popup-notification-card popup-notification-card--${toast.type}`}
        >
          <button
            type="button"
            className="popup-notification-close"
            onClick={() => removeToast(toast.instanceId)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
          <div className="popup-notification-header">
            <div className="popup-notification-icon">{toast.icon}</div>
            <div className="popup-notification-title">{toast.title}</div>
          </div>
          <div
            className="popup-notification-message"
            dangerouslySetInnerHTML={{ __html: toast.messageHtml }}
          />
          <div className="popup-notification-actions">
            <button
              type="button"
              className={`popup-notification-primary popup-notification-primary--${toast.type}`}
              onClick={() => handlePrimaryAction(toast)}
            >
              {toast.type === 'reward' ? 'View Request' : 'View'}
            </button>
          </div>
        </div>
      ))}
    </div>,
    document.body
  );
};

export default PopupNotifications;

