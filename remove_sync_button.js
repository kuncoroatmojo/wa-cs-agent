const fs = require('fs');

// Read the file
let content = fs.readFileSync('src/pages/Conversations.tsx', 'utf8');

// Remove sync state variables
content = content.replace(/  const \[syncing, setSyncing\] = useState\(false\);\n/, '');
content = content.replace(/  const \[syncProgress, setSyncProgress\] = useState<string>\(''\);\n/, '');

// Remove handleSyncAllMessages function (multi-line removal)
content = content.replace(/  const handleSyncAllMessages = async \(\) => \{[\s\S]*?\n  \};\n/, '');

// Remove the sync button (keeping the refresh button)
content = content.replace(
  /              <button\s+onClick=\{handleSyncAllMessages\}[\s\S]*?<\/button>\n/,
  ''
);

// Remove sync progress display
content = content.replace(/          \/\* Sync Progress \*\/\n          \{syncProgress && \(\n            <div className="mt-2 p-2 bg-blue-50 text-blue-700 text-sm rounded-lg">\n              \{syncProgress\}\n            <\/div>\n          \)\}\n          \n/, '');

// Remove ArrowPathIcon from imports
content = content.replace(/,\s*ArrowPathIcon/, '');

// Write back
fs.writeFileSync('src/pages/Conversations.tsx', content);
console.log('✅ Successfully removed sync functionality from Conversations page!');
