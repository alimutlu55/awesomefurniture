// Apply the saved appearance before the page paints.
try {
  const theme = localStorage.getItem('furnidraw-marketing-theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch { /* The system appearance remains available when storage is blocked. */ }
