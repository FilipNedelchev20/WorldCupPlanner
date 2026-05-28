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
type Potluck = { id: number; match_id: number; item: string; claimed_by_email: string | null; claimed_by_name: string | null; };
type Prediction = { id: number; match_id: number; user_email: string; username: string; home_score: number; away_score: number; };

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
  const zones: Record<string, string> = { 'Mexico City': 'America/Mexico_City', 'Guadalajara': 'America/Mexico_City', 'Monterrey': 'America/Monterrey', 'Los Angeles': 'America/Los_Angeles', 'San Francisco': 'America/Los_Angeles', 'Seattle': 'America/Los_Angeles', 'Vancouver': 'America/Vancouver', 'Houston': 'America/Chicago', 'Dallas': 'America/Chicago', 'Kansas City': 'America/Chicago', 'Atlanta': 'America/New_York', 'Miami': 'America/New_York', 'Boston': 'America/New_York', 'Philadelphia': 'America/New_York', 'New York/New Jersey': 'America/New_York', 'Toronto': 'America/Toronto' };
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

type FilterMode = 'all' | 'group' | 'nation' | 'needs_host' | 'my_votes' | 'any_votes';

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]); 
  const [comments, setComments] = useState<Comment[]>([]);
  const [potluckItems, setPotluckItems] = useState<Potluck[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [user, setUser] = useState<any>(null);
  
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [filterValue, setFilterValue] = useState<string>('');

  const [showInstructions, setShowInstructions] = useState(false);
  const [chatMatch, setChatMatch] = useState<Match | null>(null);
  const [newComment, setNewComment] = useState("");
  const [newItemName, setNewItemName] = useState("");
  
  // Local state for score inputs before saving
  const [scoreInputs, setScoreInputs] = useState<Record<number, { home: string, away: string }>>({});

  const fetchData = useCallback(async () => {
    const [{ data: vData }, { data: cData }, { data: pData }, { data: prData }] = await Promise.all([
      supabase.from('votes').select('*'),
      supabase.from('comments').select('*').order('created_at', { ascending: true }),
      supabase.from('potluck').select('*').order('created_at', { ascending: true }),
      supabase.from('predictions').select('*')
    ]);
    if (vData) setVotes(vData as Vote[]);
    if (cData) setComments(cData as Comment[]);
    if (pData) setPotluckItems(pData as Potluck[]);
    if (prData) setPredictions(prData as Prediction[]);
  }, []);

  useEffect(() => {
    setIsMounted(true);
    const loadInitial = async () => {
      const { data: matchData } = await supabase.from('matches').select('*').order('utc_start_time', { ascending: true });
      if (matchData) setMatches(matchData as Match[]);
      await fetchData();
      const { data: userData } = await supabase.auth.getUser();
      setUser(userData.user);
    };
    loadInitial();

    const channel = supabase.channel('realtime:public')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'potluck' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, fetchData)
      .subscribe();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => setUser(session?.user || null));
    return () => { supabase.removeChannel(channel); authListener.subscription?.unsubscribe(); };
  }, [fetchData]);

  // LEADERBOARDS
  const topHosts = useMemo(() => {
    const hosts = votes.filter(v => v.intent === 'host');
    const counts: Record<string, { email: string, username: string, count: number }> = {};
    hosts.forEach(v => {
      if (!counts[v.user_email]) counts[v.user_email] = { email: v.user_email, username: v.username || 'Fan', count: 0 };
      counts[v.user_email].count += 1;
    });
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 3);
  }, [votes]);

  const topOracles = useMemo(() => {
    const counts: Record<string, { email: string, username: string, count: number }> = {};
    predictions.forEach(p => {
      if (!counts[p.user_email]) counts[p.user_email] = { email: p.user_email, username: p.username || 'Fan', count: 0 };
      counts[p.user_email].count += 1;
    });
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 3);
  }, [predictions]);

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

  const handleModeChange = (mode: FilterMode) => { setFilterMode(mode); setFilterValue(''); };

  // POTLUCK LOGIC
  const handleAddPotluckItem = async () => {
    if (!newItemName.trim() || !chatMatch) return;
    await supabase.from('potluck').insert({ match_id: chatMatch.id, item: newItemName.trim() });
    setNewItemName("");
  };

  const handleClaimPotluck = async (itemId: number) => {
    if (!user) return toast.error("Log in to claim items!");
    await supabase.from('potluck').update({ 
      claimed_by_email: user.email, 
      claimed_by_name: user.user_metadata?.username || user.user_metadata?.full_name || 'Fan' 
    }).match({ id: itemId });
  };

  const handleUnclaimPotluck = async (itemId: number) => {
    await supabase.from('potluck').update({ claimed_by_email: null, claimed_by_name: null }).match({ id: itemId });
  };

  // PREDICTION LOGIC
  const submitPrediction = async (matchId: number) => {
    if (!user) return toast.error("Log in to predict!");
    const home = parseInt(scoreInputs[matchId]?.home);
    const away = parseInt(scoreInputs[matchId]?.away);
    if (isNaN(home) || isNaN(away)) return toast.error("Enter valid numbers!");

    const username = user.user_metadata?.username || user.user_metadata?.full_name || 'Fan';
    const { error } = await supabase.from('predictions').upsert({
      match_id: matchId, user_email: user.email, username, home_score: home, away_score: away
    }, { onConflict: 'match_id, user_email' }); 
    
    if (error) toast.error("Prediction failed!");
    else toast.success("Prediction locked in! 🔮");
  };

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const displayName = user?.user_metadata?.username || user?.user_metadata?.full_name || 'My Profile';
  const uniqueGroups = Array.from(new Set(matches.map(m => m.group_name))).filter(Boolean).sort();
  const uniqueNations = Array.from(new Set(matches.flatMap(m => [m.home_team, m.away_team]))).filter(Boolean).sort();

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <Toaster position="bottom-center" />
      
      {/* HERO BANNER */}
      <div className="relative bg-gray-900 text-white shadow-2xl mb-10">
        <img src="https://images.unsplash.com/photo-1518605368461-1ee7e1617ff5?q=80&w=2000&auto=format&fit=crop" alt="Stadium" className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent"></div>
        <div className="relative max-w-6xl mx-auto px-6 py-12 sm:py-20 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl sm:text-6xl font-extrabold mb-3 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 via-yellow-100 to-white">World Cup 2026</h1>
            <p className="text-gray-300 text-lg max-w-md font-medium">Coordinate watch parties. Predict the scores. Bring the snacks.</p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <button onClick={() => setShowInstructions(true)} className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-5 py-3 rounded-full border border-white/20 text-white font-bold hover:bg-white/20 transition-all shadow-lg"><span>📖</span> How to Use</button>
            {user ? (
              <Link href="/profile" className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-2 pr-5 rounded-full border border-white/20 shadow-lg hover:bg-white/20 transition-all">
                {avatarUrl ? <img src={avatarUrl} alt="Profile" className="w-10 h-10 rounded-full object-cover border-2 border-yellow-400" /> : <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center text-gray-900 font-bold uppercase">{displayName[0]}</div>}
                <span className="font-semibold text-white">{displayName}</span>
              </Link>
            ) : (
              <Link href="/login" className="bg-yellow-500 text-gray-900 px-8 py-3 rounded-full font-bold hover:bg-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.4)] transition-all">Login / Sign Up</Link>
            )}
          </div>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto px-6">
        
        {/* LEADERBOARDS (Side by Side) */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {topHosts.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex items-center gap-4">
              <div className="text-4xl">🏆</div>
              <div className="flex-1">
                <h2 className="text-lg font-black text-gray-900 leading-tight">MVP Hosts</h2>
                <p className="text-xs text-gray-500 font-bold uppercase mb-2">Carrying the squad</p>
                <div className="flex gap-2 text-sm font-bold text-gray-700">
                  {topHosts.map((h, i) => <span key={h.email}>{i+1}. {h.username} <span className="text-green-600">({h.count})</span></span>)}
                </div>
              </div>
            </div>
          )}
          {topOracles.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex items-center gap-4">
              <div className="text-4xl">🔮</div>
              <div className="flex-1">
                <h2 className="text-lg font-black text-gray-900 leading-tight">Top Oracles</h2>
                <p className="text-xs text-gray-500 font-bold uppercase mb-2">Most Predictions Made</p>
                <div className="flex gap-2 text-sm font-bold text-gray-700">
                  {topOracles.map((o, i) => <span key={o.email}>{i+1}. {o.username} <span className="text-purple-600">({o.count})</span></span>)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FILTERS */}
        <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-200 mb-8 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-1 w-full lg:w-auto">
            <button onClick={() => handleModeChange('all')} className={`flex-1 lg:flex-none px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterMode === 'all' ? 'bg-gray-900 shadow-md text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>All Matches</button>
            <button onClick={() => handleModeChange('group')} className={`flex-1 lg:flex-none px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterMode === 'group' ? 'bg-gray-900 shadow-md text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>By Group</button>
            <button onClick={() => handleModeChange('nation')} className={`flex-1 lg:flex-none px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterMode === 'nation' ? 'bg-gray-900 shadow-md text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>By Nation</button>
            <button onClick={() => handleModeChange('any_votes')} className={`flex-1 lg:flex-none px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterMode === 'any_votes' ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-100'}`}>🔥 Voted</button>
            <button onClick={() => handleModeChange('needs_host')} className={`flex-1 lg:flex-none px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterMode === 'needs_host' ? 'bg-orange-100 text-orange-700' : 'text-gray-500 hover:bg-gray-100'}`}>⚠️ Needs Host</button>
          </div>
          {filterMode === 'group' && <select className="p-2 border-none bg-gray-50 rounded-xl focus:ring-2 outline-none text-sm font-bold" value={filterValue} onChange={(e) => setFilterValue(e.target.value)}><option value="" disabled>Select Group...</option>{uniqueGroups.map(g => <option key={g} value={g}>{g}</option>)}</select>}
          {filterMode === 'nation' && <select className="p-2 border-none bg-gray-50 rounded-xl focus:ring-2 outline-none text-sm font-bold" value={filterValue} onChange={(e) => setFilterValue(e.target.value)}><option value="" disabled>Select Nation...</option>{uniqueNations.map(n => <option key={n} value={n}>{n}</option>)}</select>}
        </div>

        {/* MATCH CARDS */}
        {!isMounted ? (
          <div className="text-center p-16 font-bold text-gray-500">Loading matches...</div>
        ) : filteredMatches.length === 0 ? (
          <div className="text-center p-16 bg-white rounded-3xl border border-gray-100"><div className="text-6xl mb-4">⚽</div><p className="text-gray-500 font-bold">No matches found.</p></div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredMatches.map((match) => {
              const venueTz = getVenueTimeZone(match.venue_city);
              const matchDate = new Date(match.utc_start_time);
              const status = getMatchStatus(match.utc_start_time);
              const matchVotes = votes?.filter(v => v.match_id === match.id) || [];
              const matchComments = comments?.filter(c => c.match_id === match.id) || [];
              const matchPredictions = predictions.filter(p => p.match_id === match.id);
              const userPrediction = user ? matchPredictions.find(p => p.user_email === user.email) : null;

              return (
                <div key={match.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-6">
                      <span className="text-xs font-black text-white bg-gray-900 px-3 py-1 rounded-full uppercase">{match.group_name}</span>
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${status.style}`}>{status.text}</span>
                    </div>
                    
                    <div className="flex items-center justify-between mb-4 px-2">
                      <div className="flex flex-col items-center flex-1">
                        {getCountryCode(match.home_team) ? <img src={`https://flagcdn.com/w80/${getCountryCode(match.home_team)}.png`} alt="" className="w-12 h-8 object-cover rounded shadow-sm mb-2" /> : <div className="w-12 h-8 bg-gray-100 rounded mb-2"></div>}
                        <span className="font-bold text-gray-900 text-center text-sm">{match.home_team}</span>
                      </div>
                      <div className="text-xs font-black text-gray-300 px-2">VS</div>
                      <div className="flex flex-col items-center flex-1">
                        {getCountryCode(match.away_team) ? <img src={`https://flagcdn.com/w80/${getCountryCode(match.away_team)}.png`} alt="" className="w-12 h-8 object-cover rounded shadow-sm mb-2" /> : <div className="w-12 h-8 bg-gray-100 rounded mb-2"></div>}
                        <span className="font-bold text-gray-900 text-center text-sm">{match.away_team}</span>
                      </div>
                    </div>

                    <div className="bg-purple-50 p-3 rounded-2xl border border-purple-100 mb-4 flex flex-col items-center justify-center">
                      <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wide mb-2">🔮 Predict Score</span>
                      {userPrediction ? (
                         <div className="font-black text-lg text-gray-900">{userPrediction.home_score} - {userPrediction.away_score} <span className="text-xs text-purple-600 ml-2">Locked in!</span></div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input type="number" className="w-12 p-1 text-center font-bold border rounded outline-none" placeholder="0" value={scoreInputs[match.id]?.home || ''} onChange={e => setScoreInputs(prev => ({...prev, [match.id]: {...prev[match.id], home: e.target.value}}))} />
                          <span className="font-bold text-gray-400">-</span>
                          <input type="number" className="w-12 p-1 text-center font-bold border rounded outline-none" placeholder="0" value={scoreInputs[match.id]?.away || ''} onChange={e => setScoreInputs(prev => ({...prev, [match.id]: {...prev[match.id], away: e.target.value}}))} />
                          <button onClick={() => submitPrediction(match.id)} className="bg-purple-600 text-white text-xs font-bold px-3 py-1.5 rounded ml-2 hover:bg-purple-700">Save</button>
                        </div>
                      )}
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-3 text-xs font-medium text-gray-600 space-y-1 border border-gray-100 mb-4">
                      <p>📍 {match.venue_stadium}</p>
                      <p>🇧🇬 <strong>BG Time:</strong> {formatInTimeZone(matchDate, 'Europe/Sofia', 'MMM do, HH:mm')}</p>
                    </div>

                    <button onClick={() => setChatMatch(match)} className="w-full bg-blue-50 text-blue-700 py-2 rounded-xl text-sm font-bold hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 mb-2 border border-blue-100">
                      💬 Potluck & Chat <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full">{matchComments.length}</span>
                    </button>
                  </div>
                  
                  <VoteButtons matchId={match.id} initialVotes={matchVotes} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CHAT & POTLUCK MODAL OVERLAY */}
      {chatMatch && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl relative flex flex-col max-h-[90vh]">
            <button onClick={() => setChatMatch(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 text-3xl font-light leading-none p-2 z-10">&times;</button>
            
            <div className="mb-4 pb-4 border-b border-gray-100">
              <h2 className="text-xl font-black text-gray-900">💬 Coordination Board</h2>
              <p className="text-xs text-gray-500 font-bold">{chatMatch.home_team} vs {chatMatch.away_team}</p>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-6">
              
              <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
                <h3 className="font-black text-orange-800 text-sm mb-3">🍕 Bring Your Own (Potluck)</h3>
                <div className="space-y-2 mb-3">
                  {potluckItems.filter(p => p.match_id === chatMatch.id).length === 0 && <p className="text-xs text-orange-600/60 italic">No items needed yet. Add something!</p>}
                  {potluckItems.filter(p => p.match_id === chatMatch.id).map(item => (
                    <div key={item.id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-orange-100 text-sm">
                      <span className="font-bold text-gray-800">{item.item}</span>
                      {item.claimed_by_email ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-bold">Claimed by {item.claimed_by_name}</span>
                          {user?.email === item.claimed_by_email && <button onClick={() => handleUnclaimPotluck(item.id)} className="text-xs text-red-500 hover:underline">Drop</button>}
                        </div>
                      ) : (
                        <button onClick={() => handleClaimPotluck(item.id)} className="text-xs bg-orange-600 text-white px-3 py-1 rounded font-bold hover:bg-orange-700">I'll Bring This</button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder="e.g. 2 Bags of Chips" className="flex-1 text-sm p-2 rounded-lg border border-orange-200 outline-none focus:border-orange-500" value={newItemName} onChange={e => setNewItemName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddPotluckItem()} />
                  <button onClick={handleAddPotluckItem} className="bg-orange-800 text-white text-xs font-bold px-3 rounded-lg hover:bg-orange-900">Add Need</button>
                </div>
              </div>

              {/* COMMENTS */}
              <div className="space-y-4">
                <h3 className="font-black text-gray-800 text-sm">Chat</h3>
                {comments.filter(c => c.match_id === chatMatch.id).length === 0 ? <div className="text-gray-400 text-sm italic">No messages yet.</div> : comments.filter(c => c.match_id === chatMatch.id).map(c => (
                  <div key={c.id} className="flex gap-3">
                    {c.avatar_url ? <img src={c.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" /> : <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold uppercase">{c.username[0]}</div>}
                    <div className="bg-gray-50 p-3 rounded-2xl rounded-tl-none border border-gray-100 flex-1 text-sm text-gray-700"><strong className="text-gray-900 block text-xs mb-1">{c.username}</strong>{c.text}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
              <input 
                type="text" 
                placeholder="Type a message..." 
                className="flex-1 p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm" 
                value={newComment} 
                onChange={e => setNewComment(e.target.value)} 
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    if (!newComment.trim() || !user) return; 
                    await supabase.from('comments').insert({ 
                      match_id: chatMatch.id, 
                      user_email: user.email, 
                      username: user.user_metadata?.username || user.user_metadata?.full_name || 'Fan', 
                      avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || '', 
                      text: newComment.trim() 
                    }); 
                    setNewComment("");
                  }
                }} 
                disabled={!user} 
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}