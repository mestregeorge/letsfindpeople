/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from "react";
import { getCatalog } from "../lib/catalogService";

const DbDataContext = createContext(null);

/**
 * Provides the catalog data (categories/subcategories/keywords) fetched from
 * the backend with localStorage caching.  All children that call useDbData()
 * share the same single fetch.
 */
export function DbDataProvider({ children }) {
  const [dbData, setDbData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getCatalog()
      .then(({ categories }) => {
        if (!cancelled) {
          setDbData({ categories });
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("[DbDataProvider] Failed to load catalog:", err);
          setError(err.message);
          setIsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <DbDataContext.Provider value={{ dbData, isLoading, error }}>
      {children}
    </DbDataContext.Provider>
  );
}

/** Returns { dbData, isLoading, error } */
export function useDbData() {
  return useContext(DbDataContext);
}
