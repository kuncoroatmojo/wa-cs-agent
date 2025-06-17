import React, { useState } from 'react';
import { auth } from '../lib/supabase';

const AuthDebug: React.FC = () => {
  const [email, setEmail] = useState('test@test.com');
  const [password, setPassword] = useState('password123');
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testSignUp = async () => {
    setLoading(true);
    setResult('Testing sign up...');
    
    try {
      const { data, error } = await auth.signUp(email, password, { name: 'Test User' });
      
      if (error) {
        setResult(`Sign up error: ${error.message}`);
      } else if (data?.user) {
        setResult(`Sign up success! User ID: ${data.user.id}, Email confirmed: ${!!data.user.email_confirmed_at}`);
      } else {
        setResult('Sign up completed but no user data returned');
      }
    } catch (error) {
      setResult(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    setLoading(false);
  };

  const testSignIn = async () => {
    setLoading(true);
    setResult('Testing sign in...');
    
    try {
      const { data, error } = await auth.signIn(email, password);
      
      if (error) {
        setResult(`Sign in error: ${error.message}`);
      } else if (data?.user) {
        setResult(`Sign in success! User ID: ${data.user.id}, Email: ${data.user.email}`);
      } else {
        setResult('Sign in completed but no user data returned');
      }
    } catch (error) {
      setResult(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    setLoading(false);
  };

  const testConnection = async () => {
    setLoading(true);
    setResult('Testing Supabase connection...');
    
    try {
      const { user, error } = await auth.getUser();
      
      if (error) {
        setResult(`Connection test error: ${error.message}`);
      } else if (user) {
        setResult(`Connection successful! Current user: ${user.email}`);
      } else {
        setResult('Connection successful! No current user.');
      }
    } catch (error) {
      setResult(`Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Authentication Debug</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={testConnection}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Test Connection
          </button>
          <button
            onClick={testSignUp}
            disabled={loading}
            className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            Test Sign Up
          </button>
          <button
            onClick={testSignIn}
            disabled={loading}
            className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50"
          >
            Test Sign In
          </button>
        </div>
        
        {result && (
          <div className="mt-4 p-3 bg-gray-100 rounded-md">
            <pre className="text-sm whitespace-pre-wrap">{result}</pre>
          </div>
        )}
        
        <div className="mt-4 text-xs text-gray-500">
          <p><strong>Supabase URL:</strong> {import.meta.env.VITE_SUPABASE_URL}</p>
          <p><strong>API Key:</strong> {import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20)}...</p>
        </div>
      </div>
    </div>
  );
};

export default AuthDebug; 