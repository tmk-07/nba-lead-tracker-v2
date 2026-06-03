
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, Search } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const SEASONS = [
  '',
  '2025-26',
  '2024-25',
  '2023-24',
  '2022-23',
  '2021-22',
  '2020-21',
  '2019-20',
  '2018-19',
  '2017-18',
  '2016-17',
  '2015-16',
  '2014-15',
  '2013-14',
  '2012-13',
  '2011-12',
  '2010-11',
  '2009-10',
  '2008-09',
  '2007-08',
  '2006-07',
  '2005-06',
  '2004-05',
  '2003-04',
  '2002-03',
  '2001-02',
  '2000-01',
]


function LeadLineChart({ events, step, home, away, maxAbsDiff, onSelectStep }) {
  if (!events?.length) return null

  const width = 760
  const height = 220
  const padX = 32
  const padY = 24
  const chartW = width - padX * 2
  const chartH = height - padY * 2
  const maxIndex = Math.max(events.length - 1, 1)

  function xFor(i) {
    return padX + (i / maxIndex) * chartW
  }

  function yFor(diff) {
    const clamped = Math.max(-maxAbsDiff, Math.min(maxAbsDiff, diff))
    return padY + ((maxAbsDiff - clamped) / (maxAbsDiff * 2)) * chartH
  }

  function handleChartClick(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percent = Math.max(0, Math.min(1, clickX / rect.width))
    const targetStep = Math.round(percent * maxIndex)
    onSelectStep?.(targetStep)
  }

  const path = events
    .map((e, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(e.diff)}`)
    .join(' ')

  const current = events[Math.min(step, events.length - 1)]
  const currentX = xFor(Math.min(step, events.length - 1))
  const currentY = yFor(current.diff)
  const currentColor = current.diff > 0 ? home.color : current.diff < 0 ? away.color : '#f8fafc'

  return (
    <div className="lineChartPanel">
      <div className="lineChartHeader">
        <strong>Point differential over time</strong>
        <span>
          {away.abbrev} leads below 0 · {home.abbrev} leads above 0
        </span>
      </div>

      <svg
        className="lineChart clickableLineChart"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        onClick={handleChartClick}
      >
        <line
          x1={padX}
          y1={yFor(0)}
          x2={width - padX}
          y2={yFor(0)}
          className="zeroLine"
        />

        <text x={padX + 4} y={yFor(maxAbsDiff) + 14} className="chartLabel">
          +{maxAbsDiff}
        </text>
        <text x={padX + 4} y={yFor(0) - 6} className="chartLabel">
          +0
        </text>
        <text x={padX + 4} y={yFor(-maxAbsDiff) - 6} className="chartLabel">
          -{maxAbsDiff}
        </text>

        <path d={path} className="diffLine" />

        <line
          x1={currentX}
          y1={padY}
          x2={currentX}
          y2={height - padY}
          className="currentLine"
        />

        <circle
          cx={currentX}
          cy={currentY}
          r="7"
          fill={currentColor}
          className="currentDot"
        />
      </svg>
    </div>
  )
}


function needsLeadBarOutline(team) {
  return team?.abbrev === 'BKN' || team?.abbrev === 'DEN' || team?.abbrev === 'CHA'
}

function outlineStyleForTeam(team) {
  return needsLeadBarOutline(team)
    ? {
        textShadow: '0 0 1px #f8fafc, 0 0 5px rgba(248,250,252,0.35)',
      }
    : {}
}

function SeasonSelect({ season, setSeason }) {
  const [open, setOpen] = useState(false)

  const selectedLabel = season || 'Recent'

  function choose(value) {
    setSeason(value)
    setOpen(false)
  }

  return (
    <div className="field seasonField customSelectField">
      <label>Season optional</label>

      <button
        type="button"
        className="customSelectButton"
        onClick={() => setOpen(o => !o)}
      >
        <span>{selectedLabel}</span>
        <small>{season ? 'All matchups that season' : '10 most recent'}</small>
      </button>

      {open && (
        <div
          className="suggestions seasonSuggestions"
          onMouseLeave={() => setOpen(false)}
        >
          {SEASONS.map(s => (
            <button
              key={s || 'recent'}
              type="button"
              className={`suggestion seasonSuggestion ${season === s ? 'selectedSeason' : ''}`}
              onMouseDown={e => e.preventDefault()}
              onClick={() => choose(s)}
            >
              <span className="seasonDot" />
              <strong>{s || 'Recent'}</strong>
              <small></small>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TeamInput({ label, value, setValue, selected, setSelected, teams }) {
  const [focused, setFocused] = useState(false)
  const q = value.trim().toLowerCase()

  const matches = useMemo(() => {
    if (!q) return teams.slice(0, 8)
    return teams
      .filter(t =>
        t.fullName.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.city.toLowerCase().includes(q) ||
        t.abbrev.toLowerCase().startsWith(q)
      )
      .slice(0, 8)
  }, [q, teams])

  function choose(team) {
    setSelected(team)
    setValue(team.fullName)
    setFocused(false)
  }

  return (
    <div className="field teamField">
      <label>{label}</label>
      <input
        value={value}
        onFocus={() => setFocused(true)}
        onChange={e => {
          setValue(e.target.value)
          setSelected(null)
          setFocused(true)
        }}
        placeholder="Type team name, e.g. Pacers"
      />
      {focused && matches.length > 0 && (
        <div className="suggestions">
          {matches.map(team => (
            <button
              key={team.id}
              type="button"
              className="suggestion"
              onMouseDown={e => e.preventDefault()}
              onClick={() => choose(team)}
            >
              <span className="dot" style={{ background: team.color }} />
              <strong>{team.fullName}</strong>
              <small>{team.abbrev}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function formatGame(g) {
  return `${g.away.abbrev} ${g.away.score ?? ''} @ ${g.home.abbrev} ${g.home.score ?? ''}`
}

export default function App() {
  const [teams, setTeams] = useState([])
  const [team1Text, setTeam1Text] = useState('Pacers')
  const [team2Text, setTeam2Text] = useState('Pelicans')
  const [team1, setTeam1] = useState(null)
  const [team2, setTeam2] = useState(null)
  const [season, setSeason] = useState('')
  const [searchMode, setSearchMode] = useState('recent')

  const [games, setGames] = useState([])
  const [selected, setSelected] = useState(null)
  const [timeline, setTimeline] = useState(null)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const timerRef = useRef(null)

  useEffect(() => {
    async function loadTeams() {
      try {
        const res = await fetch(`${API_BASE}/api/teams`)
        const data = await res.json()
        setTeams(data.teams || [])

        const pacers = data.teams?.find(t => t.abbrev === 'IND')
        const pels = data.teams?.find(t => t.abbrev === 'NOP')
        if (pacers) setTeam1(pacers)
        if (pels) setTeam2(pels)
      } catch {
        setError('Could not load NBA team list from backend.')
      }
    }
    loadTeams()
  }, [])

  function resolveTeam(text, selectedTeam) {
    if (selectedTeam) return selectedTeam
    const q = text.trim().toLowerCase()
    return teams.find(t =>
      t.fullName.toLowerCase() === q ||
      t.name.toLowerCase() === q ||
      t.city.toLowerCase() === q ||
      t.abbrev.toLowerCase() === q
    )
  }

  async function searchMatchups(e) {
    e?.preventDefault()
    const t1 = resolveTeam(team1Text, team1)
    const t2 = resolveTeam(team2Text, team2)

    if (!t1 || !t2) {
      setError('Pick both teams from the dropdown suggestions.')
      return
    }

    setLoading(true)
    setError('')
    setTimeline(null)
    setSelected(null)
    setStep(0)
    setPlaying(false)

    try {
      const params = new URLSearchParams({
        team1: t1.abbrev,
        team2: t2.abbrev,
        limit: '10'
      })

      if (season.trim()) {
        params.set('season', season.trim())
      }
      const res = await fetch(`${API_BASE}/api/matchups?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Search failed')
      setGames(data.games || [])
      setSearchMode(data.mode || (season.trim() ? 'season' : 'recent'))
      if (!data.games?.length) setError('No games found between those teams' + (season.trim() ? ` in ${season.trim()}.` : '.'))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadGame(game) {
    setSelected(game)
    setLoading(true)
    setError('')
    setPlaying(false)
    setStep(0)

    try {
      const res = await fetch(`${API_BASE}/api/game/${game.gameId}/timeline`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not load game')
      setTimeline(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const events = timeline?.events || []
  const current = events[Math.min(step, Math.max(events.length - 1, 0))]
  const maxAbsDiff = Math.max(timeline?.maxAbsDiff || 1, 10)
  const diff = current?.diff || 0
  const leader = diff > 0 ? timeline?.home : diff < 0 ? timeline?.away : null
  const percent = Math.min(50, Math.abs(diff) / maxAbsDiff * 50)

  useEffect(() => {
    clearInterval(timerRef.current)
    if (!playing || !events.length) return

    const delay = Math.max(60, 1000 / speed)
    timerRef.current = setInterval(() => {
      setStep(prev => {
        if (prev >= events.length - 1) {
          setPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, delay)

    return () => clearInterval(timerRef.current)
  }, [playing, speed, events.length])

  const gameTitle = useMemo(() => {
    if (!timeline) return 'Select a game'
    return `${timeline.away.name} at ${timeline.home.name}`
  }, [timeline])

  return (
    <main className="app">
      <section className="hero">
        <div>
          <p className="eyebrow">NBA play-by-play visualizer</p>
          <h1>Lead Tracker</h1>
          <p className="subtitle">
            Pick two teams, load their 10 most recent matchups, then watch the point differential animate from the center line.
          </p>
        </div>
      </section>

      <form className="searchPanel" onSubmit={searchMatchups}>
        <TeamInput
          label="Team 1"
          value={team1Text}
          setValue={setTeam1Text}
          selected={team1}
          setSelected={setTeam1}
          teams={teams}
        />
        <TeamInput
          label="Team 2"
          value={team2Text}
          setValue={setTeam2Text}
          selected={team2}
          setSelected={setTeam2}
          teams={teams}
        />

        <SeasonSelect season={season} setSeason={setSeason} />

        <button className="primary" type="submit" disabled={loading}>
          <Search size={18} />
          {loading ? 'Loading...' : 'Find games'}
        </button>
      </form>

      {error && <div className="error">{error}</div>}

      <section className="layout">
        <aside className="results">
          <h2>
            {searchMode === 'season' && season.trim()
              ? `All ${season.trim()} matchups`
              : '10 most recent matchups'}
          </h2>
          <div className="resultList">
            {games.map(game => (
              <button
                key={game.gameId}
                className={`gameCard ${selected?.gameId === game.gameId ? 'active' : ''}`}
                onClick={() => loadGame(game)}
              >
                <span className="date">{game.date}</span>
                <strong>{formatGame(game)}</strong>
                <small>{game.matchup} · {game.gameId}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="vizPanel">
          <div className="vizHeader">
            <div>
              <h2>{gameTitle}</h2>
              {timeline && (
                <p>
                  {timeline.away.abbrev} {current?.awayScore ?? 0} — {timeline.home.abbrev} {current?.homeScore ?? 0}
                </p>
              )}
            </div>
            {current && (
              <div className="timeBox">
                <span>Q{current.period}</span>
                <strong>{current.clock}</strong>
              </div>
            )}
          </div>

          {!timeline ? (
            <div className="emptyState">Choose two teams, click “Find games,” then select a game.</div>
          ) : (
            <>
              <div className="teamsRow">
                <div
                  className="teamNameBadge awayBadge"
                  style={{
                    color: timeline.away.color,
                    borderColor: timeline.away.color,
                    ...outlineStyleForTeam(timeline.away),
                  }}
                >
                  <span>{timeline.away.abbrev}</span>
                  <small>{timeline.away.name}</small>
                </div>
                <div
                  className="teamNameBadge homeBadge"
                  style={{
                    color: timeline.home.color,
                    borderColor: timeline.home.color,
                    ...outlineStyleForTeam(timeline.home),
                  }}
                >
                  <span>{timeline.home.abbrev}</span>
                  <small>{timeline.home.name}</small>
                </div>
              </div>

              <div
                className="barStage"
                style={{
                  '--leader-color': leader ? leader.color : '#94a3b8',
                  '--leader-outline': leader && needsLeadBarOutline(leader) ? '#f8fafc' : 'transparent',
                  '--away-color': timeline.away.color,
                  '--home-color': timeline.home.color,
                }}
              >
                <div className="side leftSide"></div>
                <div className="side rightSide"></div>
                <div className="centerLine"></div>

                {diff < 0 && (
                  <div
                    className="leadBar leftBar"
                    style={{ width: `${percent}%`, background: timeline.away.color }}
                  />
                )}

                {diff > 0 && (
                  <div
                    className="leadBar rightBar"
                    style={{ width: `${percent}%`, background: timeline.home.color }}
                  />
                )}
              </div>

              <div className="diffReadout">
                {leader ? (
                  <span
                    style={{
                      color: leader.color,
                      ...outlineStyleForTeam(leader),
                    }}
                  >
                    {leader.abbrev} +{Math.abs(diff)}
                  </span>
                ) : (
                  <span>Tied</span>
                )}
              </div>

              <LeadLineChart
                events={events}
                step={step}
                home={timeline.home}
                away={timeline.away}
                maxAbsDiff={maxAbsDiff}
                onSelectStep={(targetStep) => {
                  setStep(targetStep)
                  setPlaying(false)
                }}
              />

              <div className="eventText">
                <strong>Play:</strong> {current?.description || '—'}
              </div>

              <input
                className="slider"
                type="range"
                min="0"
                max={Math.max(events.length - 1, 0)}
                value={step}
                onChange={e => {
                  setStep(Number(e.target.value))
                  setPlaying(false)
                }}
              />

              <div className="controls">
                <button onClick={() => setStep(0)}><SkipBack size={18} /> Start</button>
                <button onClick={() => setStep(s => Math.max(0, s - 1))}><SkipBack size={18} /> Back</button>
                <button
                  className="playBtn"
                  onClick={() => {
                    if (playing) {
                      setPlaying(false)
                      return
                    }

                    if (step >= events.length - 1) {
                      setStep(0)
                    }

                    setPlaying(true)
                  }}
                >
                  {playing ? <Pause size={20} /> : <Play size={20} />}
                  {playing ? 'Pause' : 'Play'}
                </button>
                <button onClick={() => setStep(s => Math.min(events.length - 1, s + 1))}>Next <SkipForward size={18} /></button>

                <label className="speedControl">
                  Speed
                  <input
                    type="range"
                    min="0.25"
                    max="8"
                    step="0.25"
                    value={speed}
                    onChange={e => setSpeed(Number(e.target.value))}
                  />
                  <span>{speed}x</span>
                </label>
              </div>

              <div className="meta">
                Event {step + 1} of {events.length}. Bar scale uses the largest lead in this game.
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  )
}
