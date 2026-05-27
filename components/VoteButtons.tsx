/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

type Vote = {
  match_id: number;
  intent: string;
  user_email: string;
  username?: string | null; 
  avatar_url?: string | null; 
};

export default function VoteButtons({ matchId, initialVotes = [], onVoteChange }: { matchId: number; initialVotes: Vote[]; onVoteChange?: () => void; }) {
  const [votes, setVotes] = useState<Vote[]>(initialVotes);
  
  // NEW: A lock to prevent rapid-click vote stacking
  const [isProcessing, setIsProcessing] = useState(false); 

  useEffect(() => {
    setVotes(initialVotes || []);
  }, [initialVotes]);
  
  const handleVote = async (intent: 'watch' | 'host') => {
    if (isProcessing) return; // Prevent double-clicking
    setIsProcessing(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) {
      toast.error("Please log in to vote!");
      setIsProcessing(false);
      return;
    }

    const userEmail = user.email;
    const username = user.user_metadata?.username || user.user_metadata?.full_name || 'Fan';
    const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || '';

    // REVERTED: Back to independent toggles for Watch and Host
    const existingVote = votes.find(v => v.user_email === userEmail && v.intent === intent);

    if (existingVote) {
      // TOGGLE OFF
      const { error } = await supabase.from('votes').delete().match({ match_id: matchId, user_email: userEmail, intent: intent });
      if (!error) {
        setVotes(prev => prev.filter(v => !(v.user_email === userEmail && v.intent === intent)));
        if (onVoteChange) onVoteChange();
      }
    } else {
      // TOGGLE ON
      const newVote = { user_email: userEmail, match_id: matchId, intent: intent, username: username, avatar_url: avatar };
      const { error } = await supabase.from('votes').insert(newVote);
      if (!error) {
        setVotes(prev => [...prev, newVote]);
        if (onVoteChange) onVoteChange();
      }
    }
    
    setIsProcessing(false); // Unlock the button
  };

  const watchers = votes.filter(v => v.intent === 'watch');
  const hosts = votes.filter(v => v.intent === 'host');

  const renderAvatars = (voteList: Vote[]) => (
    <div className="flex flex-wrap gap-1 mt-1">
      {voteList.map((v, index) => {
        const displayName = v.username || 'Fan'; 
        return v.avatar_url ? 
          // Added 'index' to the key just in case old stacked votes are still in your database
          <img key={`${v.user_email}-${index}`} src={v.avatar_url} title={displayName} alt={displayName} className="w-6 h-6 rounded-full border border-gray-200 object-cover" /> :
          <div key={`${v.user_email}-${index}`} title={displayName} className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center uppercase">
            {displayName[0]}
          </div>
      })}
    </div>
  );

  return (
    <div className="mt-6 border-t border-gray-100 pt-4">
      <div className="flex gap-2 mb-4">
        <button 
          onClick={() => handleVote('watch')} 
          disabled={isProcessing}
          className={`flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-semibold transition flex justify-center items-center gap-2 ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800'}`}
        >
          <span>Vote to Watch</span><span className="bg-white text-gray-900 px-2 py-0.5 rounded-full text-xs">{watchers.length}</span>
        </button>
        <button 
          onClick={() => handleVote('host')} 
          disabled={isProcessing}
          className={`flex-1 bg-green-100 text-green-800 py-2 rounded-lg text-sm font-semibold transition flex justify-center items-center gap-2 ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-200'}`}
        >
          <span>Host Game</span><span className="bg-green-800 text-white px-2 py-0.5 rounded-full text-xs">{hosts.length}</span>
        </button>
      </div>

      <div className="text-xs text-gray-600 space-y-3 min-h-[40px]">
        {watchers.length > 0 && <div><span className="font-bold text-gray-800 flex items-center gap-1">👁️ Watching:</span>{renderAvatars(watchers)}</div>}
        {hosts.length > 0 && <div><span className="font-bold text-gray-800 flex items-center gap-1">🏠 Hosting:</span>{renderAvatars(hosts)}</div>}
      </div>
    </div>
  );
}