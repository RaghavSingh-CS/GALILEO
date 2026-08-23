# GALILEO Lab

GALILEO Lab is a web-based educational laboratory environment that simulates physics and chemistry experiments (e.g., Ohm's Law and Titration). It includes an AI assistant (powered by Google Gemini) to guide users through the experimental process.

## Features
- **Virtual Workspace:** Conduct physics and chemistry experiments interactively.
- **Data Visualization:** Real-time graphing and curve fitting using Recharts.
- **AI Assistant:** Integrated Gemini-powered AI (GALILEO Assistant) to explain scientific concepts.
- **Customizable Settings:** Adjust instrument tolerance, pacing, curve styles, and AI verbosity.
- **Experiment Library:** Save, browse, and manage past experiments.

## Tech Stack
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS
- **State Management:** Zustand
- **Charting:** Recharts
- **Backend/AI:** Express proxy server with `@google/genai`

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   Create a `.env` file in the root and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```
   This will concurrently start the Vite frontend and the Express backend proxy.
