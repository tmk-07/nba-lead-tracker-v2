
from __future__ import annotations

import re
from functools import lru_cache
from typing import Any

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from nba_api.stats.endpoints import leaguegamefinder, playbyplayv3, boxscoresummaryv2
from nba_api.stats.static import teams

app = FastAPI(title="NBA Lead Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://nbaleadtracker.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEAM_COLORS = {
    "ATL": "#E03A3E", "BOS": "#007A33", "BKN": "#000000", "CHA": "#1D1160",
    "CHI": "#CE1141", "CLE": "#860038", "DAL": "#00538C", "DEN": "#0E2240",
    "DET": "#C8102E", "GSW": "#1D428A", "HOU": "#CE1141", "IND": "#002D62",
    "LAC": "#C8102E", "LAL": "#552583", "MEM": "#5D76A9", "MIA": "#98002E",
    "MIL": "#00471B", "MIN": "#0C2340", "NOP": "#0C2340", "NYK": "#006BB6",
    "OKC": "#007AC1", "ORL": "#0077C0", "PHI": "#006BB6", "PHX": "#1D1160",
    "POR": "#E03A3E", "SAC": "#5A2D81", "SAS": "#C4CED4", "TOR": "#CE1141",
    "UTA": "#002B5C", "WAS": "#002B5C",
}

NICKNAME_ALIASES = {
    "cavs": "CLE",
    "mavs": "DAL",
    "sixers": "PHI",
    "76ers": "PHI",
    "blazers": "POR",
    "trail blazers": "POR",
    "clips": "LAC",
    "wolves": "MIN",
    "pels": "NOP",
    "nets": "BKN",
    "knicks": "NYK",
    "dubs": "GSW",
}

NBA_TEAMS = teams.get_teams()
TEAM_BY_ID = {int(t["id"]): t for t in NBA_TEAMS}
TEAM_BY_ABBR = {t["abbreviation"].upper(): t for t in NBA_TEAMS}

def color_for(abbrev: str) -> str:
    return TEAM_COLORS.get((abbrev or "").upper(), "#64748b")

def team_public(t: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": int(t["id"]),
        "abbrev": t["abbreviation"],
        "city": t["city"],
        "name": t["nickname"],
        "fullName": t["full_name"],
        "color": color_for(t["abbreviation"]),
    }

@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

@app.get("/api/teams")
def get_teams() -> dict[str, Any]:
    all_teams = sorted([team_public(t) for t in NBA_TEAMS], key=lambda x: x["fullName"])
    aliases = [{"alias": k, "abbrev": v} for k, v in NICKNAME_ALIASES.items()]
    return {"teams": all_teams, "aliases": aliases}

def get_team(team_id_or_abbr: str) -> dict[str, Any]:
    raw = str(team_id_or_abbr).strip()
    if raw.isdigit() and int(raw) in TEAM_BY_ID:
        return TEAM_BY_ID[int(raw)]
    abbr = raw.upper()
    if abbr in TEAM_BY_ABBR:
        return TEAM_BY_ABBR[abbr]
    alias_abbr = NICKNAME_ALIASES.get(raw.lower())
    if alias_abbr:
        return TEAM_BY_ABBR[alias_abbr]
    raise HTTPException(status_code=400, detail=f"Unknown team: {team_id_or_abbr}")

def card_from_matchup_row(row: pd.Series, team1: dict[str, Any], team2: dict[str, Any]) -> dict[str, Any]:
    team1_abbrev = team1["abbreviation"]
    team2_abbrev = team2["abbreviation"]
    matchup = str(row["MATCHUP"])
    team1_pts = int(row["PTS"]) if pd.notna(row["PTS"]) else None

    plus_minus = row.get("PLUS_MINUS")
    if pd.notna(plus_minus) and team1_pts is not None:
        team2_pts = int(team1_pts - int(plus_minus))
    else:
        team2_pts = None

    team1_obj = {
        "abbrev": team1_abbrev,
        "name": team1["full_name"],
        "score": team1_pts,
        "color": color_for(team1_abbrev),
    }
    team2_obj = {
        "abbrev": team2_abbrev,
        "name": team2["full_name"],
        "score": team2_pts,
        "color": color_for(team2_abbrev),
    }

    if "vs." in matchup:
        home, away = team1_obj, team2_obj
    elif "@" in matchup:
        home, away = team2_obj, team1_obj
    else:
        home, away = team1_obj, team2_obj

    return {
        "gameId": str(row["GAME_ID"]),
        "date": str(row.get("GAME_DATE", ""))[:10],
        "matchup": matchup,
        "home": home,
        "away": away,
    }

