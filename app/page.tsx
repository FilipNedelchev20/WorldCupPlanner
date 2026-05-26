/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatInTimeZone } from 'date-fns-tz';
import Link from 'next/link';
import VoteButtons from '../components/VoteButtons';
import { Toaster } from 'react-hot-toast';

type Match = {
  id: number;
  group_name: string;
  home_team: string;
  away_team: string;
  venue_city: string;
  venue_stadium: string;
  utc_start_time: string;
};

type Vote = {
  match_id: number;
  intent: string;
  user_email: string;
  username: string;
};

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
  const [error, setError] = useState<string | null>(null);

  const [filterMode, setFilterMode] = useState<'all' | 'group' | 'nation'>('all');
  const [filterValue, setFilterValue] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .order('utc_start_time', { ascending: true });

      if (matchError) setError(matchError.message);
      else setMatches(matchData as Match[]);

      const { data: voteData } = await supabase
        .from('votes')
        .select('match_id, intent, user_email, username');
      
      if (voteData) setVotes(voteData as Vote[]);

      const { data: userData } = await supabase.auth.getUser();
      setUser(userData.user);
    };

    loadData();
  }, []);

  const uniqueGroups = useMemo(() => {
    if (!matches || matches.length === 0) return [];
    return Array.from(new Set(matches.map(m => m.group_name))).filter(Boolean).sort();
  }, [matches]);

  const uniqueNations = useMemo(() => {
    if (!matches || matches.length === 0) return [];
    return Array.from(new Set(matches.flatMap(m => [m.home_team, m.away_team]))).filter(Boolean).sort();
  }, [matches]);

  // Filter AND explicitly sort by Date
  const filteredMatches = useMemo(() => {
    if (!matches) return [];
    
    let result = matches;
    
    // Apply filters if needed
    if (filterMode === 'group' && filterValue) {
      result = matches.filter(match => match.group_name === filterValue);
    } else if (filterMode === 'nation' && filterValue) {
      result = matches.filter(match => match.home_team === filterValue || match.away_team === filterValue);
    }

    // Guarantee chronological sorting
    return result.sort((a, b) => new Date(a.utc_start_time).getTime() - new Date(b.utc_start_time).getTime());
  }, [matches, filterMode, filterValue]);

  const handleModeChange = (mode: 'all' | 'group' | 'nation') => {
    setFilterMode(mode);
    setFilterValue('');
  };

  if (error) {
    return <div className="p-8 text-red-500">Database Error: {error}</div>;
  }

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const displayName = user?.user_metadata?.username || user?.user_metadata?.full_name || 'My Profile';

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <Toaster position="bottom-center" />
      
      <div className="max-w-5xl mx-auto">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">World Cup 2026 Planner</h1>
            <p className="text-gray-600">Plan your watch parties and hosting schedule.</p>
          </div>
          
          {user ? (
            <Link href="/profile" className="flex items-center gap-3 hover:opacity-80 transition bg-white p-2 pr-4 rounded-full shadow-sm border border-gray-200">
              {avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={avatarUrl} alt="Profile" className="w-10 h-10 rounded-full object-cover border border-gray-200" />
              ) : (
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold uppercase">
                  {displayName[0]}
                </div>
              )}
              <span className="font-semibold text-gray-800">{displayName}</span>
            </Link>
          ) : (
            <Link href="/login" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition">
              Login / Sign Up
            </Link>
          )}
        </div>

        {/* FILTER CONTROLS */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex bg-gray-100 p-1 rounded-lg w-full sm:w-auto">
            <button 
              onClick={() => handleModeChange('all')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-semibold transition ${filterMode === 'all' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
            >
              All Matches
            </button>
            <button 
              onClick={() => handleModeChange('group')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-semibold transition ${filterMode === 'group' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
            >
              By Group
            </button>
            <button 
              onClick={() => handleModeChange('nation')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-semibold transition ${filterMode === 'nation' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
            >
              By Nation
            </button>
          </div>

          {filterMode === 'group' && (
            <select 
              className="w-full sm:w-64 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
            >
              <option value="" disabled>Select a Group...</option>
              {uniqueGroups.map(group => <option key={group} value={group}>{group}</option>)}
            </select>
          )}

          {filterMode === 'nation' && (
            <select 
              className="w-full sm:w-64 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
            >
              <option value="" disabled>Select a Nation...</option>
              {uniqueNations.map(nation => <option key={nation} value={nation}>{nation}</option>)}
            </select>
          )}
        </div>

        {/* MATCHES GRID */}
        {filteredMatches.length === 0 ? (
          <div className="text-center p-12 bg-white rounded-xl border border-gray-100">
            <p className="text-gray-500 font-medium">No matches found for this filter.</p>
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
                    <h2 className="text-xl font-bold mt-2 mb-4">
                      {match.home_team} vs {match.away_team}
                    </h2>
                    
                    <div className="text-sm text-gray-600 space-y-2 mb-2">
                      <p>📍 {match.venue_stadium}, {match.venue_city}</p>
                      <p>🇧🇬 <strong>BG Time:</strong> {bgTime}</p>
                      <p>🏟️ <strong>Local Time:</strong> {localTime}</p>
                    </div>
                  </div>

                  <VoteButtons 
                    matchId={match.id} 
                    initialVotes={matchVotes} 
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}