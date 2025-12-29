/**
 * Compose Page - Create new puzzles
 * Implements REQ-3.3: Puzzle Composition
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  Divider,
  styled,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import Nav from '@components/common/Nav';
import { FileUploader } from '@components/Upload';
import { useCompositionStore } from '@stores/compositionStore';

const PageContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
}));

const ContentContainer = styled(Container)(({ theme }) => ({
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(4),
}));

const SectionCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  height: '100%',
}));

const Compose = () => {
  const navigate = useNavigate();
  const { setDimensions, setTitle, setAuthor, title, author, width, height } =
    useCompositionStore();
  const [error, setError] = useState<string | null>(null);

  const handleCreateNew = () => {
    if (!title || !author) {
      setError('Please enter title and author');
      return;
    }

    setError(null);
    setDimensions(width, height);
    navigate('/composition/new');
  };

  const handleUploadSuccess = (result: any) => {
    navigate(`/game/${result.pid}`);
  };

  const handleUploadError = (error: Error) => {
    console.error('Upload error:', error);
  };

  return (
    <PageContainer>
      <Nav />
      <ContentContainer maxWidth="lg">
        <Box mb={4}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Create Puzzle
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Start from scratch or upload an existing puzzle file
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Create from Scratch */}
          <Grid item xs={12} md={6}>
            <SectionCard elevation={2}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Create From Scratch
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Build a new crossword puzzle from the ground up
              </Typography>

              <Divider sx={{ my: 3 }} />

              <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Puzzle Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter puzzle title..."
                  fullWidth
                  required
                  error={!!error && !title}
                  helperText={error && !title ? 'Title is required' : ''}
                />

                <TextField
                  label="Author"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Your name..."
                  fullWidth
                  required
                  error={!!error && !author}
                  helperText={error && !author ? 'Author is required' : ''}
                />

                <Box display="flex" gap={2}>
                  <TextField
                    label="Width"
                    type="number"
                    value={width}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value);
                      const validValue = isNaN(parsed) ? 15 : Math.max(5, Math.min(25, parsed));
                      setDimensions(validValue, height);
                    }}
                    inputProps={{ min: 5, max: 25 }}
                    fullWidth
                  />
                  <TextField
                    label="Height"
                    type="number"
                    value={height}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value);
                      const validValue = isNaN(parsed) ? 15 : Math.max(5, Math.min(25, parsed));
                      setDimensions(width, validValue);
                    }}
                    inputProps={{ min: 5, max: 25 }}
                    fullWidth
                  />
                </Box>

                <Button
                  variant="contained"
                  size="large"
                  startIcon={<AddIcon />}
                  onClick={handleCreateNew}
                  fullWidth
                  sx={{ mt: 2 }}
                >
                  Create Puzzle
                </Button>
              </Box>
            </SectionCard>
          </Grid>

          {/* Upload Puzzle File */}
          <Grid item xs={12} md={6}>
            <SectionCard elevation={2}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Upload Puzzle File
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Import an existing .puz or .ipuz file
              </Typography>

              <Divider sx={{ my: 3 }} />

              <FileUploader
                onUploadSuccess={handleUploadSuccess}
                onUploadError={handleUploadError}
                isPublic={true}
              />

              <Box mt={3}>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  <strong>Supported formats:</strong>
                </Typography>
                <Typography variant="caption" color="text.secondary" component="ul" sx={{ pl: 2 }}>
                  <li>.puz files (Across Lite format)</li>
                  <li>.ipuz files (JSON format)</li>
                </Typography>
              </Box>
            </SectionCard>
          </Grid>
        </Grid>
      </ContentContainer>
    </PageContainer>
  );
};

export default Compose;
