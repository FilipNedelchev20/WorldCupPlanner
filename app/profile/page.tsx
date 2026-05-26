"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login'); 
      } else {
        setUser(user);
      }
    };
    getUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (!user) return <div className="p-8 text-center font-semibold">Loading Profile...</div>;

  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
  const displayName = user.user_metadata?.full_name || user.user_metadata?.username || 'World Cup Fan';

  return (
    <main className="min-h-screen bg-gray-50 p-8 relative flex items-center justify-center">
      <Link href="/" className="absolute top-8 left-8 text-gray-600 hover:text-gray-900 font-medium">
        &larr; Back to Home
      </Link>
      
      <div className="bg-white p-10 rounded-xl shadow-sm border border-gray-100 w-full max-w-md text-center">
        {avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={avatarUrl} alt="Profile" className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-blue-50 object-cover" />
        ) : (
          <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4 border-4 border-blue-50 uppercase">
            {displayName[0]}
          </div>
        )}
        
        <h1 className="text-2xl font-bold mb-1">{displayName}</h1>
        <p className="text-gray-500 mb-8">{user.email}</p>
        
        <button 
          onClick={handleLogout}
          className="w-full bg-red-50 text-red-600 py-3 rounded-lg font-bold hover:bg-red-100 transition"
        >
          Sign Out
        </button>
      </div>
    </main>
  );
}