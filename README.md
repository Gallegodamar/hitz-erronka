<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Configure Supabase in `.env.local`:
   - `VITE_SUPABASE_URL=...`
   - `VITE_SUPABASE_ANON_KEY=...`
   - `VITE_SUPABASE_WORDS_TABLE=words` (optional, defaults to `words`)
   - `VITE_SUPABASE_GAME_SESSIONS_TABLE=game_sessions` (recommended)
   - `VITE_SUPABASE_GAME_PLAYER_RESULTS_TABLE=game_player_results` (recommended)
   - `VITE_SUPABASE_GAME_FAIL_EVENTS_TABLE=game_fail_events` (recommended)
   - If not set, the app auto-tries both table families: `analytics_*` and legacy `game_*`.
3. Ensure your table contains:
   - `hitza` (or `word`)
   - `sinonimoak` (array/json/text) or `synonyms`
   - `difficulty` (optional, values 1-4)
4. Create analytics tables in Supabase:
   - Run `analytics_schema.sql` in Supabase SQL Editor.
   - This stores sessions, per-player results, and failed words/events for analytics.
   - Player analytics uses only the player's first name (`player_name`) as identifier.
   - If you had older analytics tables with `user_id NOT NULL`, this script makes them compatible.
5. Run the app:
   `npm run dev`
