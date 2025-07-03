import React from 'react';

interface DevelopmentModeProps {
  children: React.ReactNode;
}

const DevelopmentMode: React.FC<DevelopmentModeProps> = ({ children }) => {
  const isDevelopment = import.meta.env.DEV;
  const hasSupabaseUrl = !!import.meta.env.VITE_SUPABASE_URL;
  const hasSupabaseKey = !!import.meta.env.VITE_SUPABASE_ANON_KEY;
  const hasEvolutionApiUrl = !!import.meta.env.VITE_EVOLUTION_API_URL;
  const hasEvolutionApiKey = !!import.meta.env.VITE_EVOLUTION_API_KEY;

  // Show development banner if in dev mode and missing env vars
  const showDevBanner = isDevelopment && (!hasSupabaseUrl || !hasSupabaseKey || !hasEvolutionApiUrl || !hasEvolutionApiKey);

  return (
    <>
      {showDevBanner && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>Development Mode:</strong> Some environment variables are missing. 
                The app is running with placeholder values for development purposes.
              </p>
              <div className="mt-2 text-xs text-yellow-600">
                <p>Missing variables:</p>
                <ul className="list-disc list-inside ml-2">
                                  {!hasSupabaseUrl && <li>VITE_SUPABASE_URL</li>}
                {!hasSupabaseKey && <li>VITE_SUPABASE_ANON_KEY</li>}
                {!hasEvolutionApiUrl && <li>VITE_EVOLUTION_API_URL</li>}
                {!hasEvolutionApiKey && <li>VITE_EVOLUTION_API_KEY</li>}
                </ul>
                <p className="mt-1">
                  Create a <code className="bg-yellow-100 px-1 rounded">.env.local</code> file 
                  with your actual values to connect to real services.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {children}
    </>
  );
};

export default DevelopmentMode; 