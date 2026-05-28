/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { formatInTimeZone } from 'date-fns-tz';
import Link from 'next/link';
import VoteButtons from '../components/VoteButtons';
import { Toaster, toast } from 'react-hot-toast';

type Match = { id: number; group_name: string; home_team: string; away_team: string; venue_city: string; venue_stadium: string; utc_start_time: string; };
type Vote = { match_id: number; intent: string; user_email: string; username?: string | null; avatar_url?: string | null; host_message?: string | null; rsvp_limit?: number | null; };
type Comment = { id: number; match_id: number; user_email: string; username: string; avatar_url: string; text: string; created_at: string; };

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
  return map[country.toLowerCase().trim()] || null;
};

const getVenueTimeZone = (city: string) => {
  const zones: Record<string, string> = {
    'Mexico City': 'America/Mexico_City', 'Guadalajara': 'America/Mexico_City', 'Monterrey': 'America/Monterrey', 'Los Angeles': 'America/Los_Angeles', 'San Francisco': 'America/Los_Angeles', 'Seattle': 'America/Los_Angeles', 'Vancouver': 'America/Vancouver', 'Houston': 'America/Chicago', 'Dallas': 'America/Chicago', 'Kansas City': 'America/Chicago', 'Atlanta': 'America/New_York', 'Miami': 'America/New_York', 'Boston': 'America/New_York', 'Philadelphia': 'America/New_York', 'New York/New Jersey': 'America/New_York', 'Toronto': 'America/Toronto',
  };
  return zones[city] || 'UTC';
};

const getMatchStatus = (utcDate: string) => {
  const now = new Date();
  const matchStart = new Date(utcDate);
  const diffMs = matchStart.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffMins <= 0 && diffMins > -120) return { text: '🔴 LIVE NOW', style: 'bg-red-600 text-white animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.7)]' };
  if (diffMins <= -120) return { text: 'Match Ended', style: 'bg-gray-200 text-gray-500' };
  if (diffMins > 0 && diffHrs < 1) return { text: `Starts in ${diffMins} mins!`, style: 'bg-orange-500 text-white' };
  if (diffHrs >= 1 && diffHrs < 24) return { text: `Starts in ${diffHrs} hrs`, style: 'bg-blue-600 text-white' };
  return { text: `Starts in ${diffDays} days`, style: 'bg-gray-100 text-gray-700 border border-gray-200' };
};

// FIXED: Defined the exact types allowed for the filter mode
type FilterMode = 'all' | 'group' | 'nation' | 'needs_host' | 'my_votes' | 'any_votes';

