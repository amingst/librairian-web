import Link from 'next/link';
import { Typography, Button, Box, Container } from '@mui/material';

export default function NotFound() {
  return (
    <Container maxWidth="md">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '70vh',
          textAlign: 'center',
          py: 8
        }}
      >
        <Typography variant="h2" component="h1" gutterBottom color="error">
          404 - Not Found
        </Typography>
        
        <Typography variant="h5" component="h2" gutterBottom color="textSecondary">
          The JFK document you're looking for doesn't exist.
        </Typography>
        
        <Typography variant="body1" color="textSecondary" paragraph sx={{ maxWidth: 600, mb: 4 }}>
          The page or document you requested could not be found. It might have been removed, 
          renamed, or it may never have existed in our database.
        </Typography>
        
        <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
          <Button 
            variant="contained" 
            color="primary" 
            component={Link} 
            href="/jfk-files"
          >
            Back to JFK Files
          </Button>
          <Button 
            variant="outlined" 
            component={Link} 
            href="/"
          >
            Go Home
          </Button>
        </Box>
      </Box>
    </Container>
  );
} 