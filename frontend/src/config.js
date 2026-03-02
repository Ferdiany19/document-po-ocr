// Central config for the frontend application.
// In development, VITE_API_URL defaults to localhost.
// In production (Vercel), set VITE_API_URL in Vercel's Environment Variables.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default API_BASE_URL;
