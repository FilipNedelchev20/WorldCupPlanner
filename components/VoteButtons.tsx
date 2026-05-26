"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

// Define the exact shape of our vote data
type Vote = {
  match_id: number;
  intent: string;
  user_email: string;
  username: string;
};

export default function VoteButtons({ matchId, initialVotes = [] }: { matchId: number; initialVotes: Vote[]; }) {
  const [votes, setVotes] = useState<Vote[]>(initialVotes);

  useEffect(() => {
    setVotes(initialVotes || []);
  }, [initialVotes]);
  
  const handleVote = async (intent: 'watch' | 'host') => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Safety check: ensure the user and their email actually exist
    if (!user || !user.email) {
      toast.error("Please log in or sign up to vote!");
      return;
    }

    const userEmail = user.email;
    const username = user.user_metadata?.username || user.user_metadata?.full_name || 'Fan';

    // Did they already vote for this exact thing?
    const existingVote = votes.find(v => v.user_email === userEmail && v.intent === intent);

    if (existingVote) {
      // TOGGLE OFF
      const { error } = await supabase
        .from('votes')
        .delete()
        .match({ match_id: matchId, user_email: userEmail, intent: intent });

      if (error) {
        toast.error("Error removing vote: " + error.message);
      } else {
        setVotes(prev => prev.filter(v => !(v.user_email === userEmail && v.intent === intent)));
        toast.success(`Removed your ${intent} vote.`);
      }
    } else {
      // TOGGLE ON
      const newVote = { user_email: userEmail, match_id: matchId, intent: intent, username: username };
      const { error } = await supabase
        .from('votes')
        .insert(newVote);

      if (error) {
        toast.error("Error saving vote: " + error.message);
      } else {
        setVotes(prev => [...prev, newVote]);
        toast.success(`Successfully voted to ${intent}!`);
      }
    }
  };

  const watchers = votes.filter(v => v.intent === 'watch').map(v => v.username || 'Anonymous');
  const hosts = votes.filter(v => v.intent === 'host').map(v => v.username || 'Anonymous');

  return (
    <div className="mt-6 border-t border-gray-100 pt-4">
      <div className="flex gap-2 mb-4">
        <button 
          onClick={() => handleVote('watch')}
          className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 transition flex justify-center items-center gap-2"
        >
          <span>Vote to Watch</span>
          <span className="bg-white text-gray-900 px-2 py-0.5 rounded-full text-xs">{watchers.length}</span>
        </button>
        <button 
          onClick={() => handleVote('host')}
          className="flex-1 bg-green-100 text-green-800 py-2 rounded-lg text-sm font-semibold hover:bg-green-200 transition flex justify-center items-center gap-2"
        >
          <span>Host Game</span>
          <span className="bg-green-800 text-white px-2 py-0.5 rounded-full text-xs">{hosts.length}</span>
        </button>
      </div>

      <div className="text-xs text-gray-600 space-y-1.5 leading-relaxed min-h-[40px]">
        {watchers.length > 0 && (
          <p>👁️ <span className="font-bold text-gray-800">Watching:</span> {watchers.join(', ')}</p>
        )}
        {hosts.length > 0 && (
          <p>🏠 <span className="font-bold text-gray-800">Hosting:</span> {hosts.join(', ')}</p>
        )}
      </div>
    </div>
  );
}