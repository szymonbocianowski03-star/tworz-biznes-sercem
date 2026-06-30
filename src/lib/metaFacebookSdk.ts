/** Wersja Graph API — zgodna z OAuth Meta w aplikacji. */
export const META_FB_SDK_VERSION = "v21.0";

/** Uprawnienia zgodne z przepływem OAuth Meta (`meta.start`). */
export const META_FB_LOGIN_SCOPES = [
  "public_profile",
  "ads_read",
  "ads_management",
  "business_management",
].join(",");

export type MetaFbLoginStatus = "connected" | "not_authorized" | "unknown";

export type MetaFbAuthResponse = {
  accessToken: string;
  expiresIn: number;
  signedRequest?: string;
  userID: string;
};

export type MetaFbLoginResponse = {
  status: MetaFbLoginStatus;
  authResponse?: MetaFbAuthResponse | null;
};

type FacebookSdk = {
  init: (params: {
    appId: string;
    cookie?: boolean;
    xfbml?: boolean;
    version: string;
  }) => void;
  AppEvents: {
    logPageView: () => void;
  };
  getLoginStatus: (callback: (response: MetaFbLoginResponse) => void) => void;
  login: (
    callback: (response: MetaFbLoginResponse) => void,
    options?: { scope?: string; return_scopes?: boolean },
  ) => void;
  logout: (callback: (response: unknown) => void) => void;
  XFBML?: {
    parse: (node?: HTMLElement) => void;
  };
};

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
    /** Callback wywoływany przez atrybut onlogin przycisku Facebook Login (XFBML). */
    checkLoginState?: () => void;
  }
}

let loadPromise: Promise<FacebookSdk> | null = null;

function normalizeLoginResponse(raw: MetaFbLoginResponse): MetaFbLoginResponse {
  const auth = raw.authResponse;
  if (!auth || raw.status !== "connected") {
    return { status: raw.status, authResponse: auth ?? null };
  }
  return {
    status: raw.status,
    authResponse: {
      accessToken: auth.accessToken,
      expiresIn: auth.expiresIn,
      signedRequest: auth.signedRequest,
      userID: auth.userID,
    },
  };
}

/** Ładuje i inicjalizuje Facebook JavaScript SDK (connect.facebook.net/sdk.js). */
export function loadMetaFacebookSdk(appId: string): Promise<FacebookSdk> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Facebook SDK dostępne tylko w przeglądarce"));
  }
  if (!appId.trim()) {
    return Promise.reject(new Error("Brak META_APP_ID"));
  }
  if (window.FB) return Promise.resolve(window.FB);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      try {
        window.FB!.init({
          appId: appId.trim(),
          cookie: true,
          xfbml: true,
          version: META_FB_SDK_VERSION,
        });
        window.FB!.AppEvents.logPageView();
        resolve(window.FB!);
      } catch (e) {
        loadPromise = null;
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };

    if (document.getElementById("facebook-jssdk")) {
      const waitForFb = (attempts = 0) => {
        if (window.FB) {
          resolve(window.FB);
          return;
        }
        if (attempts > 50) {
          loadPromise = null;
          reject(new Error("Przekroczono czas oczekiwania na Facebook SDK"));
          return;
        }
        window.setTimeout(() => waitForFb(attempts + 1), 100);
      };
      waitForFb();
      return;
    }

    const js = document.createElement("script");
    js.id = "facebook-jssdk";
    js.async = true;
    js.defer = true;
    js.src = "https://connect.facebook.net/en_US/sdk.js";
    js.onerror = () => {
      loadPromise = null;
      reject(new Error("Nie udało się załadować Facebook SDK"));
    };
    const firstScript = document.getElementsByTagName("script")[0];
    firstScript?.parentNode?.insertBefore(js, firstScript);
  });

  return loadPromise;
}

/** FB.getLoginStatus — sprawdza, czy użytkownik jest zalogowany w Facebook i w aplikacji. */
export function getMetaFacebookLoginStatus(fb: FacebookSdk = window.FB!): Promise<MetaFbLoginResponse> {
  return new Promise((resolve) => {
    fb.getLoginStatus((response) => {
      resolve(normalizeLoginResponse(response));
    });
  });
}

/** FB.login — dialog logowania / autoryzacji aplikacji Meta. */
export function metaFacebookLogin(
  fb: FacebookSdk = window.FB!,
  scope: string = META_FB_LOGIN_SCOPES,
): Promise<MetaFbLoginResponse> {
  return new Promise((resolve) => {
    fb.login(
      (response) => {
        resolve(normalizeLoginResponse(response));
      },
      { scope, return_scopes: true },
    );
  });
}

export function metaFacebookStatusLabel(status: MetaFbLoginStatus): string {
  switch (status) {
    case "connected":
      return "Zalogowano w Facebook i autoryzowano aplikację";
    case "not_authorized":
      return "Zalogowano w Facebook — brak autoryzacji aplikacji";
    case "unknown":
      return "Brak aktywnej sesji Facebook";
  }
}

/**
 * Rejestruje globalny `window.checkLoginState` — wywoływany przez `onlogin` na przycisku FB Login (XFBML).
 * Wewnętrznie woła FB.getLoginStatus i przekazuje wynik do handlera.
 */
export function registerMetaFacebookCheckLoginState(
  handler: (response: MetaFbLoginResponse) => void,
): () => void {
  window.checkLoginState = () => {
    if (!window.FB) return;
    window.FB.getLoginStatus((response) => {
      handler(normalizeLoginResponse(response));
    });
  };
  return () => {
    delete window.checkLoginState;
  };
}

/** Parsuje znaczniki XFBML (np. fb:login-button) w podanym kontenerze. */
export function parseMetaFacebookXfbml(root?: HTMLElement | null): void {
  window.FB?.XFBML?.parse(root ?? undefined);
}
