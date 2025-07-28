import { CircularProgress, Box, Typography, Container } from '@mui/material';

export default function Loading() {
  return (
    <Container maxWidth="lg">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '70vh',
          textAlign: 'center'
        }}
      >
        <CircularProgress size={60} thickness={4} sx={{ mb: 3 }} />
        <Typography variant="h5" color="text.secondary" gutterBottom>
          Loading JFK Documents
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Please wait while we retrieve the documents...
        </Typography>
      </Box>
    </Container>
  );
} 