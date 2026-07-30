import { Box, AppBar, Toolbar, Typography } from '@mui/material'

export default function App() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar position="static" elevation={0} color="transparent" sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar variant="dense">
          <Typography variant="h6" component="h1" sx={{ fontFamily: '"Fraunces", Georgia, serif', fontWeight: 700 }}>
            Image Pipes
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
            OpenCV pipeline playground
          </Typography>
        </Toolbar>
      </AppBar>
      <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', p: 4 }}>
        <Typography color="text.secondary">Canvas, palette, and inspector will appear here.</Typography>
      </Box>
    </Box>
  )
}
