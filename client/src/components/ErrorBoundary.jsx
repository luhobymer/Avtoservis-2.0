import React from 'react';
import { Typography, Container, Paper, Button } from '@mui/material';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Container maxWidth="md" sx={{ mt: 4 }}>
          <Paper sx={{ p: 3, bgcolor: '#fff0f0' }}>
            <Typography variant="h5" color="error" gutterBottom>
              Something went wrong
            </Typography>
            <Typography variant="body1" paragraph>
              {this.state.error && this.state.error.toString()}
            </Typography>
            <details style={{ whiteSpace: 'pre-wrap' }}>
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </details>
            <Button 
              variant="contained" 
              onClick={() => window.location.reload()}
              sx={{ mt: 2 }}
            >
              Reload Page
            </Button>
          </Paper>
        </Container>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
