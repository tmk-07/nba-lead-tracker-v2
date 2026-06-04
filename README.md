# NBA Lead Tracker

An interactive NBA game-flow visualization tool that turns play-by-play data into a clear lead timeline, allowing users to visualize momentum swings, largest leads, comebacks, and how a game unfolded beyond the final score.

## Demo
[nbaleadtracker.vercel.app](https://nbaleadtracker.vercel.app)

<img width="230" height="278" alt="Adobe Express - lead tracker vid" src="https://github.com/user-attachments/assets/eb3a6f72-0eef-476e-a620-c10cf1ba7a6d" />

## Features

* Search and select NBA games, optionally by season
* Visualize lead changes over the full game timeline
* Show score differential throughout the game
* Highlight which team is leading at each point
* Support animated playthrough of the game timeline
* Allow users to jump to specific moments in the game

## Tech Stack

Frontend:

* React
* Vite
* JavaScript
* Custom SVG visualizations for the point-differential line graph
* CSS for team-based styling, custom dropdowns, animations, and responsive layout

Backend:

* Python
* FastAPI
* nba_api for NBA game, box score, and play-by-play data
* Pandas for processing game and timeline data
* Uvicorn as the ASGI server

Deployment:

* Frontend deployed on Vercel
* Backend deployed on Render
* GitHub used for version control and deployment integration

## How It Works

1. The user searches for or selects an NBA game.
2. The app retrieves play-by-play data for that game.
3. Each scoring event is processed into a running score timeline.
4. The score differential is calculated at each point in the game.
5. The frontend renders the lead timeline using team colors, logos, and visual lead bars.
6. Users can play through the game or click on the graph to jump to a specific moment.
