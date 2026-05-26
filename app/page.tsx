/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatInTimeZone } from 'date-fns-tz';
import Link from 'next/link';
import VoteButtons from '../components/VoteButtons';
import { Toaster } from 'react-hot-toast';

type Match = { id: number; group_name: string; home_team: string; away_team: string; venue_city: string; venue_stadium: string; utc_start_time: string; };
type Vote = { match_id: number; intent: string; user_email: string; username?: string | null; avatar_url?: string | null; };

const getVenueTimeZone = (city: string) => {
  const zones: Record<string, string> = {
    'Mexico City': 'America/Mexico_City', 'Guadalajara': 'America/Mexico_City', 'Monterrey': 'America/Monterrey',
    'Los Angeles': 'America/Los_Angeles', 'San Francisco': 'America/Los_Angeles', 'Seattle': 'America/Los_Angeles', 'Vancouver': 'America/Vancouver',
    'Houston': 'America/Chicago', 'Dallas': 'America/Chicago', 'Kansas City': 'America/Chicago',
    'Atlanta': 'America/New_York', 'Miami': 'America/New_York', 'Boston': 'America/New_York', 'Philadelphia': 'America/New_York', 'New York/New Jersey': 'America/New_York', 'Toronto': 'America/Toronto',
  };
  return zones[city] || 'UTC';
};

