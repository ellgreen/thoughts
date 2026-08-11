import { api } from "@/lib/api";
import { useCallback, useEffect, useRef, useState } from "react";

export interface GifResult {
  preview_url: string;
  url: string;
  width?: number;
  height?: number;
}

interface GifSearchPage {
  results: GifResult[];
  page: number;
  has_next: boolean;
}

export type GifSearchStatus = "idle" | "loading" | "loading-more" | "error";

const debounceMs = 300;

export function useGifSearch(query: string, enabled: boolean) {
  const [results, setResults] = useState<GifResult[]>([]);
  const [status, setStatus] = useState<GifSearchStatus>("idle");
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  // Requests can land out of order; only the newest one may touch state.
  const latest = useRef(0);

  const fetchPage = useCallback(async (q: string, nextPage: number) => {
    const id = ++latest.current;

    setStatus(nextPage === 1 ? "loading" : "loading-more");

    try {
      const res = await api.get<GifSearchPage>("/api/gifs", {
        params: { q, page: nextPage },
      });

      if (id !== latest.current) return;

      setResults((prev) =>
        nextPage === 1 ? res.data.results : [...prev, ...res.data.results],
      );
      setPage(res.data.page);
      setHasNext(res.data.has_next);
      setStatus("idle");
    } catch {
      if (id !== latest.current) return;

      setStatus("error");
      setHasNext(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const trimmed = query.trim();

    // Trending needs no debounce; typing does.
    const timer = setTimeout(() => fetchPage(trimmed, 1), trimmed ? debounceMs : 0);

    return () => clearTimeout(timer);
  }, [query, enabled, fetchPage]);

  const loadMore = useCallback(() => {
    if (status !== "idle" || !hasNext) return;

    fetchPage(query.trim(), page + 1);
  }, [status, hasNext, query, page, fetchPage]);

  return { results, status, hasNext, loadMore };
}
