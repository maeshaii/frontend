import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, Typography, Avatar, Button, TextField, Grid, Paper } from '@mui/material';
import AlumniTopBar from './AlumniTopBar';
import ctulogo from '../../images/ctulogo.png';
import './profile.css';

// Define getCurrentUserId locally since auth utility doesn't exist
function getCurrentUserId(user: any): number | null {
  if (!user) return null;
  if (typeof user.user_id === 'number') return user.user_id;
  if (typeof user.id === 'number') return user.id;
  return null;
}

const DonationPage: React.FC = () => {
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [donationAmount, setDonationAmount] = useState('');
  const [donationMessage, setDonationMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get current user info
  const userObj = JSON.parse(localStorage.getItem('user') || '{}');
  const currentUserId = getCurrentUserId(userObj);

  // Get batch year for display
  const getBatchYear = () => {
    const yearGraduated = userObj.year_graduated || userObj.batch;
    if (yearGraduated) {
      return `BATCH ${yearGraduated}`;
    }
    return 'BATCH';
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  // Handle donation submission
  const handleDonationSubmit = async () => {
    if (!donationAmount || !donationMessage.trim()) {
      alert('Please fill in both amount and message');
      return;
    }

    setIsSubmitting(true);
    try {
      // TODO: Implement donation API call
      console.log('Donation submitted:', {
        amount: donationAmount,
        message: donationMessage,
        user: currentUserId
      });
      
      alert('Thank you for your donation!');
      setDonationAmount('');
      setDonationMessage('');
    } catch (error) {
      console.error('Error submitting donation:', error);
      alert('Failed to submit donation. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Predefined donation amounts
  const predefinedAmounts = [100, 500, 1000, 2500, 5000];

  return (
    <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Alumni TopBar */}
      <AlumniTopBar 
        showProfile={showProfile}
        setShowProfile={setShowProfile}
        handleLogout={handleLogout}
      />

      {/* Main Content */}
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 2 }}>
        {/* Header Section */}
        <Box sx={{ mb: 3 }}>
          <Card
            sx={{
              display: 'flex',
              alignItems: 'center',
              p: 2,
              borderRadius: 2,
              boxShadow: 3,
              bgcolor: 'white'
            }}
          >
            <Avatar 
              src={ctulogo} 
              sx={{ 
                width: 60, 
                height: 60, 
                mr: 2
              }} 
            />
            <Box>
              <Typography variant="h5" component="div" fontWeight="bold">
                DONATION
              </Typography>
              <Typography variant="body2" sx={{ color: '#6c757d' }}>
                {getBatchYear()}
              </Typography>
            </Box>
          </Card>
        </Box>  

        {/* Three Column Layout */}
        <Box sx={{ display: 'flex', gap: 3 }}>
          {/* Left Sidebar - Donation Info */}
          <Box sx={{ flex: '0 0 300px' }}>
            <Card sx={{ p: 2, borderRadius: 2, boxShadow: 3, mb: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Donation Information
              </Typography>
              <Typography variant="body2" sx={{ color: '#6c757d', mb: 2 }}>
                Support your alma mater and help fund scholarships, facilities, and programs for current and future students.
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2" fontWeight="bold">
                  Where your donation goes:
                </Typography>
                <Typography variant="caption" sx={{ color: '#6c757d' }}>
                  • Student Scholarships
                </Typography>
                <Typography variant="caption" sx={{ color: '#6c757d' }}>
                  • Campus Improvements
                </Typography>
                <Typography variant="caption" sx={{ color: '#6c757d' }}>
                  • Research Programs
                </Typography>
                <Typography variant="caption" sx={{ color: '#6c757d' }}>
                  • Alumni Events
                </Typography>
              </Box>
            </Card>

            <Card sx={{ p: 2, borderRadius: 2, boxShadow: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Recent Donations
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="caption" sx={{ color: '#6c757d' }}>
                  No recent donations to display.
                </Typography>
              </Box>
            </Card>
          </Box>

          {/* Center Content */}
          <Box sx={{ flex: '1 1 600px' }}>
            {/* Donation Form */}
            <Card sx={{ mb: 3, borderRadius: 2, boxShadow: 3, p: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Make a Donation
              </Typography>
              
              {/* Predefined Amounts */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
                  Quick Amount Selection:
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {predefinedAmounts.map((amount) => (
                    <Button
                      key={amount}
                      variant={donationAmount === amount.toString() ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => setDonationAmount(amount.toString())}
                      sx={{
                        minWidth: '60px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}
                    >
                      ₱{amount.toLocaleString()}
                    </Button>
                  ))}
                </Box>
              </Box>

              {/* Custom Amount */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
                  Or enter custom amount:
                </Typography>
                <TextField
                  fullWidth
                  placeholder="Enter amount in PHP"
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(e.target.value)}
                  variant="outlined"
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px',
                    }
                  }}
                />
              </Box>

              {/* Donation Message */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
                  Message (Optional):
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  placeholder="Leave a message with your donation..."
                  value={donationMessage}
                  onChange={(e) => setDonationMessage(e.target.value)}
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px',
                    }
                  }}
                />
              </Box>

              {/* Submit Button */}
              <Button
                fullWidth
                variant="contained"
                onClick={handleDonationSubmit}
                disabled={isSubmitting || !donationAmount}
                sx={{
                  bgcolor: '#e25a2c',
                  '&:hover': {
                    bgcolor: '#d04a1c',
                  },
                  py: 1.5,
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}
              >
                {isSubmitting ? 'Processing...' : 'Submit Donation'}
              </Button>
            </Card>

            {/* Donation History */}
            <Card sx={{ borderRadius: 2, boxShadow: 3, p: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Your Donation History
              </Typography>
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" sx={{ color: '#6c757d' }}>
                  No donation history available.
                </Typography>
              </Box>
            </Card>
          </Box>

          {/* Right Sidebar - About */}
          <Box sx={{ flex: '0 0 300px' }}>
            <Card sx={{ p: 2, borderRadius: 2, boxShadow: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                About Donations
              </Typography>
              <Typography variant="body2" sx={{ color: '#6c757d' }}>
                Your generous donations help CTU continue its mission of providing quality education and supporting students in need. Every contribution makes a difference in shaping the future of our university community.
              </Typography>
            </Card>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default DonationPage;
