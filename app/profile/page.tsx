/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login'); 
      } else {
        setUser(user);
        setEditName(user.user_metadata?.username || user.user_metadata?.full_name || '');
        setEditAvatar(user.user_metadata?.avatar_url || user.user_metadata?.picture || '');
      }
    };
    getUser();
  }, [router]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) return;
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}-${Math.random()}.${fileExt}`;

      setIsUploading(true);

      // Upload to the 'avatars' bucket in Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get the public URL of the uploaded image
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      
      setEditAvatar(data.publicUrl);
      toast.success("Image uploaded! Click Save to apply.");
    } catch (error: any) {
      toast.error(error.message || "Error uploading image");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    const { data, error } = await supabase.auth.updateUser({
      data: { username: editName, avatar_url: editAvatar }
    });

    if (error) {
      toast.error("Error updating profile!");
    } else {
      setUser(data.user);
      setIsEditing(false);
      toast.success("Profile updated successfully!");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (!user) return <div className="p-8 text-center font-semibold">Loading Profile...</div>;

  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
  const displayName = user.user_metadata?.username || user.user_metadata?.full_name || 'World Cup Fan';

  return (
    <main className="min-h-screen bg-gray-50 p-8 relative flex items-center justify-center">
      <Link href="/" className="absolute top-8 left-8 text-gray-600 hover:text-gray-900 font-medium">
        &larr; Back to Home
      </Link>
      
      <div className="bg-white p-10 rounded-xl shadow-sm border border-gray-100 w-full max-w-md">
        
        {isEditing ? (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-center mb-4">Edit Profile</h2>
            
            {/* Avatar Preview */}
            <div className="flex justify-center mb-4">
              {editAvatar ? (
                <img src={editAvatar} alt="Preview" className="w-20 h-20 rounded-full object-cover border-4 border-blue-50" />
              ) : (
                <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 text-sm font-bold">No Image</div>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Display Name</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full p-2 border border-gray-300 rounded mt-1 outline-none focus:border-blue-500" />
            </div>

            <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
              <label className="text-xs font-bold text-gray-500 uppercase">Update Avatar</label>
              
              {/* Option 1: File Upload */}
              <div>
                <span className="text-xs text-gray-600 font-semibold block mb-1">Option 1: Upload File</span>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
                {isUploading && <p className="text-xs text-blue-600 mt-1 animate-pulse">Uploading...</p>}
              </div>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-bold">OR</span>
                <div className="flex-grow border-t border-gray-200"></div>
              </div>

              {/* Option 2: Paste URL */}
              <div>
                <span className="text-xs text-gray-600 font-semibold block mb-1">Option 2: Paste Image URL</span>
                <input type="text" placeholder="https://..." value={editAvatar} onChange={e => setEditAvatar(e.target.value)} className="w-full p-2 text-sm border border-gray-300 rounded outline-none focus:border-blue-500" />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setIsEditing(false)} className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 transition rounded-lg font-semibold text-gray-700">Cancel</button>
              <button onClick={handleSave} disabled={isUploading} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 transition rounded-lg font-semibold text-white disabled:opacity-50">Save</button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-blue-50 object-cover" />
            ) : (
              <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4 border-4 border-blue-50 uppercase">
                {displayName[0]}
              </div>
            )}
            <h1 className="text-2xl font-bold mb-1">{displayName}</h1>
            <p className="text-gray-500 mb-6">{user.email}</p>
            
            <button onClick={() => setIsEditing(true)} className="w-full bg-gray-100 text-gray-800 py-2 rounded-lg font-bold hover:bg-gray-200 transition mb-3">
              Edit Profile
            </button>
            <button onClick={handleLogout} className="w-full bg-red-50 text-red-600 py-2 rounded-lg font-bold hover:bg-red-100 transition">
              Sign Out
            </button>
          </div>
        )}
      </div>
    </main>
  );
}