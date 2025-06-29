// Clear Zustand persistence storage for Evolution API config
// Run this in your browser console at http://localhost:5173

console.log('🧹 Clearing Evolution API configuration from browser storage...');

// Clear localStorage keys used by Zustand persist
const keys = Object.keys(localStorage);
const evolutionKeys = keys.filter(key => 
  key.includes('evolution') || 
  key.includes('config') || 
  key.includes('api')
);

console.log('Found stored keys:', evolutionKeys);

evolutionKeys.forEach(key => {
  console.log(`Removing: ${key}`);
  localStorage.removeItem(key);
});

console.log('✅ Cleared Evolution API config. Refresh the page to load environment variables.');
console.log('Environment config should now be:');
console.log('URL:', import.meta?.env?.VITE_EVOLUTION_API_URL || 'Not available');
console.log('Key:', import.meta?.env?.VITE_EVOLUTION_API_KEY?.substring(0, 8) + '...' || 'Not available');

// Run this in browser console to clear CORS-related storage
console.log('🧹 Clearing browser storage for development...');

// Clear localStorage
localStorage.clear();

// Clear sessionStorage
sessionStorage.clear();

// Clear IndexedDB (if any)
if ('indexedDB' in window) {
  indexedDB.databases().then(databases => {
    databases.forEach(db => {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    });
  });
}

console.log('✅ Browser storage cleared. Please refresh the page.');
console.log('🔄 If CORS issues persist, try hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)');
