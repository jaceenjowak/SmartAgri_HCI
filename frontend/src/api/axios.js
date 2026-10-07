import axios from "axios";

/* Dev: Vite proxy sends /api → http://localhost:5000. Prod: set Vite env VITE_API_BASE_URL. */
const baseURL =
  import.meta.env.VITE_API_BASE_URL ||
  "/api";

const API = axios.create({ baseURL });

// Attach JWT token to every request automatically
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("smartagri_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global error handling — auto-logout on 401
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("smartagri_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);

export default API;
