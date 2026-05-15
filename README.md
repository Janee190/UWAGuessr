# UWAGuessr
*NOTICE!! Please run the following command when running for the first time to import the latest photos:*
```bash
flask --app run load-photos
```

## Description
UWAGuessr is a web-based discovery game inspired by GeoGuessr, focussed specifically on the University of Western Australia (UWA) campus. Players are presented with photos of various locations around UWA and must pinpoint their location on an interactive map.

## Project Goals
* **Engagement:** Create a fun, interactive way for students, alumni, and visitors to explore the UWA campus.
* **Competition:** Build a community through leaderboards and social sharing features.
* **Scalability:** Provide an easy-to-use administrative interface to update campus photos as the university evolves.

## Key Features
* **User Authentication:** Secure account creation and login/logout functionality to save progress.
* **Interactive Map Guessing:** A map interface allowing players to place markers to submit their guesses.
* **Scoring & Feedback:** Real-time distance calculation between the guess and the actual location, including visual reveals of the correct spot.
* **User Profiles:** Dedicated profile pages to track past game history and individual performance metrics.
* **Global Leaderboard:** A competitive ranking system to compare scores with other players.
* **Social Challenges:** Ability to share specific game links so friends can compete on the same set of locations.
* **Admin Dashboard:** Tools for system administrators to manage users and for game admins to upload/delete campus photos without writing code.

## Site Structure
* **Home/Landing Page:** Introduction to the game and quick start.
* **Game Page:** The core interactive interface for viewing photos and the map.
* **Leaderboard:** Ranking of top users.
* **Profile:** Personal dashboard for game history and stats.
* **About/How to Play:** Instructions and project background.
* **Authentication Pages:** Simple Login and Sign-up forms.

## Tech Stack
* **Frontend:** Bootstrap (HTML/CSS)
* **Backend:** Flask (Python)
* **Database:** SQLite (via SQLAlchemy)
* **Map API:** MazeMap (Mapbox GL-based)

## Networking
All real-time features use HTTP polling — no WebSockets or SSE. Clients call REST endpoints and poll `/api/challenges/poll/<id>` every 3 seconds for state updates. The server is the single source of truth; each client pulls the latest challenge state rather than receiving pushed events. This keeps the architecture simple and works well for the turn-based game loop without overloading the SQLite backend.

## Challenges
A `Challenge` row links two players with a shared set of 5 photo IDs and progresses through statuses: `pending` → `ready_waiting` → `in_progress` → `completed`. Both players must click READY before the game begins. During play, scores and round progress sync each round via `/api/challenges/update-progress`. When a player finishes all 5 rounds, `/api/game-complete` marks their round as 6. Once both players reach round 6, the winner is determined by comparing scores, and the game-over screen polls until the result is available.