export default function Home() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]); 
  const [comments, setComments] = useState<Comment[]>([]);
  const [user, setUser] = useState<any>(null);
  
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [filterValue, setFilterValue] = useState<string>('');

  const [showInstructions, setShowInstructions] = useState(false);
  const [chatMatch, setChatMatch] = useState<Match | null>(null);
  const [newComment, setNewComment] = useState("");
  const [, setCurrentTime] = useState(new Date());

  const fetchData = useCallback(async () => {
    const { data: voteData } = await supabase.from('votes').select('*');
    if (voteData) setVotes(voteData as Vote[]);
    const { data: commentData } = await supabase.from('comments').select('*').order('created_at', { ascending: true });
    if (commentData) setComments(commentData as Comment[]);
  }, []);

  useEffect(() => {
    const loadInitial = async () => {
      const { data: matchData } = await supabase.from('matches').select('*').order('utc_start_time', { ascending: true });
      if (matchData) setMatches(matchData as Match[]);
      await fetchData();
      const { data: userData } = await supabase.auth.getUser();
      setUser(userData.user);
    };
    loadInitial();

    // FIXED: Changed 'postgres' to 'postgres_changes' to match Supabase v2!
    const channel = supabase.channel('realtime:public')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => fetchData())
      .subscribe();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => setUser(session?.user || null));
    
    const timeInterval = setInterval(() => setCurrentTime(new Date()), 60000);

    return () => {
      supabase.removeChannel(channel);
      authListener.subscription?.unsubscribe();
      clearInterval(timeInterval);
    };
  }, [fetchData]);

  const topHosts = useMemo(() => {
    const hosts = votes.filter(v => v.intent === 'host');
    const counts: Record<string, { username: string, avatar: string, count: number }> = {};
    hosts.forEach(v => {
      if (!counts[v.user_email]) counts[v.user_email] = { username: v.username || 'Fan', avatar: v.avatar_url || '', count: 0 };
      counts[v.user_email].count += 1;
    });
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [votes]);

  const uniqueGroups = useMemo(() => Array.from(new Set(matches.map(m => m.group_name))).filter(Boolean).sort(), [matches]);
  const uniqueNations = useMemo(() => Array.from(new Set(matches.flatMap(m => [m.home_team, m.away_team]))).filter(Boolean).sort(), [matches]);

  const filteredMatches = useMemo(() => {
    if (!matches) return [];
    let result = matches;
    if (filterMode === 'group' && filterValue) result = matches.filter(m => m.group_name === filterValue);
    else if (filterMode === 'nation' && filterValue) result = matches.filter(m => m.home_team === filterValue || m.away_team === filterValue);
    else if (filterMode === 'needs_host') result = matches.filter(m => votes.some(v => v.match_id === m.id && v.intent === 'watch') && !votes.some(v => v.match_id === m.id && v.intent === 'host'));
    else if (filterMode === 'my_votes' && user) result = matches.filter(m => votes.some(v => v.match_id === m.id && v.user_email === user.email));
    else if (filterMode === 'any_votes') result = matches.filter(m => votes.some(v => v.match_id === m.id));
    return result.sort((a, b) => new Date(a.utc_start_time).getTime() - new Date(b.utc_start_time).getTime());
  }, [matches, votes, filterMode, filterValue, user]);

  // FIXED: Mode typing is now exact instead of 'any'
  const handleModeChange = (mode: FilterMode) => { setFilterMode(mode); setFilterValue(''); };

  const generateCalendarLink = (match: Match) => {
    const start = new Date(match.utc_start_time).toISOString().replace(/-|:|\.\d\d\d/g, '');
    const end = new Date(new Date(match.utc_start_time).getTime() + 2 * 60 * 60 * 1000).toISOString().replace(/-|:|\.\d\d\d/g, '');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`⚽ ${match.home_team} vs ${match.away_team}`)}&dates=${start}/${end}&details=${encodeURIComponent('Coordinate on World Cup Planner!')}&location=${encodeURIComponent(`${match.venue_stadium}, ${match.venue_city}`)}`;
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || !user || !chatMatch) return;
    const newDoc = {
      match_id: chatMatch.id, user_email: user.email, 
      username: user.user_metadata?.username || user.user_metadata?.full_name || 'Fan',
      avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || '', text: newComment.trim()
    };
    await supabase.from('comments').insert(newDoc);
    setNewComment(""); 
  };

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const displayName = user?.user_metadata?.username || user?.user_metadata?.full_name || 'My Profile';

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <Toaster position="bottom-center" />
      
      <div className="relative bg-gray-900 text-white shadow-2xl mb-10">
        <img src="https://images.unsplash.com/photo-1518605368461-1ee7e1617ff5?q=80&w=2000&auto=format&fit=crop" alt="Stadium" className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent"></div>
        <div className="relative max-w-6xl mx-auto px-6 py-12 sm:py-20 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl sm:text-6xl font-extrabold mb-3 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 via-yellow-100 to-white">World Cup 2026</h1>
            <p className="text-gray-300 text-lg max-w-md font-medium">Plan your watch parties, find hosts, and coordinate the snacks.</p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <button onClick={() => setShowInstructions(true)} className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-5 py-3 rounded-full border border-white/20 text-white font-bold hover:bg-white/20 hover:scale-105 transition-all shadow-lg"><span>📖</span> How to Use</button>
            {user ? (
              <Link href="/profile" className="flex items-center gap-3 hover:scale-105 transition-transform bg-white/10 backdrop-blur-md p-2 pr-5 rounded-full border border-white/20 shadow-lg">
                {avatarUrl ? <img src={avatarUrl} alt="Profile" className="w-12 h-12 rounded-full object-cover border-2 border-yellow-400" /> : <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center text-gray-900 font-bold text-xl uppercase">{displayName[0]}</div>}
                <span className="font-semibold text-white drop-shadow-sm">{displayName}</span>
              </Link>
            ) : (
              <Link href="/login" className="bg-yellow-500 text-gray-900 px-8 py-3 rounded-full font-bold hover:bg-yellow-400 hover:scale-105 transition-all shadow-[0_0_20px_rgba(234,179,8,0.4)]">Login / Sign Up</Link>
            )}
          </div>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto px-6">
        
        {topHosts.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 mb-8 p-6 flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-shrink-0 text-center sm:text-left"><h2 className="text-xl font-black text-gray-900">🏆 MVP Hosts</h2><p className="text-xs text-gray-500 font-bold uppercase mt-1">Carrying the friend group</p></div>
            <div className="flex flex-wrap justify-center sm:justify-start gap-4 flex-1">
              {topHosts.map((host, idx) => (
                <div key={host.username} className="flex flex-col items-center group cursor-pointer relative">
                  <div className="absolute -top-3 -right-2 bg-yellow-400 text-gray-900 text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full z-10 border-2 border-white shadow-sm">{idx + 1}</div>
                  {host.avatar ? <img src={host.avatar} alt={host.username} className="w-12 h-12 rounded-full border-2 border-gray-100 object-cover group-hover:border-yellow-400 transition-colors" /> : <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center border-2 border-gray-100 uppercase group-hover:border-yellow-400 transition-colors">{host.username[0]}</div>}
                  <span className="text-xs font-bold text-gray-700 mt-1 max-w-[60px] truncate">{host.username}</span>
                  <span className="text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full mt-1">{host.count} Matches</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-200 mb-8 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-1 w-full lg:w-auto">
            <button onClick={() => handleModeChange('all')} className={`flex-1 lg:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${filterMode === 'all' ? 'bg-gray-900 shadow-md text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>All Matches</button>
            <button onClick={() => handleModeChange('group')} className={`flex-1 lg:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${filterMode === 'group' ? 'bg-gray-900 shadow-md text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>By Group</button>
            <button onClick={() => handleModeChange('nation')} className={`flex-1 lg:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${filterMode === 'nation' ? 'bg-gray-900 shadow-md text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>By Nation</button>
            <button onClick={() => handleModeChange('any_votes')} className={`flex-1 lg:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${filterMode === 'any_votes' ? 'bg-purple-100 shadow-sm text-purple-700' : 'text-gray-500 hover:bg-purple-50 hover:text-purple-600'}`}>🔥 Voted</button>
            <button onClick={() => handleModeChange('needs_host')} className={`flex-1 lg:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${filterMode === 'needs_host' ? 'bg-orange-100 shadow-sm text-orange-700' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600'}`}>⚠️ Needs Host</button>
            {user && <button onClick={() => handleModeChange('my_votes')} className={`flex-1 lg:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${filterMode === 'my_votes' ? 'bg-green-100 shadow-sm text-green-700' : 'text-gray-500 hover:bg-green-50 hover:text-green-600'}`}>✅ My Votes</button>}
          </div>

          {filterMode === 'group' && <select className="w-full lg:w-64 p-3 border-none bg-gray-50 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-sm font-bold text-gray-900 cursor-pointer" value={filterValue} onChange={(e) => setFilterValue(e.target.value)}><option value="" disabled>Select a Group...</option>{uniqueGroups.map(group => <option key={group} value={group}>{group}</option>)}</select>}
          {filterMode === 'nation' && <select className="w-full lg:w-64 p-3 border-none bg-gray-50 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-sm font-bold text-gray-900 cursor-pointer" value={filterValue} onChange={(e) => setFilterValue(e.target.value)}><option value="" disabled>Select a Nation...</option>{uniqueNations.map(nation => <option key={nation} value={nation}>{nation}</option>)}</select>}
        </div>

        {filteredMatches.length === 0 ? (
          <div className="text-center p-16 bg-white rounded-3xl border border-gray-100 shadow-sm"><div className="text-6xl mb-4">⚽</div><p className="text-gray-500 font-bold text-lg">{filterMode === 'my_votes' ? "You haven't voted on any matches yet!" : "No matches found."}</p></div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredMatches.map((match) => {
              const venueTz = getVenueTimeZone(match.venue_city);
              const matchDate = new Date(match.utc_start_time);
              const bgTime = formatInTimeZone(matchDate, 'Europe/Sofia', 'MMM do, HH:mm');
              const localTime = formatInTimeZone(matchDate, venueTz, 'HH:mm');
              const matchVotes = votes?.filter(v => v.match_id === match.id) || [];
              const matchComments = comments?.filter(c => c.match_id === match.id) || [];
              const homeFlag = getCountryCode(match.home_team);
              const awayFlag = getCountryCode(match.away_team);
              
              const status = getMatchStatus(match.utc_start_time);

              return (
                <div key={match.id} className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
                  <div>
                    <div className="flex justify-between items-center mb-6">
                      <span className="text-xs font-black text-white bg-gray-900 px-3 py-1 rounded-full uppercase tracking-wider">{match.group_name}</span>
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${status.style}`}>
                        {status.text}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between mb-8 px-2">
                      <div className="flex flex-col items-center flex-1">
                        {homeFlag ? <img src={`https://flagcdn.com/w80/${homeFlag}.png`} alt={match.home_team} className="w-14 h-10 object-cover rounded shadow-sm mb-3 group-hover:scale-110 transition-transform" /> : <div className="w-14 h-10 bg-gray-100 rounded shadow-sm mb-3 flex items-center justify-center text-gray-400 text-xs font-bold group-hover:scale-110 transition-transform">{match.home_team.substring(0,3).toUpperCase()}</div>}
                        <span className="font-bold text-gray-900 text-center leading-tight">{match.home_team}</span>
                      </div>
                      <div className="text-sm font-black text-gray-300 px-4 italic">VS</div>
                      <div className="flex flex-col items-center flex-1">
                        {awayFlag ? <img src={`https://flagcdn.com/w80/${awayFlag}.png`} alt={match.away_team} className="w-14 h-10 object-cover rounded shadow-sm mb-3 group-hover:scale-110 transition-transform" /> : <div className="w-14 h-10 bg-gray-100 rounded shadow-sm mb-3 flex items-center justify-center text-gray-400 text-xs font-bold group-hover:scale-110 transition-transform">{match.away_team.substring(0,3).toUpperCase()}</div>}
                        <span className="font-bold text-gray-900 text-center leading-tight">{match.away_team}</span>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 rounded-2xl p-4 text-xs font-medium text-gray-600 space-y-2 border border-gray-100 mb-4">
                      <p className="flex items-center gap-2"><span className="text-base">📍</span> {match.venue_stadium}, {match.venue_city}</p>
                      <p className="flex items-center gap-2"><span className="text-base">⏰</span> <strong className="text-gray-900">BG Time:</strong> {bgTime}</p>
                      <p className="flex items-center gap-2"><span className="text-base">🏟️</span> <strong className="text-gray-900">Local Time:</strong> {localTime}</p>
                    </div>

                    <button onClick={() => setChatMatch(match)} className="w-full bg-blue-50 text-blue-700 py-2 rounded-xl text-sm font-bold hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 mb-2 border border-blue-100">
                      💬 Coordination Board <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full">{matchComments.length}</span>
                    </button>
                  </div>
                  
                 <VoteButtons 
  matchId={match.id} 
  votes={matchVotes} 
  currentUserEmail={user?.email} 
  onVoteChange={fetchData} 
/>

                  <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                    <a href={generateCalendarLink(match)} target="_blank" rel="noreferrer" className="flex-1 bg-gray-50 text-gray-600 py-2 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors flex items-center justify-center gap-2">📅 Add to Cal</a>
                    <button onClick={() => { navigator.clipboard.writeText(`⚽ Who is hosting ${match.home_team} vs ${match.away_team}? Check the World Cup Planner!`); toast.success("Link copied!"); }} className="flex-1 bg-gray-50 text-gray-600 py-2 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors flex items-center justify-center gap-2">📤 Share</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {chatMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl relative flex flex-col max-h-[80vh]">
            <button onClick={() => setChatMatch(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 text-3xl font-light leading-none p-2 z-10">&times;</button>
            <div className="mb-4 pb-4 border-b border-gray-100"><h2 className="text-xl font-black text-gray-900 flex items-center gap-2">💬 {chatMatch.home_team} vs {chatMatch.away_team}</h2><p className="text-xs text-gray-500 font-bold mt-1">Coordinate snacks, drinks, and arrival times!</p></div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 min-h-[250px] mb-4">
              {comments.filter(c => c.match_id === chatMatch.id).length === 0 ? <div className="text-center text-gray-400 text-sm italic mt-10">No messages yet. Be the first to coordinate!</div> : comments.filter(c => c.match_id === chatMatch.id).map(c => (
                <div key={c.id} className="flex gap-3">
                  {c.avatar_url ? <img src={c.avatar_url} alt="avatar" className="w-8 h-8 rounded-full object-cover" /> : <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold uppercase">{c.username[0]}</div>}
                  <div className="bg-gray-50 p-3 rounded-2xl rounded-tl-none border border-gray-100 flex-1 text-sm text-gray-700"><strong className="text-gray-900 block text-xs mb-1">{c.username}</strong>{c.text}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" placeholder={user ? "Type a message..." : "Log in to post a message..."} className="flex-1 p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm disabled:bg-gray-50" value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handlePostComment()} disabled={!user} />
              <button onClick={handlePostComment} disabled={!user || !newComment.trim()} className="bg-blue-600 text-white px-5 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50">Send</button>
            </div>
          </div>
        </div>
      )}

      {showInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl relative">
            <button onClick={() => setShowInstructions(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 text-3xl font-light leading-none p-2">&times;</button>
            <h2 className="text-2xl font-black mb-6 text-gray-900">How to coordinate! 🏆</h2>
            <div className="space-y-5 text-sm text-gray-600 font-medium">
              <div className="flex gap-4"><span className="text-2xl">👀</span><p><strong className="text-gray-900 block mb-1">1. Vote to Watch</strong> Click this if you want to watch the match with friends.</p></div>
              <div className="flex gap-4"><span className="text-2xl">🏠</span><p><strong className="text-gray-900 block mb-1">2. Host Game</strong> Offer up your place. Set an RSVP limit and add a note!</p></div>
              <div className="flex gap-4"><span className="text-2xl">⚠️</span><p><strong className="text-gray-900 block mb-1">3. Find the Gaps</strong> Use the "Needs Host" tab to find matches without a venue.</p></div>
              <div className="flex gap-4"><span className="text-2xl">💬</span><p><strong className="text-gray-900 block mb-1">4. Coordinate</strong> Open the Chat Board on any match to talk logistics in real-time!</p></div>
            </div>
            <button onClick={() => setShowInstructions(false)} className="mt-8 w-full bg-yellow-500 text-gray-900 font-bold py-3 rounded-xl hover:bg-yellow-400">Let's Go!</button>
          </div>
        </div>
      )}
    </main>
  );
}