@app.get("/api/matchups")
def matchups(
    team1: str = Query(..., description="Team id or abbreviation, e.g. LAL"),
    team2: str = Query(..., description="Team id or abbreviation, e.g. BOS"),
    season: str | None = Query(None, description="Optional NBA season like 2023-24"),
    limit: int = Query(10, ge=1, le=200),
) -> dict[str, Any]:
    t1 = get_team(team1)
    t2 = get_team(team2)

    if int(t1["id"]) == int(t2["id"]):
        raise HTTPException(status_code=400, detail="Choose two different teams.")

    season = season.strip() if season else None

    try:
        finder = leaguegamefinder.LeagueGameFinder(
            league_id_nullable="00",
            team_id_nullable=int(t1["id"]),
            vs_team_id_nullable=int(t2["id"]),
            season_nullable=season,
            timeout=30,
        )
        df = finder.get_data_frames()[0]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"NBA API matchup search failed: {e}")

    if df.empty:
        return {
            "games": [],
            "team1": team_public(t1),
            "team2": team_public(t2),
            "season": season,
            "mode": "season" if season else "recent",
        }

    df["GAME_DATE_SORT"] = pd.to_datetime(df["GAME_DATE"], errors="coerce")
    df = df.sort_values("GAME_DATE_SORT", ascending=False)

    cards = []
    seen = set()

    # If season is provided, return all matchups from that season.
    # If season is blank, return only the 10 most recent matchups.
    max_games = 200 if season else limit

    for _, row in df.iterrows():
        game_id = str(row["GAME_ID"])
        if game_id in seen:
            continue
        seen.add(game_id)
        cards.append(card_from_matchup_row(row, t1, t2))
        if len(cards) >= max_games:
            break

    return {
        "games": cards,
        "team1": team_public(t1),
        "team2": team_public(t2),
        "season": season,
        "mode": "season" if season else "recent",
    }

@lru_cache(maxsize=512)
def get_game_metadata(game_id: str) -> dict[str, Any]:
    try:
        summary = boxscoresummaryv2.BoxScoreSummaryV2(game_id=game_id, timeout=30)
        frames = summary.get_data_frames()
        game_summary = frames[0]
        line_score = frames[5]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"NBA API box score failed: {e}")

    if game_summary.empty or line_score.empty or len(line_score) < 2:
        raise HTTPException(status_code=404, detail="Could not find both teams for this game.")

    # Do NOT assume line_score row order. Use official home/visitor team IDs.
    game_row = game_summary.iloc[0]

    home_team_id = int(game_row["HOME_TEAM_ID"])
    away_team_id = int(game_row["VISITOR_TEAM_ID"])

    home_rows = line_score[line_score["TEAM_ID"].astype(int) == home_team_id]
    away_rows = line_score[line_score["TEAM_ID"].astype(int) == away_team_id]

    if home_rows.empty or away_rows.empty:
        raise HTTPException(status_code=404, detail="Could not match home/away teams for this game.")

    home = home_rows.iloc[0]
    away = away_rows.iloc[0]

    def team_obj(row: pd.Series) -> dict[str, Any]:
        abbrev = str(row.get("TEAM_ABBREVIATION", ""))
        city = str(row.get("TEAM_CITY_NAME", "")).strip()
        nickname = str(row.get("TEAM_NICKNAME", "")).strip()
        name = f"{city} {nickname}".strip() or abbrev

        return {
            "abbrev": abbrev,
            "name": name,
            "score": int(row["PTS"]) if "PTS" in row and pd.notna(row["PTS"]) else None,
            "color": color_for(abbrev),
        }

    return {
        "gameId": game_id,
        "date": str(game_row.get("GAME_DATE_EST", line_score.iloc[0].get("GAME_DATE_EST", "")))[:10],
        "home": team_obj(home),
        "away": team_obj(away),
    }


def clean_clock(clock_value: str) -> str:
    """
    Converts NBA API V3 clock values like PT00M09.00S or PT09M42.00S
    into normal basketball format like 0:09 or 9:42.
    """
    s = str(clock_value or "").strip()

    # Already normal, like 9:42 or 0:09
    if ":" in s and not s.startswith("PT"):
        return s

    # ISO duration style: PT09M42.00S
    if s.startswith("PT"):
        m = re.match(r"PT(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?", s)
        if m:
            minutes = int(m.group(1) or 0)
            seconds = int(float(m.group(2) or 0))
            return f"{minutes}:{seconds:02d}"

    return s


