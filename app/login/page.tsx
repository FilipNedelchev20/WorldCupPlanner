"use client";

// FIXED: Added the extra ../ so it can actually find your database file!
import { supabase } from '../../lib/supabase'; 
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      
      <div className="w-full max-w-md mb-6">
        <Link href="/" className="text-gray-600 hover:text-gray-900 font-bold">
          &larr; Back to Home
        </Link>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-900">Welcome Back</h1>
        
        <Auth
          supabaseClient={supabase}
          providers={['google', 'facebook']}
          theme="light" 
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#eab308', 
                  brandAccent: '#ca8a04',
                  inputText: '#111827', 
                  inputLabelText: '#374151',
                  defaultButtonText: '#111827',
                  defaultButtonBackground: '#f3f4f6',
                  defaultButtonBackgroundHover: '#e5e7eb',
                },
                radii: {
                  borderRadiusButton: '0.75rem',
                  buttonBorderRadius: '0.75rem',
                  inputBorderRadius: '0.75rem',
                }
              }
            }
          }}
        />
      </div>
    </main>
  );
}