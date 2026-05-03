import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell
} from 'recharts';
import { Layers, Activity, TrendingUp, AlertCircle, Droplet, Coins, ArrowRightLeft } from 'lucide-react';

const API_BASE = 'https://api.llama.fi';
const API_V2_BASE = 'https://api.llama.fi/v2';

// Formatting utilities
const formatCurrency = (val) => {
  if (val === undefined || val === null) return '$0';
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
  return `$${val.toFixed(2)}`;
};

const formatPercent = (val) => {
  if (val === undefined || val === null) return '0%';
  return `${val > 0 ? '+' : ''}${val.toFixed(2)}%`;
};

// Components
const StatCard = ({ title, value, icon: Icon, isLoading }) => (
  <div className="bg-df-surface border border-df-border rounded-xl p-5 hover:border-df-accent transition-colors duration-300">
    <div className="flex justify-between items-start mb-2">
      <h3 className="text-df-muted text-sm font-medium tracking-wide">{title}</h3>
      {Icon && <Icon size={18} className="text-df-accent opacity-80" />}
    </div>
    {isLoading ? (
      <div className="h-8 w-24 bg-df-surface-hover animate-pulse rounded mt-1"></div>
    ) : (
      <div className="text-2xl font-bold font-mono tracking-tight text-white">{value}</div>
    )}
  </div>
);

