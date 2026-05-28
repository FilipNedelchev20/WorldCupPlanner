/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

type Vote = {
  match_id: number;
  intent: string;
  user_email: string;
  username?: string | null; 
  avatar_url?: string | null;
  host_message?: string | null;
  rsvp_limit?: number | null;
};

export default function VoteButtons({ 
  matchId, 
  votes = [], 
  currentUserEmail,
  onVoteChange 
}: { 
  matchId: number; 
  votes: Vote[]; 
  currentUserEmail?: string;
  onVoteChange?: () => void; 
}) {
  const [isProcessing, setIsProcessing] = useState(false); 
  const [showHostModal, setShowHostModal] = useState(false);
  const [hostMessage, setHostMessage] = useState("");
  const [rsvpLimit, setRsvpLimit] = useState<number | "">("");

  const handleWatchVote = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) {
      toast.error("Please log in to vote!");
      setIsProcessing(false);
      return;
    }

    const existingVote = votes.find(v => v.user_email === user.email && v.intent === 'watch');

    if (existingVote) {
      const { error } = await supabase.from('votes')
        .delete()
        .eq('match_id', matchId)
        .eq('user_email', user.email)
        .eq('intent', 'watch');
        
      if (!error && onVoteChange) onVoteChange();
    } else {
      const newVote = { 
        user_email: user.email, match_id: matchId, intent: 'watch', 
        username: user.user_metadata?.username || user.user_metadata?.full_name || 'Fan', 
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || '' 
      };
      const { error } = await supabase.from('votes').insert(newVote);
      if (!error && onVoteChange) onVoteChange();
    }
    setIsProcessing(false);
  };

  const handleHostClick = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("Please log in to host!");

    const existingVote = votes.find(v => v.user_email === user.email && v.intent === 'host');
    if (existingVote) {
      await supabase.from('votes')
        .delete()
        .eq('match_id', matchId)
        .eq('user_email', user.email)
        .eq('intent', 'host');
        
      if (onVoteChange) onVoteChange();
    } else {
      setShowHostModal(true);
    }
  };

  const submitHostVote = async () => {
    setIsProcessing(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const newVote = { 
        user_email: user.email, match_id: matchId, intent: 'host', 
        username: user.user_metadata?.username || user.user_metadata?.full_name || 'Fan', 
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
        host_message: hostMessage,
        rsvp_limit: rsvpLimit === "" ? null : Number(rsvpLimit)
      };
      await supabase.from('votes').insert(newVote);
      if (onVoteChange) onVoteChange();
    }
    setShowHostModal(false);
    setIsProcessing(false);
    setHostMessage("");
    setRsvpLimit("");
  };

  const watchers = votes.filter(v => v.intent === 'watch');
  const hosts = votes.filter(v => v.intent === 'host');

  const totalCapacity = hosts.reduce((acc, h) => acc + (h.rsvp_limit || 0), 0);
  const hasLimits = hosts.some(h => h.rsvp_limit && h.rsvp_limit > 0);
  
  const userHasWatchVote = currentUserEmail ? watchers.some(v => v.user_email === currentUserEmail) : false;
  const isFull = hasLimits && watchers.length >= totalCapacity;
  const disableWatchBtn = isProcessing || (isFull && !userHasWatchVote);

  return (
    <div className="mt-6 border-t border-gray-100 pt-4">
      <div className="flex gap-2 mb-4">
        <button 
          onClick={handleWatchVote} 
          disabled={disableWatchBtn}
          className={`flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-semibold transition flex justify-center items-center gap-2 ${disableWatchBtn ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800'}`}
        >
          <span>{isFull && !userHasWatchVote ? 'Party Full' : 'Vote to Watch'}</span>
          <span className="bg-white text-gray-900 px-2 py-0.5 rounded-full text-xs">{watchers.length}{hasLimits ? `/${totalCapacity}` : ''}</span>
        </button>
        <button 
          onClick={handleHostClick} disabled={isProcessing}
          className={`flex-1 bg-green-100 text-green-800 py-2 rounded-lg text-sm font-semibold transition flex justify-center items-center gap-2 ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-200'}`}
        >
          <span>Host Game</span><span className="bg-green-800 text-white px-2 py-0.5 rounded-full text-xs">{hosts.length}</span>
        </button>
      </div>

      <div className="text-xs text-gray-600 space-y-3 min-h-[40px]">
        {hosts.length > 0 && (
          <div className="bg-green-50 p-2 rounded-lg border border-green-100 mb-2">
            <span className="font-bold text-green-800 flex items-center gap-1 mb-1">🏠 Hosts:</span>
            {hosts.map((h, i) => (
              <div key={`${h.user_email}-${i}`} className="ml-5 list-disc mb-1">
                <span className="font-bold">{h.username}</span> 
                {h.rsvp_limit && <span className="text-[10px] bg-green-200 text-green-800 px-1.5 py-0.5 rounded ml-1">Limit: {h.rsvp_limit}</span>}
                {h.host_message && <p className="italic text-gray-500 text-[10px]">"{h.host_message}"</p>}
              </div>
            ))}
          </div>
        )}
        {watchers.length > 0 && <div><span className="font-bold text-gray-800 flex items-center gap-1">👁️ Watching ({watchers.length}):</span></div>}
      </div>

      {showHostModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
            <h3 className="text-xl font-bold mb-4">Hosting Rules 🏠</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Guest Limit (Optional)</label>
                <input type="number" placeholder="e.g. 5" value={rsvpLimit} onChange={e => setRsvpLimit(e.target.value ? Number(e.target.value) : "")} className="w-full p-2 border border-gray-300 rounded-lg mt-1 outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">House Rules / Note</label>
                <input type="text" placeholder="e.g. BYOB, ordering pizza!" value={hostMessage} onChange={e => setHostMessage(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg mt-1 outline-none focus:border-green-500" />
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setShowHostModal(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg">Cancel</button>
                <button onClick={submitHostVote} className="flex-1 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700">Confirm Host</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}