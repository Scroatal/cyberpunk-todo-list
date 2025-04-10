# Project Plan: Animated To-Do List with Email Summary

This file tracks the development progress of the visually enhanced to-do list application.

**Color Palette:**
- `#654922` (Brown)
- `#956E2F` (Golden Brown)
- `#B68B4B` (Light Tan)
- `#4D574E` (Dark Grey-Green)
- `#303531` (Dark Grey)
- `#202221` (Near Black)

**Development Tasks:**

- [x] **1. Setup:** Create basic HTML, CSS, and JavaScript files (`index.html`, `style.css`, `script.js`).
- [x] **2. Basic To-Do List:** Implement core functionality: add tasks, display tasks, mark tasks as complete (using local storage for persistence initially).
- [x] **3. Styling:** Apply the provided color palette and basic CSS for layout and appearance.
- [x] **4. Three.js Setup:** Integrate the Three.js library and set up a basic scene, camera, and renderer. Position the canvas behind the main content.
- [x] **5. Three.js Animations - Background:** Implement dynamic background animations using Three.js (e.g., subtle particle effects).
- [x] **6. Three.js Animations - UI Elements:** Design and implement animations for UI interactions:
    - [x] Animated borders appearing around the input field on focus.
    - [x] Hover effects on buttons and list items (e.g., glowing effect).
    - [ ] Transition animations when adding or completing tasks (Skipped for now, can revisit).
- [x] **7. Email Compilation Logic:** Implement JavaScript logic to track completed tasks during the session and compile an email summary string.
- [ ] **8. AI Email Parsing (Frontend):** Implement frontend logic (`script.js`) to send email text to a backend endpoint (`/api/parse-email-ai`) and handle the response (add tasks, show loading/error states). *(Done)*
- [ ] **9. Backend Setup:** Set up a backend server environment (e.g., Node.js with Express).
- [ ] **10. AI Parsing Endpoint:** Create the backend API endpoint (`/api/parse-email-ai`).
- [ ] **11. Gemini API Integration:** Integrate Google AI (Gemini) SDK within the backend endpoint. Implement logic to call Gemini with appropriate prompts, handle API keys securely (via `.env`), process the AI response, and send results back to the frontend.
- [ ] **12. Email Sending Endpoint:** Create a backend API endpoint (e.g., `/api/send-summary`) that accepts the compiled task list and uses an email service/library (e.g., Nodemailer) to send the email. Requires secure configuration of email service credentials (via `.env`).
- [ ] **13. Frontend-Backend Integration (Email Sending):** Connect the frontend "Send Daily Summary" button to make a `fetch` request to the `/api/send-summary` backend endpoint, sending the compiled summary. Handle success/error feedback.
- [ ] **14. Refinement & Testing:** Polish animations, ensure responsiveness, test all functionality (including AI parsing and email sending) thoroughly across different scenarios.

**Proposed Code Structure:**

```
/project-root
│
├── index.html         # Main HTML structure
├── style.css          # CSS styles, color variables
├── script.js          # Core frontend logic (To-Do, DOM manipulation, event listeners)
├── three-animations.js # Three.js setup, scene creation, animation functions
├── PROJECT_PLAN.md    # Our development to-do list (this file)
│
└── /backend           # Required for AI parsing and email sending
    ├── server.js      # Node.js/Express server
    ├── package.json   # Backend dependencies (Express, @google/generative-ai, nodemailer, dotenv, etc.)
    └── .env           # Environment variables (GEMINI_API_KEY, EMAIL_USER, EMAIL_PASS, EMAIL_RECIPIENT - add to .gitignore)