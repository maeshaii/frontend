import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Typography,
  Button,
  Box,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import WorkIcon from '@mui/icons-material/Work';
import SyncIcon from '@mui/icons-material/Sync';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

interface EmploymentUpdateReminderModalProps {
  open: boolean;
  onClose: () => void;
  onUpdateNow: () => void;
  onMaybeLater: () => void;
  onNoChanges: () => void;
}

const EmploymentUpdateReminderModal: React.FC<EmploymentUpdateReminderModalProps> = ({
  open,
  onClose,
  onUpdateNow,
  onMaybeLater,
  onNoChanges
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          maxWidth: '480px',
          width: '90%'
        }
      }}
      BackdropProps={{
        sx: {
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)'
        }
      }}
    >
      <DialogTitle
        sx={{
          position: 'relative',
          pb: 2,
          pt: 4,
          px: 3
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2
          }}
        >
          {/* Work Icon */}
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              backgroundColor: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 1
            }}
          >
            <WorkIcon sx={{ fontSize: 32, color: '#fff' }} />
          </Box>

          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              color: '#1a1a1a',
              textAlign: 'center',
              fontSize: { xs: '1.25rem', sm: '1.4rem' }
            }}
          >
            Update Your Employment Details
          </Typography>
        </Box>

        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: '#666'
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pb: 3 }}>
        <Typography
          variant="body1"
          sx={{
            color: '#555',
            textAlign: 'center',
            mb: 3,
            lineHeight: 1.6,
            fontSize: '0.95rem'
          }}
        >
          Keep your profile accurate and up to date by reviewing your current employment information. Updated details help us track your progress and improve our services.
        </Typography>

        <List sx={{ mb: 3 }}>
          <ListItem sx={{ px: 0, py: 1 }}>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <SyncIcon sx={{ color: '#3b82f6', fontSize: 28 }} />
            </ListItemIcon>
            <ListItemText
              primary="Make sure your career information reflects your current status"
              primaryTypographyProps={{
                sx: { color: '#333', fontSize: '0.875rem', fontWeight: 500 }
              }}
            />
          </ListItem>

          <ListItem sx={{ px: 0, py: 1 }}>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <TrendingUpIcon sx={{ color: '#3b82f6', fontSize: 28 }} />
            </ListItemIcon>
            <ListItemText
              primary="Accurate details help improve our alumni and OJT programs"
              primaryTypographyProps={{
                sx: { color: '#333', fontSize: '0.875rem', fontWeight: 500 }
              }}
            />
          </ListItem>

          <ListItem sx={{ px: 0, py: 1 }}>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <AccessTimeIcon sx={{ color: '#3b82f6', fontSize: 28 }} />
            </ListItemIcon>
            <ListItemText
              primary="Quick update—just takes a minute"
              primaryTypographyProps={{
                sx: { color: '#333', fontSize: '0.875rem', fontWeight: 500 }
              }}
            />
          </ListItem>
        </List>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            mt: 3
          }}
        >
          <Button
            variant="contained"
            onClick={onUpdateNow}
            sx={{
              backgroundColor: '#3b82f6',
              color: '#fff',
              py: 1.5,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.875rem',
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
              '&:hover': {
                backgroundColor: '#2563eb',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)'
              }
            }}
          >
            Update Now
          </Button>

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              variant="outlined"
              onClick={onMaybeLater}
              sx={{
                flex: 1,
                borderColor: '#d1d5db',
                color: '#64748b',
                py: 1.5,
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.875rem',
                '&:hover': {
                  borderColor: '#9ca3af',
                  backgroundColor: '#f8fafc',
                  color: '#475569'
                }
              }}
            >
              Maybe Later
            </Button>

            <Button
              variant="outlined"
              onClick={onNoChanges}
              sx={{
                flex: 1,
                borderColor: '#d1d5db',
                color: '#64748b',
                py: 1.5,
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.875rem',
                '&:hover': {
                  borderColor: '#9ca3af',
                  backgroundColor: '#f8fafc',
                  color: '#475569'
                }
              }}
            >
              No Changes
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default EmploymentUpdateReminderModal;

