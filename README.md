# Waypoint

> **Every task starts with context.**

Waypoint is the context engine that prepares developers for the exact task they're about to perform before they write a single line of code.

## The Problem
New developers take 6–12 months to become productive in a new codebase. 73% of developer time is spent reading code, not writing it. Code reviews are bottlenecked because reviewers lack context.

## The Solution
Instead of browsing a repository blindly, you tell Waypoint your goal ("Add Google OAuth", "Fix login bug"). 
Waypoint gives you exactly the context you need:
*   **Mission Brief:** Confidence score, risk level, and estimated effort.
*   **Prerequisites:** Concepts you need to learn before starting.
*   **Files You'll Touch:** The handful of relevant files (and the hundreds you can ignore).
*   **Known Traps:** Historical bugs and fragile components to watch out for.
*   **Route:** A step-by-step GPS path for execution.

## Tech Stack
*   **Frontend:** React + Vite
*   **Routing:** React Router
*   **3D Map Tab:** React Three Fiber (`@react-three/fiber`, `@react-three/drei`)
*   **Data Structures:** D3.js (Treemap)
*   **Design:** Vanilla CSS with custom design system

## Run Locally
1. `npm install`
2. `npm run dev`
