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
3. Ensure your table contains:
   - `hitza` (or `word`)
   - `sinonimoak` (array/json/text) or `synonyms`
   - `difficulty` (optional, values 1-4)
4. Run the app:
   `npm run dev`