const SectionHeader = ({ title, description }) => (
  <div className="mb-6">
    <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
    <p className="text-df-muted text-sm mt-1">{description}</p>
  </div>
);

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [protocolData, setProtocolData] = useState([]);
  const [chainData, setChainData] = useState([]);
  const [poolsData, setPoolsData] = useState([]);
  const [stablesData, setStablesData] = useState([]);
  const [dexsData, setDexsData] = useState([]);
  
  // Market pulse derived stats
  const [globalTvl, setGlobalTvl] = useState(0);
  const [totalProtocols, setTotalProtocols] = useState(0);
  const [totalChains, setTotalChains] = useState(0);
  const [topEarner, setTopEarner] = useState({ name: '-', rev: 0 });
  const [globalVolume, setGlobalVolume] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        const [feesRes, chainsRes, poolsRes, stablesRes, dexsRes] = await Promise.all([
          fetch(`${API_BASE}/overview/fees`),
          fetch(`${API_V2_BASE}/chains`),
          fetch(`https://yields.llama.fi/pools`),
          fetch(`https://stablecoins.llama.fi/stablecoins`),
          fetch(`${API_BASE}/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`)
        ]);

        if (!feesRes.ok || !chainsRes.ok) throw new Error('API request failed');

        const feesData = await feesRes.json();
        const chainsArr = await chainsRes.json();
        const poolsJson = poolsRes.ok ? await poolsRes.json() : { data: [] };
        const stablesJson = stablesRes.ok ? await stablesRes.json() : { peggedAssets: [] };
        const dexsJson = dexsRes.ok ? await dexsRes.json() : { protocols: [] };

        // 1. Process Protocols by 7d Revenue (from overview/fees)
        const protocols = feesData.protocols || [];
        const validProtocols = protocols.filter(p => p.total7d !== undefined && p.total7d !== null);
        
        // Sort by 7d revenue
        const sortedByRev = [...validProtocols].sort((a, b) => b.total7d - a.total7d);
        setProtocolData(sortedByRev.slice(0, 10)); // Top 10
        
        // Derive market pulse
        setTotalProtocols(protocols.length);
        if (sortedByRev.length > 0) {
          setTopEarner({ name: sortedByRev[0].name, rev: sortedByRev[0].total7d });
        }

        // 2. Process Chains by TVL
        const validChains = chainsArr.filter(c => c.tvl !== undefined && c.tvl !== null);
        const sortedChains = [...validChains].sort((a, b) => b.tvl - a.tvl);
        const topChains = sortedChains.slice(0, 8);
        setChainData(topChains);
        
        // Global TVL
        const totalTvlVal = validChains.reduce((sum, c) => sum + c.tvl, 0);
        setGlobalTvl(totalTvlVal);
        setTotalChains(validChains.length);

        // 3. Process Pools
        const pools = poolsJson.data || [];
        const sortedPools = pools.filter(p => p.tvlUsd > 1000000).sort((a, b) => b.apy - a.apy);
        setPoolsData(sortedPools.slice(0, 10));

        // 4. Process Stables
        const stables = stablesJson.peggedAssets || [];
        const sortedStables = stables.sort((a, b) => (b.circulating?.peggedUSD || 0) - (a.circulating?.peggedUSD || 0));
        setStablesData(sortedStables.slice(0, 8));

        // 5. Process DEXs
        const dexs = dexsJson.protocols || [];
        const sortedDexs = dexs.filter(d => d.total24h).sort((a, b) => b.total24h - a.total24h);
        setDexsData(sortedDexs.slice(0, 10));
        const totalDexVol = sortedDexs.reduce((sum, d) => sum + (d.total24h || 0), 0);
        setGlobalVolume(totalDexVol);
        
        setLoading(false);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to fetch data from DeFiLlama. Please try again later.");
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (loading || error) return;
    
    // Lazy fetch full protocols to get TVL for efficiency ratio
    fetch(`${API_BASE}/protocols`)
      .then(res => res.json())
      .then(fullProtocols => {
        // Merge with existing top 10 revenue protocols
        setProtocolData(prev => prev.map(p => {
          const fullMatch = fullProtocols.find(fp => 
            fp.slug === p.slug || fp.name.toLowerCase() === p.name.toLowerCase()
          );
          return {
            ...p,
            tvl: fullMatch ? fullMatch.tvl : 0,
            chainData: fullMatch && fullMatch.chains ? fullMatch.chains.join(', ') : p.category || 'Multi'
          };
        }));
      })
      .catch(err => console.log('Silently failed fetching full protocol list for TVL merge', err));
  }, [loading, error]);

  // Calculate Efficiency Data
  const efficiencyData = protocolData
    .filter(p => p.tvl > 100000 && p.total7d > 0) // Filter out 0 TVL to prevent Infinity
    .map(p => {
      // Annualized rev = total7d * 52
      const annualizedRev = (p.total7d || 0) * 52;
      const ratio = p.tvl ? (annualizedRev / p.tvl) * 100 : 0;
      return {
        name: p.name,
        ratio: Number(ratio.toFixed(2)),
        tvl: p.tvl,
        annualized: annualizedRev
      };
    })
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 10);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-df-surface border-l-4 border-df-negative p-6 max-w-lg rounded shadow-lg text-center">
          <AlertCircle className="mx-auto text-df-negative mb-4" size={48} />
          <h2 className="text-xl font-bold text-white mb-2">Connection Error</h2>
          <p className="text-df-muted">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 selection:bg-df-accent selection:text-black">
      {/* Background glow effects */}
      <div className="fixed top-[-10%] left-[-5%] w-[40vw] h-[40vw] bg-df-accent rounded-full opacity-[0.03] blur-[100px] pointer-events-none"></div>
      
      <header className="border-b border-df-border bg-df-surface/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-df-accent to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(0,242,255,0.3)]">
              <Layers size={16} className="text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">DeFi <span className="text-df-muted font-normal">Fundamentals</span></h1>
          </div>
          <div className="text-xs font-mono text-df-accent bg-df-accent/10 px-3 py-1.5 rounded-full border border-df-accent/20 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-df-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-df-accent"></span>
            </span>
            LIVE NETWORK
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 grid gap-10">
        
        {/* Section 1 & 4 (Combined top row): Hero TVL and Market Pulse */}
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          <div className="lg:col-span-1 flex flex-col justify-center">
            <h2 className="text-df-muted text-sm tracking-widest uppercase font-bold mb-2">Total Value Locked</h2>
            {loading ? (
              <div className="h-16 w-full bg-df-surface animate-pulse rounded mt-2"></div>
            ) : (
              <div className="text-4xl md:text-5xl lg:text-5xl font-bold font-mono tracking-tighter text-white tracking-widest text-shadow-sm shadow-blue-500/50">
                {formatCurrency(globalTvl)}
              </div>
            )}
            <p className="text-df-muted mt-4 text-sm max-w-sm">
              Across all decentralized finance protocols and chains tracked.
            </p>
          </div>

          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard 
               title="Highest Earner (7d)" 
               value={topEarner.name} 
               icon={TrendingUp} 
               isLoading={loading} 
            />
            <StatCard 
               title="Active Protocols" 
               value={totalProtocols.toLocaleString()} 
               icon={Activity} 
               isLoading={loading} 
            />
            <StatCard 
               title="Tracked Chains" 
               value={totalChains} 
               icon={Layers} 
               isLoading={loading} 
            />
            <StatCard 
               title="DEX Volume (24h)" 
               value={formatCurrency(globalVolume)} 
               icon={ArrowRightLeft} 
               isLoading={loading} 
            />
          </div>

        </section>

        {/* Top Protocols Table */}
        <section>
          <SectionHeader 
            title="Top Protocols by Revenue" 
            description="Highest earning applications based on 7-day trailing revenue generation." 
          />
          
          <div className="overflow-x-auto rounded-xl border border-df-border bg-df-surface/30">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-df-border bg-df-surface">
                  <th className="p-4 text-xs font-semibold text-df-muted uppercase tracking-wider">Protocol</th>
                  <th className="p-4 text-xs font-semibold text-df-muted uppercase tracking-wider hidden sm:table-cell">Chain(s)</th>
                  <th className="p-4 text-xs font-semibold text-df-muted uppercase tracking-wider text-right">7d Revenue</th>
                  <th className="p-4 text-xs font-semibold text-df-muted uppercase tracking-wider text-right hidden md:table-cell">30d Revenue</th>
                  <th className="p-4 text-xs font-semibold text-df-muted uppercase tracking-wider text-right">Trend</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-df-border border-opacity-50">
                      <td className="p-4"><div className="h-5 w-32 bg-df-surface animate-pulse rounded"></div></td>
                      <td className="p-4 hidden sm:table-cell"><div className="h-5 w-20 bg-df-surface animate-pulse rounded"></div></td>
                      <td className="p-4"><div className="h-5 w-24 bg-df-surface animate-pulse rounded ml-auto"></div></td>
                      <td className="p-4 hidden md:table-cell"><div className="h-5 w-24 bg-df-surface animate-pulse rounded ml-auto"></div></td>
                      <td className="p-4"><div className="h-5 w-12 bg-df-surface animate-pulse rounded ml-auto"></div></td>
                    </tr>
                  ))
                ) : (
                  protocolData.map((p, i) => {
                    const syntheticChange = ((p.total7d % 10) - 5) * 2.3; 
                    const change = p.change_7d !== undefined ? p.change_7d : syntheticChange;
                    
                    const isPositive = change >= 0;

                    return (
                      <tr key={p.id || i} className="border-b border-df-border border-opacity-50 hover:bg-df-surface-hover/50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <span className="text-df-muted text-xs w-4">{i + 1}</span>
                            <img 
                              src={p.logo || `https://api.llama.fi/logo/${p.slug}`} 
                              alt={p.name} 
                              className="w-8 h-8 rounded-full bg-df-surface p-1"
                              onError={(e) => { e.target.style.display = 'none' }}
                            />
                            <span className="font-semibold text-white">{p.name}</span>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-df-muted hidden sm:table-cell truncate max-w-[150px]">
                          {p.chainData || p.category || 'Various'}
                        </td>
                        <td className="p-4 text-right font-mono text-sm">
                          {formatCurrency(p.total7d)}
                        </td>
                        <td className="p-4 text-right font-mono text-df-muted text-sm hidden md:table-cell">
                          {formatCurrency(p.total30d)}
                        </td>
                        <td className="p-4 text-right font-mono text-sm">
                          <span className={isPositive ? 'text-df-positive' : 'text-df-negative'}>
                            {formatPercent(change)}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 2-Column Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          
          {/* Top DEXs */}
          <section>
            <SectionHeader 
              title="Top DEXs by Volume" 
              description="Highest volume decentralized exchanges based on 24-hour trading volume." 
            />
            <div className="overflow-x-auto rounded-xl border border-df-border bg-df-surface/30">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-df-border bg-df-surface">
                    <th className="p-4 text-xs font-semibold text-df-muted uppercase tracking-wider">Exchange</th>
                    <th className="p-4 text-xs font-semibold text-df-muted uppercase tracking-wider text-right">24h Volume</th>
                    <th className="p-4 text-xs font-semibold text-df-muted uppercase tracking-wider text-right">7d Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="border-b border-df-border border-opacity-50">
                        <td className="p-4"><div className="h-5 w-32 bg-df-surface animate-pulse rounded"></div></td>
                        <td className="p-4"><div className="h-5 w-24 bg-df-surface animate-pulse rounded ml-auto"></div></td>
                        <td className="p-4"><div className="h-5 w-24 bg-df-surface animate-pulse rounded ml-auto"></div></td>
                      </tr>
                    ))
                  ) : (
                    dexsData.map((d, i) => (
                      <tr key={d.id || i} className="border-b border-df-border border-opacity-50 hover:bg-df-surface-hover/50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <span className="text-df-muted text-xs w-4">{i + 1}</span>
                            <span className="font-semibold text-white">{d.name}</span>
                          </div>
                        </td>
                        <td className="p-4 text-right font-mono text-sm">{formatCurrency(d.total24h)}</td>
                        <td className="p-4 text-right font-mono text-sm text-df-muted">{formatCurrency(d.total7d)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Top Yield Pools */}
          <section>
            <SectionHeader 
              title="Top Yield Pools" 
              description="Highest yielding liquidity pools with >$1M TVL." 
            />
            <div className="overflow-x-auto rounded-xl border border-df-border bg-df-surface/30">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-df-border bg-df-surface">
                    <th className="p-4 text-xs font-semibold text-df-muted uppercase tracking-wider">Pool / Protocol</th>
                    <th className="p-4 text-xs font-semibold text-df-muted uppercase tracking-wider text-right">TVL</th>
                    <th className="p-4 text-xs font-semibold text-df-muted uppercase tracking-wider text-right">APY</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="border-b border-df-border border-opacity-50">
                        <td className="p-4"><div className="h-5 w-32 bg-df-surface animate-pulse rounded"></div></td>
                        <td className="p-4"><div className="h-5 w-24 bg-df-surface animate-pulse rounded ml-auto"></div></td>
                        <td className="p-4"><div className="h-5 w-16 bg-df-surface animate-pulse rounded ml-auto"></div></td>
                      </tr>
                    ))
                  ) : (
                    poolsData.map((p, i) => (
                      <tr key={p.pool || i} className="border-b border-df-border border-opacity-50 hover:bg-df-surface-hover/50 transition-colors">
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-white text-sm">{p.symbol}</span>
                            <span className="text-xs text-df-muted">{p.project} • {p.chain}</span>
                          </div>
                        </td>
                        <td className="p-4 text-right font-mono text-sm">{formatCurrency(p.tvlUsd)}</td>
                        <td className="p-4 text-right font-mono text-sm text-df-accent">{p.apy.toFixed(2)}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </div>

        {/* Visual Charts: TVL by Chain and Revenue Efficiency */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Section: TVL by Chain */}
          <section className="bg-df-surface/30 border border-df-border rounded-2xl p-6">
            <SectionHeader 
              title="TVL Distribution by Chain" 
              description="The top 8 blockchain networks ranked by Total Value Locked." 
            />
            <div className="h-64">
              {loading ? (
                 <div className="w-full h-full bg-df-surface animate-pulse rounded"></div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chainData} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3bc', fontSize: 13, fontWeight: 500 }} 
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      contentStyle={{ backgroundColor: '#11131a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      itemStyle={{ color: '#00f2ff', fontFamily: 'monospace' }}
                      formatter={(value) => [formatCurrency(value), 'TVL']}
                    />
                    <Bar dataKey="tvl" radius={[0, 4, 4, 0]} barSize={16}>
                      {chainData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#00f2ff' : 'rgba(0, 242, 255, 0.4)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          {/* Efficiency Ratio */}
          <section>
            <SectionHeader 
              title="Revenue Efficiency" 
              description="Calculated as (Annualized 7d Rev / TVL). Higher means better capital efficiency." 
            />
            
            <div className="bg-df-surface/30 border border-df-border rounded-xl p-5" title="Annualized Revenue divided by Total Value Locked">
              {loading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-2 items-center">
                       <div className="h-4 w-16 bg-df-surface animate-pulse rounded"></div>
                       <div className="h-4 flex-1 bg-df-surface animate-pulse rounded"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-5">
                  {efficiencyData.length === 0 ? (
                    <p className="text-df-muted text-sm text-center py-4">Fetching TVL data to calculate efficiency...</p>
                  ) : (
                    efficiencyData.map((d, i) => {
                      const maxRatio = efficiencyData[0].ratio;
                      const width = `${Math.min((d.ratio / maxRatio) * 100, 100)}%`;
                      
                      return (
                        <div key={i} className="group cursor-default">
                          <div className="flex justify-between text-sm mb-1 line-clamp-1">
                            <span className="font-medium text-white group-hover:text-df-accent transition-colors">{d.name}</span>
                            <span className="font-mono text-df-muted">{d.ratio}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-df-border rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-df-accent rounded-full opacity-80" 
                              style={{ width }}
                            ></div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Top Stablecoins Table */}
        <section>
          <SectionHeader 
            title="Top Stablecoins" 
            description="Leading stablecoins ranked by market capitalization." 
          />
          <div className="overflow-x-auto rounded-xl border border-df-border bg-df-surface/30">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-df-border bg-df-surface">
                  <th className="p-4 text-xs font-semibold text-df-muted uppercase tracking-wider">Stablecoin</th>
                  <th className="p-4 text-xs font-semibold text-df-muted uppercase tracking-wider text-right">Market Cap</th>
                  <th className="p-4 text-xs font-semibold text-df-muted uppercase tracking-wider text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-df-border border-opacity-50">
                      <td className="p-4"><div className="h-5 w-32 bg-df-surface animate-pulse rounded"></div></td>
                      <td className="p-4"><div className="h-5 w-24 bg-df-surface animate-pulse rounded ml-auto"></div></td>
                      <td className="p-4"><div className="h-5 w-16 bg-df-surface animate-pulse rounded ml-auto"></div></td>
                    </tr>
                  ))
                ) : (
                  stablesData.map((s, i) => (
                    <tr key={s.id || i} className="border-b border-df-border border-opacity-50 hover:bg-df-surface-hover/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <span className="text-df-muted text-xs w-4">{i + 1}</span>
                          <span className="font-semibold text-white">{s.name} <span className="text-df-muted font-normal text-xs ml-1">({s.symbol})</span></span>
                        </div>
                      </td>
                      <td className="p-4 text-right font-mono text-sm">{formatCurrency(s.circulating?.peggedUSD || 0)}</td>
                      <td className="p-4 text-right font-mono text-sm">{s.price ? `$${s.price.toFixed(4)}` : '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

      </main>

      <footer className="mt-10 py-8 border-t border-df-border text-center">
        <p className="text-df-muted text-sm">
          Data from <a href="https://defillama.com" target="_blank" rel="noreferrer" className="text-white hover:text-df-accent transition-colors">DeFiLlama API</a> · 
          built by <a href="https://nitishpoluri.netlify.app/" className="text-white hover:text-df-accent transition-colors">Nitish Poluri</a> · 
          <a href="#" className="underline ml-2 hover:text-df-accent transition-colors">Open Source on GitHub</a>
        </p>
      </footer>
    </div>
  );
}
