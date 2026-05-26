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

// NOTICE: We added 'onVoteChange' so it can talk to the parent page!
export default function VoteButtons({ matchId, initialVotes = [], onVoteChange }: { matchId: number; initialVotes: Vote[]; onVoteChange?: () => void; }) {
  const [votes, setVotes] = useState<Vote[]>(initialVotes);

  useEffect(() => {
    setVotes(initialVotes || []);
  }, [initialVotes]);
  
  const handleVote = async (intent: 'watch' | 'host') => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) return toast.error("Please log in to vote!");

    const userEmail = user.email;
    const username = user.user_metadata?.username || user.user_metadata?.full_name || 'Fan';
    const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || '';

    // NEW: Find ANY vote by this user for this specific match (ignores intent)
    const existingVote = votes.find(v => v.user_email === userEmail);

    if (existingVote) {
      if (existingVote.intent === intent) {
        // TOGGLE OFF: They clicked the same button, so we delete their vote
        const { error } = await supabase.from('votes').delete().match({ match_id: matchId, user_email: userEmail });
        if (!error) {
          setVotes(prev => prev.filter(v => v.user_email !== userEmail));
          if (onVoteChange) onVoteChange();
        }
      } else {
        // SWAP VOTE: They clicked the OTHER button, so we update their existing vote
        const { error } = await supabase.from('votes').update({ intent: intent }).match({ match_id: matchId, user_email: userEmail });
        if (!error) {
          setVotes(prev => prev.map(v => v.user_email === userEmail ? { ...v, intent: intent } : v));
          if (onVoteChange) onVoteChange();
        }
      }
    } else {
      // NEW VOTE: They have never voted on this match before
      const newVote = { user_email: userEmail, match_id: matchId, intent: intent, username: username, avatar_url: avatar };
      const { error } = await supabase.from('votes').insert(newVote);
      if (!error) {
        setVotes(prev => [...prev, newVote]);
        if (onVoteChange) onVoteChange();
      }
    }
  };

  const watchers = votes.filter(v => v.intent === 'watch');
  const hosts = votes.filter(v => v.intent === 'host');

  const renderAvatars = (voteList: Vote[]) => (
    <div className="flex flex-wrap gap-1 mt-1">
      {voteList.map(v => {
        const displayName = v.username || 'Fan'; 
        return v.avatar_url ? 
          <img key={v.user_email} src={v.avatar_url} title={displayName} alt={displayName} className="w-6 h-6 rounded-full border border-gray-200 object-cover" /> :
          <div key={v.user_email} title={displayName} className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center uppercase">
            {displayName[0]}
          </div>
      })}
    </div>
  );

  return (
    <div className="mt-6 border-t border-gray-100 pt-4">
      <div className="flex gap-2 mb-4">
        <button onClick={() => handleVote('watch')} className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 transition flex justify-center items-center gap-2">
          <span>Vote to Watch</span><span className="bg-white text-gray-900 px-2 py-0.5 rounded-full text-xs">{watchers.length}</span>
        </button>
        <button onClick={() => handleVote('host')} className="flex-1 bg-green-100 text-green-800 py-2 rounded-lg text-sm font-semibold hover:bg-green-200 transition flex justify-center items-center gap-2">
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