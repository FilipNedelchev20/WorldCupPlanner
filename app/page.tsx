/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { formatInTimeZone } from 'date-fns-tz';
import Link from 'next/link';
import VoteButtons from '../components/VoteButtons';
import { Toaster } from 'react-hot-toast';

type Match = { id: number; group_name: string; home_team: string; away_team: string; venue_city: string; venue_stadium: string; utc_start_time: string; };
type Vote = { match_id: number; intent: string; user_email: string; username?: string | null; avatar_url?: string | null; };

const getCountryCode = (country: string) => {
  if (!country) return null;
  
  const map: Record<string, string> = {
    'usa': 'us', 'united states': 'us', 'mexico': 'mx', 'canada': 'ca', 'costa rica': 'cr', 'panama': 'pa', 'jamaica': 'jm', 'honduras': 'hn', 'el salvador': 'sv', 'haiti': 'ht', 'trinidad and tobago': 'tt', 'curaçao': 'cw', 'curacao': 'cw',
    'argentina': 'ar', 'brazil': 'br', 'uruguay': 'uy', 'colombia': 'co', 'ecuador': 'ec', 'peru': 'pe', 'chile': 'cl', 'paraguay': 'py', 'venezuela': 've', 'bolivia': 'bo',
    'france': 'fr', 'england': 'gb-eng', 'spain': 'es', 'germany': 'de', 'italy': 'it', 'portugal': 'pt', 'netherlands': 'nl', 'belgium': 'be', 'croatia': 'hr', 'switzerland': 'ch', 'denmark': 'dk', 'poland': 'pl', 'sweden': 'se', 'wales': 'gb-wls', 'serbia': 'rs', 'scotland': 'gb-sct', 'ukraine': 'ua', 'austria': 'at', 'turkey': 'tr', 'türkiye': 'tr', 'hungary': 'hu', 'czech republic': 'cz', 'czechia': 'cz', 'republic of ireland': 'ie', 'norway': 'no', 'finland': 'fi', 'iceland': 'is', 'greece': 'gr', 'romania': 'ro', 'bulgaria': 'bg', 'slovakia': 'sk', 'slovenia': 'si', 'albania': 'al', 'northern ireland': 'gb-nir', 'bosnia and herzegovina': 'ba',
    'senegal': 'sn', 'morocco': 'ma', 'cameroon': 'cm', 'ghana': 'gh', 'tunisia': 'tn', 'nigeria': 'ng', 'algeria': 'dz', 'egypt': 'eg', 'mali': 'ml', 'ivory coast': 'ci', 'cote d\'ivoire': 'ci', 'côte d\'ivoire': 'ci', 'south africa': 'za', 'burkina faso': 'bf', 'dr congo': 'cd', 'congo dr': 'cd', 'guinea': 'gn', 'cabo verde': 'cv', 'cape verde': 'cv',
    'japan': 'jp', 'south korea': 'kr', 'korea republic': 'kr', 'saudi arabia': 'sa', 'iran': 'ir', 'ir iran': 'ir', 'australia': 'au', 'qatar': 'qa', 'uae': 'ae', 'united arab emirates': 'ae', 'iraq': 'iq', 'china': 'cn', 'china pr': 'cn', 'oman': 'om', 'syria': 'sy', 'uzbekistan': 'uz', 'vietnam': 'vn', 'jordan': 'jo', 'bahrain': 'bh',
    'new zealand': 'nz', 'fiji': 'fj', 'solomon islands': 'sb', 'tahiti': 'pf'
  };

  const cleanCountryName = country.toLowerCase().trim();
  return map[cleanCountryName] || null;
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
  
  const [filterMode, setFilterMode] = useState<'all' | 'group' | 'nation' | 'needs_host' | 'my_votes' | 'any_votes'>('all');
  const [filterValue, setFilterValue] = useState<string>('');

  // NEW STATE: Tracks if the instruction modal is open
  const [showInstructions, setShowInstructions] = useState(false);

  const fetchVotes = useCallback(async () => {
    const { data: voteData } = await supabase.from('votes').select('*');
    if (voteData) setVotes(voteData as Vote[]);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const { data: matchData } = await supabase.from('matches').select('*').order('utc_start_time', { ascending: true });
      if (matchData) setMatches(matchData as Match[]);
      await fetchVotes();
      const { data: userData } = await supabase.auth.getUser();
      setUser(userData.user);
    };
    loadData();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchVotes(); 
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      authListener.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchVotes]);

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
      result = matches.filter(match => votes.some(v => v.match_id === match.id && v.user_email === user.email));
    } else if (filterMode === 'any_votes') {
      result = matches.filter(match => votes.some(v => v.match_id === match.id));
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
    <main className="min-h-screen bg-gray-50 pb-16">
      <Toaster position="bottom-center" />
      
      {/* STADIUM HERO BANNER */}
      <div className="relative bg-gray-900 text-white shadow-2xl mb-10">
        <img 
          src="https://images.unsplash.com/photo-1518605368461-1ee7e1617ff5?q=80&w=2000&auto=format&fit=crop" 
          alt="Stadium background" 
          className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent"></div>
        
        <div className="relative max-w-6xl mx-auto px-6 py-12 sm:py-20 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl sm:text-6xl font-extrabold mb-3 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 via-yellow-100 to-white">
              World Cup 2026
            </h1>
            <p className="text-gray-300 text-lg max-w-md font-medium">Plan your watch parties, find hosts, and never miss a match.</p>
          </div>
          
          {/* HEADER BUTTONS: Instructions + Profile/Login */}
          <div className="flex items-center gap-4 flex-wrap">
            <button 
              onClick={() => setShowInstructions(true)} 
              className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-5 py-3 rounded-full border border-white/20 text-white font-bold hover:bg-white/20 hover:scale-105 transition-all shadow-lg"
            >
              <span>📖</span> How to Use
            </button>

            {user ? (
              <Link href="/profile" className="flex items-center gap-3 hover:scale-105 transition-transform bg-white/10 backdrop-blur-md p-2 pr-5 rounded-full border border-white/20 shadow-lg">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-12 h-12 rounded-full object-cover border-2 border-yellow-400" />
                ) : (
                  <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center text-gray-900 font-bold text-xl uppercase">{displayName[0]}</div>
                )}
                <span className="font-semibold text-white drop-shadow-sm">{displayName}</span>
              </Link>
            ) : (
              <Link href="/login" className="bg-yellow-500 text-gray-900 px-8 py-3 rounded-full font-bold hover:bg-yellow-400 hover:scale-105 transition-all shadow-[0_0_20px_rgba(234,179,8,0.4)]">
                Login / Sign Up
              </Link>
            )}
          </div>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto px-6">
        {/* FILTER CONTROLS */}
        <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-200 mb-8 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-1 w-full lg:w-auto">
            <button onClick={() => handleModeChange('all')} className={`flex-1 lg:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${filterMode === 'all' ? 'bg-gray-900 shadow-md text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>All Matches</button>
            <button onClick={() => handleModeChange('group')} className={`flex-1 lg:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${filterMode === 'group' ? 'bg-gray-900 shadow-md text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>By Group</button>
            <button onClick={() => handleModeChange('nation')} className={`flex-1 lg:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${filterMode === 'nation' ? 'bg-gray-900 shadow-md text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>By Nation</button>
            
            <button onClick={() => handleModeChange('any_votes')} className={`flex-1 lg:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${filterMode === 'any_votes' ? 'bg-purple-100 shadow-sm text-purple-700' : 'text-gray-500 hover:bg-purple-50 hover:text-purple-600'}`}>
              🔥 Voted Matches
            </button>
            <button onClick={() => handleModeChange('needs_host')} className={`flex-1 lg:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${filterMode === 'needs_host' ? 'bg-orange-100 shadow-sm text-orange-700' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600'}`}>
              ⚠️ Needs Host
            </button>
            
            {user && (
              <button onClick={() => handleModeChange('my_votes')} className={`flex-1 lg:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${filterMode === 'my_votes' ? 'bg-green-100 shadow-sm text-green-700' : 'text-gray-500 hover:bg-green-50 hover:text-green-600'}`}>
                ✅ My Votes
              </button>
            )}
          </div>

          {filterMode === 'group' && (
            <select className="w-full lg:w-64 p-3 border-none bg-gray-50 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-sm font-bold text-gray-900 cursor-pointer" value={filterValue} onChange={(e) => setFilterValue(e.target.value)}>
              <option value="" disabled>Select a Group...</option>
              {uniqueGroups.map(group => <option key={group} value={group}>{group}</option>)}
            </select>
          )}

          {filterMode === 'nation' && (
            <select className="w-full lg:w-64 p-3 border-none bg-gray-50 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-sm font-bold text-gray-900 cursor-pointer" value={filterValue} onChange={(e) => setFilterValue(e.target.value)}>
              <option value="" disabled>Select a Nation...</option>
              {uniqueNations.map(nation => <option key={nation} value={nation}>{nation}</option>)}
            </select>
          )}
        </div>

        {filteredMatches.length === 0 ? (
          <div className="text-center p-16 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="text-6xl mb-4">⚽</div>
            <p className="text-gray-500 font-bold text-lg">
              {filterMode === 'my_votes' ? "You haven't voted on any matches yet!" : "No matches found."}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredMatches.map((match) => {
              const venueTz = getVenueTimeZone(match.venue_city);
              const matchDate = new Date(match.utc_start_time);
              const bgTime = formatInTimeZone(matchDate, 'Europe/Sofia', 'MMM do, HH:mm');
              const localTime = formatInTimeZone(matchDate, venueTz, 'HH:mm');
              const matchVotes = votes?.filter(v => v.match_id === match.id) || [];

              const homeFlag = getCountryCode(match.home_team);
              const awayFlag = getCountryCode(match.away_team);

              return (
                <div key={match.id} className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
                  <div>
                    <div className="flex justify-between items-center mb-6">
                      <span className="text-xs font-black text-white bg-gray-900 px-3 py-1 rounded-full uppercase tracking-wider">{match.group_name}</span>
                      <span className="text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full">Match {match.id}</span>
                    </div>
                    
                    <div className="flex items-center justify-between mb-8 px-2">
                      <div className="flex flex-col items-center flex-1">
                        {homeFlag ? (
                          <img src={`https://flagcdn.com/w80/${homeFlag}.png`} alt={match.home_team} className="w-14 h-10 object-cover rounded shadow-sm mb-3 group-hover:scale-110 transition-transform" />
                        ) : (
                          <div className="w-14 h-10 bg-gray-100 rounded shadow-sm mb-3 flex items-center justify-center text-gray-400 text-xs font-bold group-hover:scale-110 transition-transform">{match.home_team.substring(0,3).toUpperCase()}</div>
                        )}
                        <span className="font-bold text-gray-900 text-center leading-tight">{match.home_team}</span>
                      </div>
                      
                      <div className="text-sm font-black text-gray-300 px-4 italic">VS</div>
                      
                      <div className="flex flex-col items-center flex-1">
                        {awayFlag ? (
                          <img src={`https://flagcdn.com/w80/${awayFlag}.png`} alt={match.away_team} className="w-14 h-10 object-cover rounded shadow-sm mb-3 group-hover:scale-110 transition-transform" />
                        ) : (
                          <div className="w-14 h-10 bg-gray-100 rounded shadow-sm mb-3 flex items-center justify-center text-gray-400 text-xs font-bold group-hover:scale-110 transition-transform">{match.away_team.substring(0,3).toUpperCase()}</div>
                        )}
                        <span className="font-bold text-gray-900 text-center leading-tight">{match.away_team}</span>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 rounded-2xl p-4 text-xs font-medium text-gray-600 space-y-2 border border-gray-100">
                      <p className="flex items-center gap-2"><span className="text-base">📍</span> {match.venue_stadium}, {match.venue_city}</p>
                      <p className="flex items-center gap-2"><span className="text-base">🇧🇬</span> <strong className="text-gray-900">BG Time:</strong> {bgTime}</p>
                      <p className="flex items-center gap-2"><span className="text-base">🏟️</span> <strong className="text-gray-900">Local Time:</strong> {localTime}</p>
                    </div>
                  </div>
                  
                  <VoteButtons matchId={match.id} initialVotes={matchVotes} onVoteChange={fetchVotes} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* NEW: INSTRUCTIONS MODAL OVERLAY */}
      {showInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl relative">
            <button 
              onClick={() => setShowInstructions(false)} 
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 text-3xl font-light leading-none p-2"
            >
              &times;
            </button>
            
            <h2 className="text-2xl font-black mb-6 text-gray-900">How to coordinate! 🏆</h2>
            
            <div className="space-y-5 text-sm text-gray-600 font-medium">
              <div className="flex gap-4">
                <span className="text-2xl">👀</span>
                <p><strong className="text-gray-900 block mb-1">1. Vote to Watch</strong> Click this if you want to watch the match with friends, but you don't have a place to host it.</p>
              </div>
              
              <div className="flex gap-4">
                <span className="text-2xl">🏠</span>
                <p><strong className="text-gray-900 block mb-1">2. Host Game</strong> Click this if you have a TV, snacks, and you are officially offering up your place for people to come watch.</p>
              </div>
              
              <div className="flex gap-4">
                <span className="text-2xl">⚠️</span>
                <p><strong className="text-gray-900 block mb-1">3. Find the Gaps</strong> Use the <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-bold">Needs Host</span> tab to instantly find matches where people want to watch, but nobody has stepped up to host yet.</p>
              </div>

              <div className="flex gap-4">
                <span className="text-2xl">⚙️</span>
                <p><strong className="text-gray-900 block mb-1">4. Make it yours</strong> Click on your profile picture in the top right to change your Display Name or add a custom avatar link so your friends know it's you.</p>
              </div>
            </div>
            
            <button 
              onClick={() => setShowInstructions(false)} 
              className="mt-8 w-full bg-yellow-500 text-gray-900 font-bold py-3 rounded-xl hover:bg-yellow-400 transition-colors shadow-sm"
            >
              Let's Go!
            </button>
          </div>
        </div>
      )}
    </main>
  );
}