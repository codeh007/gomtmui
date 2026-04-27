"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import {
  GOMTM_DASH_SERVER_URL_STORAGE_KEY,
  isValidGomtmServerUrl,
  normalizeGomtmServerUrl,
} from "./url";

type GomtmServerContextValue = {
  clearServerUrl: () => void;
  defaultServerUrl: string;
  isUsingDefault: boolean;
  saveServerUrl: () => boolean;
  serverUrl: string;
  serverUrlInput: string;
  setServerUrlInput: (value: string) => void;
};

type GomtmServerState = {
  serverUrl: string;
  serverUrlInput: string;
};

const GomtmServerContext = createContext<GomtmServerContextValue | null>(null);

export function getInitialGomtmServerState(defaultServerUrl: string): GomtmServerState {
  const normalizedDefaultServerUrl = normalizeGomtmServerUrl(defaultServerUrl);

  if (typeof window === "undefined") {
    return {
      serverUrl: normalizedDefaultServerUrl,
      serverUrlInput: normalizedDefaultServerUrl,
    };
  }

  const savedServerUrl = normalizeGomtmServerUrl(localStorage.getItem(GOMTM_DASH_SERVER_URL_STORAGE_KEY) ?? "");
  const nextServerUrl = isValidGomtmServerUrl(savedServerUrl) ? savedServerUrl : normalizedDefaultServerUrl;

  return {
    serverUrl: nextServerUrl,
    serverUrlInput: nextServerUrl,
  };
}

export function GomtmServerProvider({ children, defaultServerUrl }: { children: ReactNode; defaultServerUrl: string }) {
  const normalizedDefaultServerUrl = normalizeGomtmServerUrl(defaultServerUrl);
  const [state, setState] = useState(() => getInitialGomtmServerState(normalizedDefaultServerUrl));

  useEffect(() => {
    setState(getInitialGomtmServerState(normalizedDefaultServerUrl));
  }, [normalizedDefaultServerUrl]);

  const saveServerUrl = () => {
    const nextServerUrl = normalizeGomtmServerUrl(state.serverUrlInput);
    if (!isValidGomtmServerUrl(nextServerUrl)) {
      return false;
    }

    localStorage.setItem(GOMTM_DASH_SERVER_URL_STORAGE_KEY, nextServerUrl);
    setState({
      serverUrl: nextServerUrl,
      serverUrlInput: nextServerUrl,
    });
    return true;
  };

  const clearServerUrl = () => {
    localStorage.removeItem(GOMTM_DASH_SERVER_URL_STORAGE_KEY);
    setState({
      serverUrl: "",
      serverUrlInput: "",
    });
  };

  return (
    <GomtmServerContext.Provider
      value={{
        clearServerUrl,
        defaultServerUrl: normalizedDefaultServerUrl,
        isUsingDefault: state.serverUrl === normalizedDefaultServerUrl,
        saveServerUrl,
        serverUrl: state.serverUrl,
        serverUrlInput: state.serverUrlInput,
        setServerUrlInput: (value) => {
          setState((current) => ({
            ...current,
            serverUrlInput: value,
          }));
        },
      }}
    >
      {children}
    </GomtmServerContext.Provider>
  );
}

export function useGomtmServer() {
  const value = useContext(GomtmServerContext);
  if (value == null) {
    throw new Error("useGomtmServer must be used within GomtmServerProvider");
  }
  return value;
}