export default function Home() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]); 
  const [user, setUser] = useState<any>(null);
  
  // Added 'any_votes' to the filter list
  const [filterMode, setFilterMode] = useState<'all' | 'group' | 'nation' | 'needs_host' | 'my_votes' | 'any_votes'>('all');
  const [filterValue, setFilterValue] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      const { data: matchData } = await supabase.from('matches').select('*').order('utc_start_time', { ascending: true });
      if (matchData) setMatches(matchData as Match[]);

      const { data: voteData } = await supabase.from('votes').select('*');
      if (voteData) setVotes(voteData as Vote[]);

      const { data: userData } = await supabase.auth.getUser();
      setUser(userData.user);
    };
    loadData();

    // NEW LOGIC: Real-time listener for Facebook/Google OAuth redirects
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const uniqueGroups = useMemo(() => Array.from(new Set(matches.map(m => m.group_name))).filter(Boolean).sort(), [matches]);
  const uniqueNations = useMemo(() => Array.from(new Set(matches.flatMap(m => [m.home_team, m.away_team]))).filter(Boolean).sort(), [matches]);

  const filteredMatches = useMemo(() => {
    if (!matches) return [];
    let result = matches;
    
    if (filterMode === 'group' && filterValue) {
      result = matches.filter(match => match.group_name === filterValue);
    } else if (filterMode === 'nation' && filterValue) {
      result = matches.filter(match => match.home_team === filterValue || match.away_team === filterValue);
    } else if (filterMode === 'needs_host') {
      result = matches.filter(match => {
        const matchVotes = votes.filter(v => v.match_id === match.id);
        const hasWatchers = matchVotes.some(v => v.intent === 'watch');
        const hasHost = matchVotes.some(v => v.intent === 'host');
        return hasWatchers && !hasHost;
      });
    } else if (filterMode === 'my_votes' && user) {
      result = matches.filter(match => {
        return votes.some(v => v.match_id === match.id && v.user_email === user.email);
      });
    } else if (filterMode === 'any_votes') {
      // NEW LOGIC: Show matches that have at least one vote of any kind
      result = matches.filter(match => {
        return votes.some(v => v.match_id === match.id);
      });
    }

    return result.sort((a, b) => new Date(a.utc_start_time).getTime() - new Date(b.utc_start_time).getTime());
  }, [matches, votes, filterMode, filterValue, user]);

  const handleModeChange = (mode: 'all' | 'group' | 'nation' | 'needs_host' | 'my_votes' | 'any_votes') => {
    setFilterMode(mode);
    setFilterValue('');
  };

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const displayName = user?.user_metadata?.username || user?.user_metadata?.full_name || 'My Profile';

  return (
    <main className="min-h-screen p-8">
      <Toaster position="bottom-center" />
      
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">World Cup 2026 Planner</h1>
            <p className="text-gray-600">Plan your watch parties and hosting schedule.</p>
          </div>
          
          {user ? (
            <Link href="/profile" className="flex items-center gap-3 hover:opacity-80 transition bg-white p-2 pr-4 rounded-full shadow-sm border border-gray-200">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-10 h-10 rounded-full object-cover border border-gray-200" />
              ) : (
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold uppercase">{displayName[0]}</div>
              )}
              <span className="font-semibold text-gray-800">{displayName}</span>
            </Link>
          ) : (
            <Link href="/login" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition">Login / Sign Up</Link>
          )}
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap bg-gray-100 p-1 rounded-lg w-full sm:w-auto">
            <button onClick={() => handleModeChange('all')} className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-semibold transition ${filterMode === 'all' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>All Matches</button>
            <button onClick={() => handleModeChange('group')} className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-semibold transition ${filterMode === 'group' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>By Group</button>
            <button onClick={() => handleModeChange('nation')} className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-semibold transition ${filterMode === 'nation' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>By Nation</button>
            
            {/* NEW: Voted Matches Button */}
            <button onClick={() => handleModeChange('any_votes')} className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-bold transition flex items-center gap-2 ${filterMode === 'any_votes' ? 'bg-purple-100 shadow-sm text-purple-700' : 'text-gray-600 hover:text-purple-600'}`}>
              🔥 Voted Matches
            </button>

            <button onClick={() => handleModeChange('needs_host')} className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-bold transition flex items-center gap-2 ${filterMode === 'needs_host' ? 'bg-orange-100 shadow-sm text-orange-700' : 'text-gray-600 hover:text-orange-600'}`}>
              ⚠️ Needs Host
            </button>
            
            {user && (
              <button onClick={() => handleModeChange('my_votes')} className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-bold transition flex items-center gap-2 ${filterMode === 'my_votes' ? 'bg-green-100 shadow-sm text-green-700' : 'text-gray-600 hover:text-green-600'}`}>
                ✅ My Votes
              </button>
            )}
          </div>

          {filterMode === 'group' && (
            <select className="w-full sm:w-64 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-gray-900" value={filterValue} onChange={(e) => setFilterValue(e.target.value)}>
              <option value="" disabled>Select a Group...</option>
              {uniqueGroups.map(group => <option key={group} value={group}>{group}</option>)}
            </select>
          )}

          {filterMode === 'nation' && (
            <select className="w-full sm:w-64 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-gray-900" value={filterValue} onChange={(e) => setFilterValue(e.target.value)}>
              <option value="" disabled>Select a Nation...</option>
              {uniqueNations.map(nation => <option key={nation} value={nation}>{nation}</option>)}
            </select>
          )}
        </div>

        {filteredMatches.length === 0 ? (
          <div className="text-center p-12 bg-white rounded-xl border border-gray-100">
            <p className="text-gray-500 font-medium">
              {filterMode === 'my_votes' ? "You haven't voted on any matches yet!" : "No matches found for this filter."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredMatches.map((match) => {
              const venueTz = getVenueTimeZone(match.venue_city);
              const matchDate = new Date(match.utc_start_time);
              const bgTime = formatInTimeZone(matchDate, 'Europe/Sofia', 'MMM do, HH:mm');
              const localTime = formatInTimeZone(matchDate, venueTz, 'HH:mm');
              const matchVotes = votes?.filter(v => v.match_id === match.id) || [];

              return (
                <div key={match.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">{match.group_name}</span>
                    <h2 className="text-xl font-bold mt-2 mb-4 text-gray-900">{match.home_team} vs {match.away_team}</h2>
                    <div className="text-sm text-gray-600 space-y-2 mb-2">
                      <p>📍 {match.venue_stadium}, {match.venue_city}</p>
                      <p>🇧🇬 <strong>BG Time:</strong> {bgTime}</p>
                      <p>🏟️ <strong>Local Time:</strong> {localTime}</p>
                    </div>
                  </div>
                  <VoteButtons matchId={match.id} initialVotes={matchVotes} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}