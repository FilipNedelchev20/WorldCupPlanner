"use client";

import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    setLoading(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    else router.push('/'); 
    setLoading(false);
  };

  const handleSocialLogin = async (provider: 'google' | 'facebook') => {
    const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : 'http://localhost:3000/';
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: redirectUrl,
      }
    });

    if (error) {
      setMessage(`You need to set up ${provider} keys in Supabase first!`);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-8 relative">
      <Link href="/" className="absolute top-8 left-8 text-gray-600 hover:text-gray-900 font-medium">
        &larr; Back to Home
      </Link>

      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Welcome Back</h1>
        
        {/* SOCIAL BUTTONS */}
        <div className="flex gap-3 mb-6">
          <button onClick={() => handleSocialLogin('google')} className="flex-1 border border-gray-300 py-2 rounded-lg font-semibold hover:bg-gray-50 transition flex justify-center items-center gap-2 text-sm">
            🟡 Google
          </button>
          <button onClick={() => handleSocialLogin('facebook')} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition flex justify-center items-center gap-2 text-sm">
            🔵 Facebook
          </button>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="h-px bg-gray-200 flex-1"></div>
          <span className="text-xs text-gray-400 font-semibold uppercase">Or continue with email</span>
          <div className="h-px bg-gray-200 flex-1"></div>
        </div>

        <input 
          type="email" placeholder="Email address" 
          className="w-full mb-4 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={email} onChange={(e) => setEmail(e.target.value)}
        />
        
        <input 
          type="password" placeholder="Password" 
          className="w-full mb-6 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={password} onChange={(e) => setPassword(e.target.value)}
        />
        
        <button 
          onClick={handleLogin} disabled={loading}
          className="w-full bg-gray-900 text-white py-3 rounded-lg font-bold hover:bg-gray-800 transition disabled:opacity-50 mb-4"
        >
          Log In
        </button>
        
        {message && <p className="mb-4 text-sm text-red-500 text-center font-semibold">{message}</p>}

        <p className="text-center text-sm text-gray-600">
          Don&apos;t have an account? <Link href="/signup" className="text-blue-600 hover:underline font-semibold">Sign up</Link>
        </p>
      </div>
    </main>
  );
}