// Single axios instance for all SharePoint REST calls (CLAUDE.md §1/§3). No file outside this
// one may call axios directly. Auth rides the browser's SharePoint session cookie
// (withCredentials); write requests need an X-RequestDigest, which axios has no built-in
// equivalent for (unlike SPHttpClient), so a request interceptor fetches/caches one from
// /_api/contextinfo and attaches it to every non-GET request.

import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

interface ISpfxWindow {
  _siteUrl?: string;
}

/** Site URL published on `window` by RequisitionWebPart.render. */
export function getSiteUrl(): string {
  const siteUrl = (window as unknown as ISpfxWindow)._siteUrl;
  if (!siteUrl) {
    throw new Error('SPFx context is not available on window.');
  }
  return siteUrl;
}

const api: AxiosInstance = axios.create({
  withCredentials: true,
  headers: {
    Accept: 'application/json;odata=nometadata',
    'Content-Type': 'application/json;odata=nometadata',
    'odata-version': '',
  },
});

/** Cached X-RequestDigest; SharePoint digests are time-limited (~30 min by default). */
let digestCache: { value: string; expiresAt: number } | null = null;

async function fetchDigest(): Promise<string> {
  const response = await axios.post<{ FormDigestValue: string; FormDigestTimeoutSeconds: number }>(
    `${getSiteUrl()}/_api/contextinfo`,
    null,
    { withCredentials: true, headers: { Accept: 'application/json;odata=nometadata', 'odata-version': '' } },
  );
  const { FormDigestValue, FormDigestTimeoutSeconds } = response.data;
  // Refresh a little early so a request never races a digest that expires mid-flight.
  digestCache = { value: FormDigestValue, expiresAt: Date.now() + (FormDigestTimeoutSeconds - 30) * 1000 };
  return FormDigestValue;
}

function getDigest(): Promise<string> {
  if (digestCache && digestCache.expiresAt > Date.now()) return Promise.resolve(digestCache.value);
  return fetchDigest();
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if ((config.method ?? 'get').toLowerCase() !== 'get') {
    config.headers.set('X-RequestDigest', await getDigest());
  }
  return config;
});

export default api;
