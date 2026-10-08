import { useEffect, useState } from "react";
import { useLive } from "./live.tsx";

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export type Loadable<T> = { data?: T; error?: ApiError; loading: boolean };

/**
 * Fetches `url` and fetches it again whenever headquarters changes on disk, so
 * pages stay current while agents write. Pass `null` to skip.
 */
export function useApi<T>(url: string | null): Loadable<T> {
  const { version } = useLive();
  const [state, setState] = useState<Loadable<T>>({ loading: true });

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    api<T>(url)
      .then((data) => !cancelled && setState({ data, loading: false }))
      .catch((error: ApiError) => !cancelled && setState({ error, loading: false }));
    return () => {
      cancelled = true;
    };
  }, [url, version]);

  // A new url clears the old data so a page never shows the previous file.
  const [shownUrl, setShownUrl] = useState(url);
  if (shownUrl !== url) {
    setShownUrl(url);
    setState({ loading: true });
  }

  return state;
}

export const q = encodeURIComponent;
