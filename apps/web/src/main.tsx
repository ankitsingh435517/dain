import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import {
  createContext,
  StrictMode,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  type QueryFilters,
} from "@tanstack/react-query";
import "./index.css";
import App from "./App.tsx";
import { Toaster } from "sonner";
import axios, { type AxiosInstance } from "axios";

const queryClient = new QueryClient();

export function getDeviceId() {
  let id = localStorage.getItem("deviceId");
  if (!id) {
    id = crypto.randomUUID(); // same ID forever unless user clears localStorage
    localStorage.setItem("deviceId", id);
  }
  return id;
}

function getBrowserName() {
  const ua = navigator.userAgent;

  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  return "Unknown";
}

function getBrowserVersion() {
  const ua = navigator.userAgent;

  const match =
    ua.match(/(Firefox|Chrome|Edg|Safari)\/([\d.]+)/) ||
    ua.match(/Version\/([\d.]+)/);

  return match ? match[2] : "Unknown";
}

export function getDeviceInfo() {
  const ua = navigator.userAgent;
  const platform = navigator.platform;

  return {
    deviceId: getDeviceId(),
    deviceName: navigator.userAgent, // Browser doesn't expose human-readable device name
    deviceType: /Mobile|Android|iPhone/.test(ua) ? "Mobile" : "Desktop",
    platform, // e.g. "Win32", "MacIntel", "Linux x86_64"
    userAgent: ua,
    browser: getBrowserName(),
    browserVersion: getBrowserVersion(),
  };
}

// intercepting 401 requests for refresh-token
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // important: sends httpOnly refresh cookie
}) as AxiosInstance & { _hasAuthInterceptor: boolean };

api.interceptors.request.use((config) => {
  config.headers["x-device-info"] = JSON.stringify(getDeviceInfo());
  return config;
});

export type User = {
  _id: string;
  email: string;
  name: string;
};
export const AuthContext = createContext({
  user: null,
  handleSaveUser: () => {},
} as {
  user: User | null;
  handleSaveUser: (userData: User | null) => void;
});

// Module-scope shared promise to avoid concurrent refreshes
let refreshPromise: Promise<any> | null = null;

function refreshRequest() {
  return api.post("/refresh-token").then((r) => r.data);
}

// setup interceptor
function setupInterceptors(queryClient: QueryClient) {
  // ensure we only add interceptor once
  if (api._hasAuthInterceptor) return;
  api._hasAuthInterceptor = true;

  api.interceptors.response.use(
    (res) => res,
    async (error) => {
      const original = error.config;
      if (!original) return Promise.reject(error);

      // if 401 and not already retried
      if (error?.response?.status === 401 && !original._retry) {
        original._retry = true;

        try {
          if (!refreshPromise) {
            refreshPromise = queryClient
              .fetchQuery({
                queryKey: ["auth", "refresh"],
                queryFn: () => refreshRequest(),
                retry: false,
                staleTime: 0, // do not retry or keep stale long
              })
              .then((data) => {
                refreshPromise = null;
                return data;
              })
              .catch((e) => {
                refreshPromise = null;
                throw e;
              });
          }
          const data = await refreshPromise; // wait for refresh result
          const newAccess = data.accessToken;
          // attach to axios for subsequent requests
          api.defaults.headers.common["Authorization"] = `Bearer ${newAccess}`;
          original.headers["Authorization"] = `Bearer ${newAccess}`;

          // keep reac-query auth state in sync
          queryClient.setQueryData(["auth"], {
            accessToken: newAccess,
            user: data.user,
          });

          return api(original); // retry original request
        } catch (e) {
          // refresh failed -> clear cached auth and let caller handle (redirect to login)
          queryClient.removeQueries(["auth"] as QueryFilters);
          return Promise.reject(e);
        }
      }
      return Promise.reject(error);
    }
  );
}

function AuthProvider({
  queryClient,
  children,
}: {
  queryClient: QueryClient;
  children: React.ReactNode;
}) {
  // queryClient is passed from top-level react-query QueryClientProvider
  const [user, setUser] = useState<User | null>(null);
  const handleSaveUser = (userData: User | null) => {
    setUser(userData);
  };
  useEffect(() => {
    setupInterceptors(queryClient);

    // while app loads, try to refresh token to get user info
    // while refreshing, app can show a loader
    queryClient
      .fetchQuery({
        queryKey: ["auth"],
        queryFn: () => refreshRequest(),
        retry: false,
      })
      .then((data) => {
        console.log("data: ", data);
        api.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${data.accessToken}`;
        setUser(data.user);
      })
      .catch(() => {
        // no-session
      });
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ user, handleSaveUser }}>
      {children}
    </AuthContext.Provider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider queryClient={queryClient}>
        <App />
      </AuthProvider>
      <Toaster position="bottom-right" richColors />
    </QueryClientProvider>
  </StrictMode>
);
