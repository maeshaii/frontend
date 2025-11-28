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
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';

interface EmploymentUpdateReminderModalProps {
  open: boolean;
  onClose: () => void;
  onUpdateNow: () => void;
  onMaybeLater: () => void;
}

const EmploymentUpdateReminderModal: React.FC<EmploymentUpdateReminderModalProps> = ({
  open,
  onClose,
  onUpdateNow,
  onMaybeLater
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)'
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
          px: 4
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
          {/* Clipboard Icon */}
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: '#D4A574',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 1
            }}
          >
            <WorkIcon sx={{ fontSize: 36, color: '#fff' }} />
          </Box>

          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              color: '#1a1a1a',
              textAlign: 'center',
              fontSize: { xs: '1.5rem', sm: '1.75rem' }
            }}
          >
            Complete Your Graduate Tracer Survey
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

      <DialogContent sx={{ px: 4, pb: 4 }}>
        <Typography
          variant="body1"
          sx={{
            color: '#555',
            textAlign: 'center',
            mb: 3,
            lineHeight: 1.6
          }}
        >
          Help us track your career success and improve our programs for future students. Your input shapes the future of education.
        </Typography>

        <List sx={{ mb: 3 }}>
          <ListItem sx={{ px: 0, py: 1 }}>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <WorkIcon sx={{ color: '#D4A574', fontSize: 28 }} />
            </ListItemIcon>
            <ListItemText
              primary="Share your career journey and current employment status"
              primaryTypographyProps={{
                sx: { color: '#333', fontSize: '0.95rem' }
              }}
            />
          </ListItem>

          <ListItem sx={{ px: 0, py: 1 }}>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <EmojiEventsIcon sx={{ color: '#F8BBD0', fontSize: 28 }} />
            </ListItemIcon>
            <ListItemText
              primary="Highlight your achievements and professional milestones"
              primaryTypographyProps={{
                sx: { color: '#333', fontSize: '0.95rem' }
              }}
            />
          </ListItem>

          <ListItem sx={{ px: 0, py: 1 }}>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <AccessTimeIcon sx={{ color: '#F8BBD0', fontSize: 28 }} />
            </ListItemIcon>
            <ListItemText
              primary="Quick 5-minute survey - your time makes a difference"
              primaryTypographyProps={{
                sx: { color: '#333', fontSize: '0.95rem' }
              }}
            />
          </ListItem>

          <ListItem sx={{ px: 0, py: 1 }}>
            <Paper
              sx={{
                width: '100%',
                p: 2,
                backgroundColor: '#FFF3E0',
                border: '2px dashed #FF9800',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 2
              }}
            >
              <CardGiftcardIcon sx={{ color: '#FF9800', fontSize: 32 }} />
              <Typography
                variant="body2"
                sx={{
                  color: '#E65100',
                  fontWeight: 600,
                  fontSize: '0.9rem'
                }}
              >
                Maybe you're one of the lucky ones who will receive an award for completing the survey!
              </Typography>
            </Paper>
          </ListItem>
        </List>

        <Box
          sx={{
            display: 'flex',
            gap: 2,
            justifyContent: 'center',
            mt: 3
          }}
        >
          <Button
            variant="outlined"
            onClick={onMaybeLater}
            sx={{
              borderColor: '#e0e0e0',
              color: '#666',
              px: 4,
              py: 1.5,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              '&:hover': {
                borderColor: '#bdbdbd',
                backgroundColor: '#f5f5f5'
              }
            }}
          >
            Maybe Later
          </Button>

          <Button
            variant="contained"
            onClick={onUpdateNow}
            sx={{
              backgroundColor: '#174f84',
              color: '#fff',
              px: 4,
              py: 1.5,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(23, 79, 132, 0.3)',
              '&:hover': {
                backgroundColor: '#0d3a5f',
                boxShadow: '0 6px 16px rgba(23, 79, 132, 0.4)'
              }
            }}
          >
            Update Now
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default EmploymentUpdateReminderModal;