def clock_to_elapsed(period: int, pctimestring: str) -> int:
    try:
        pctimestring = clean_clock(pctimestring)
        minutes, seconds = pctimestring.split(":")
        remaining = int(minutes) * 60 + int(seconds)
    except Exception:
        remaining = 0

    if period <= 4:
        return (period - 1) * 12 * 60 + (12 * 60 - remaining)
    return 4 * 12 * 60 + (period - 5) * 5 * 60 + (5 * 60 - remaining)

def parse_score(score: str) -> tuple[int, int] | None:
    if not isinstance(score, str) or "-" not in score:
        return None
    nums = re.findall(r"\d+", score)
    if len(nums) != 2:
        return None
    return int(nums[0]), int(nums[1])

@app.get("/api/game/{game_id}/timeline")
def game_timeline(game_id: str) -> dict[str, Any]:
    meta = get_game_metadata(game_id)

    try:
        pbp = playbyplayv3.PlayByPlayV3(game_id=game_id, timeout=30)
        df = pbp.get_data_frames()[0]

        # Normalize PlayByPlayV3 column names to the names the rest of this app expects.
        rename_map = {
            "scoreHome": "HOME_SCORE",
            "scoreAway": "AWAY_SCORE",
            "period": "PERIOD",
            "clock": "PCTIMESTRING",
            "description": "DESCRIPTION",
        }
        df = df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns})

        # Build a V2-style SCORE column from V3's home/away scores.
        # Some NBA rows have blank score values, so convert carefully.
        def safe_score_value(x):
            if pd.isna(x):
                return None
            s = str(x).strip()
            if s == "":
                return None
            try:
                return int(float(s))
            except Exception:
                return None

        if "SCORE" not in df.columns and {"HOME_SCORE", "AWAY_SCORE"}.issubset(df.columns):
            def build_score(row):
                away = safe_score_value(row["AWAY_SCORE"])
                home = safe_score_value(row["HOME_SCORE"])
                if away is None or home is None:
                    return None
                return f"{away}-{home}"

            df["SCORE"] = df.apply(build_score, axis=1)

        # Build V2-style description columns.
        if "HOMEDESCRIPTION" not in df.columns:
            df["HOMEDESCRIPTION"] = df["DESCRIPTION"] if "DESCRIPTION" in df.columns else ""
        if "VISITORDESCRIPTION" not in df.columns:
            df["VISITORDESCRIPTION"] = ""
        if "NEUTRALDESCRIPTION" not in df.columns:
            df["NEUTRALDESCRIPTION"] = ""
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"NBA API play-by-play failed: {e}")

    if df.empty:
        raise HTTPException(status_code=404, detail="No play-by-play found for this game.")

    scoring = df[df["SCORE"].notna()].copy()
    events = [{
        "index": 0,
        "period": 1,
        "clock": "12:00",
        "elapsedSeconds": 0,
        "homeScore": 0,
        "awayScore": 0,
        "diff": 0,
        "description": "Game start",
    }]

    if scoring.empty:
        return {**meta, "events": events, "maxAbsDiff": 1}

    final_pair = None
    for score_text in reversed(scoring["SCORE"].astype(str).tolist()):
        final_pair = parse_score(score_text)
        if final_pair:
            break

    away_final = meta["away"]["score"]
    home_final = meta["home"]["score"]
    score_order = "away_home"
    if final_pair and away_final is not None and home_final is not None:
        if final_pair == (home_final, away_final):
            score_order = "home_away"

    for _, row in scoring.iterrows():
        pair = parse_score(str(row["SCORE"]))
        if not pair:
            continue

        if score_order == "away_home":
            away_score, home_score = pair
        else:
            home_score, away_score = pair

        desc = (
            row.get("HOMEDESCRIPTION")
            or row.get("NEUTRALDESCRIPTION")
            or row.get("VISITORDESCRIPTION")
            or ""
        )

        period = int(row.get("PERIOD", 1))
        clock = clean_clock(row.get("PCTIMESTRING", ""))

        events.append({
            "index": len(events),
            "period": period,
            "clock": clock,
            "elapsedSeconds": clock_to_elapsed(period, clock),
            "homeScore": int(home_score),
            "awayScore": int(away_score),
            "diff": int(home_score) - int(away_score),
            "description": str(desc),
        })

    max_abs_diff = max(abs(e["diff"]) for e in events) if events else 1
    return {**meta, "events": events, "maxAbsDiff": max_abs_diff or 1, "scoreOrderUsed": score_order}
