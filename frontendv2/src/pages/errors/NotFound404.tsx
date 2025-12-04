/**
 * 404 Not Found Error Page
 * Displayed when a route/resource cannot be found
 */

import { useState } from 'react';
import { Box, TextField, IconButton } from '@mui/material';
import { ErrorOutline as ErrorOutlineIcon, Search as SearchIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import ErrorLayout from '@components/common/ErrorLayout';

export default function NotFound404() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const suggestions = [
    'Check the URL for typos or errors',
    "Use the search box below to find what you're looking for",
    'Go back to the home page and start fresh',
    "Make sure you're using the correct link",
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Navigate to home with search query as state
      // You can customize this to navigate to a search page if you have one
      navigate('/', { state: { search: searchQuery } });
    }
  };

  return (
    <ErrorLayout
      icon={<ErrorOutlineIcon fontSize="inherit" />}
      errorCode="404"
      title="Page Not Found"
      message="Oops! The page you're looking for seems to have wandered off. It might have been moved, deleted, or never existed in the first place."
      suggestions={suggestions}
    >
      {/* Search Box */}
      <Box
        component="form"
        onSubmit={handleSearch}
        sx={{
          display: 'flex',
          gap: 1,
          alignItems: 'center',
          mt: 2,
        }}
      >
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search for games, puzzles, or rooms..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="medium"
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
            },
          }}
        />
        <IconButton
          type="submit"
          color="primary"
          size="large"
          sx={{
            bgcolor: 'primary.main',
            color: 'white',
            '&:hover': {
              bgcolor: 'primary.dark',
            },
            width: 56,
            height: 56,
          }}
        >
          <SearchIcon />
        </IconButton>
      </Box>
    </ErrorLayout>
  );
}
