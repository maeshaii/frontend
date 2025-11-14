import React, { useEffect, useState } from 'react';
import { HiOutlineXMark, HiOutlineEnvelope, HiOutlineUser, HiOutlineChatBubbleLeft, HiOutlineDocumentText, HiOutlineArrowPath, HiOutlineHeart, HiOutlineCamera, HiOutlineUserPlus } from 'react-icons/hi2';
import { getPointsTasks } from '../services/api';
import './EarnPointsModal.css';

interface PointsTask {
  task_id: number;
  task_type: string;
  title: string;
  description: string;
  points: number;
  max_points?: number;
  points_display: string;
  icon_name: string;
  is_completed: boolean;
  order: number;
  progress?: {
    current: number;
    required: number;
  } | null;
}

interface EarnPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EarnPointsModal: React.FC<EarnPointsModalProps> = ({ isOpen, onClose }) => {
  const [tasks, setTasks] = useState<PointsTask[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTasks();
    }
  }, [isOpen]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const response = await getPointsTasks();
      if (response.success) {
        setTasks(response.tasks || []);
      }
    } catch (error) {
      console.error('Error fetching points tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (iconName: string) => {
    switch (iconName.toLowerCase()) {
      case 'envelope':
      case 'email':
        return <HiOutlineEnvelope size={24} />;
      case 'user':
      case 'person':
        return <HiOutlineUser size={24} />;
      case 'chat':
      case 'review':
        return <HiOutlineChatBubbleLeft size={24} />;
      case 'document':
      case 'post':
        return <HiOutlineDocumentText size={24} />;
      case 'arrow-path':
      case 'share':
        return <HiOutlineArrowPath size={24} />;
      case 'heart':
      case 'like':
        return <HiOutlineHeart size={24} />;
      case 'camera':
      case 'image':
        return <HiOutlineCamera size={24} />;
      case 'user-plus':
      case 'follow':
        return <HiOutlineUserPlus size={24} />;
      default:
        return <HiOutlineEnvelope size={24} />;
    }
  };

  const removeNumbersFromTitle = (title: string): string => {
    // Remove numbers and extra spaces from title
    // Examples: "Make 10 posts" -> "Make posts", "Comment on 5 posts" -> "Comment on posts"
    return title.replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
  };


  if (!isOpen) return null;

  return (
    <>
      <style>{`
        .earn-points-badge,
        .earn-points-badge *,
        .earn-points-badge span,
        .earn-points-badge span *,
        div.earn-points-badge,
        div.earn-points-badge *,
        div.earn-points-badge span,
        div.earn-points-badge span * {
          color: white !important;
          -webkit-text-fill-color: white !important;
        }
        .earn-points-modal-header,
        .earn-points-modal-header *,
        .earn-points-modal-header h2,
        .earn-points-modal-header h2 * {
          color: white !important;
          -webkit-text-fill-color: white !important;
        }
      `}</style>
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '400px',
          maxHeight: '90vh',
          overflow: 'hidden',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="earn-points-modal-header"
          style={{
            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'white'
          }}
        >
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'white' }}>
            Complete tasks to earn points!
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <HiOutlineXMark size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="earn-points-modal-content" style={{ padding: '20px', maxHeight: 'calc(90vh - 80px)', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
              Loading tasks...
            </div>
          ) : tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
              No tasks available at the moment.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {tasks.map((task) => (
                <div
                  key={task.task_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    backgroundColor: task.is_completed ? '#f9fafb' : 'white'
                  }}
                >
                  {/* Icon */}
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: task.is_completed ? '#d1d5db' : '#fef3c7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: task.is_completed ? '#6b7280' : '#f59e0b',
                      flexShrink: 0
                    }}
                  >
                    {getIcon(task.icon_name)}
                  </div>

                  {/* Task Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        marginBottom: '4px'
                      }}
                    >
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#111827',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {removeNumbersFromTitle(task.title)}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: task.is_completed ? '#047857' : '#c2410c',
                          backgroundColor: task.is_completed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(249, 115, 22, 0.16)',
                          padding: '4px 8px',
                          borderRadius: '999px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}
                      >
                        <span role="img" aria-label="points">
                          {task.is_completed ? '✅' : '🪙'}
                        </span>
                        <span>{task.points_display || `${task.points} pts`}</span>
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#6b7280',
                        marginBottom: task.progress ? '4px' : '0'
                      }}
                    >
                      {task.description}
                    </div>
                    {task.progress && (
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#9ca3af',
                          marginTop: '2px'
                        }}
                      >
                        Progress: {task.progress.current}/{task.progress.required}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
};

export default EarnPointsModal;

