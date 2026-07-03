import { useEffect, useRef } from "react";
import {
  loadMetaFacebookSdk,
  META_FB_LOGIN_SCOPES,
  parseMetaFacebookXfbml,
  registerMetaFacebookCheckLoginState,
  type MetaFbLoginResponse,
} from "@/lib/metaFacebookSdk";

type Props = {
  appId: string;
  /** Opcjonalny config_id z Meta Login Button (Facebook Login for Business). */
  configId?: string | null;
  disabled?: boolean;
  onLoginStatusChange: (response: MetaFbLoginResponse) => void;
};

function buildLoginButtonMarkup(configId?: string | null): string {
  if (configId?.trim()) {
    return `<fb:login-button config_id="${configId.trim()}" onlogin="checkLoginState();"></fb:login-button>`;
  }
  return `<div class="fb-login-button" data-size="large" data-button-type="continue_with" data-scope="${META_FB_LOGIN_SCOPES}" data-onlogin="checkLoginState"></div>`;
}

/** Oficjalny przycisk Facebook Login (XFBML) z callbackiem checkLoginState → FB.getLoginStatus. */
export function MetaFacebookLoginButton({ appId, configId, disabled, onLoginStatusChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled || !appId) return;

    const unregister = registerMetaFacebookCheckLoginState(onLoginStatusChange);

    let cancelled = false;
    void loadMetaFacebookSdk(appId)
      .then(() => {
        if (cancelled || !containerRef.current) return;
        parseMetaFacebookXfbml(containerRef.current);
      })
      .catch((e) => {
        console.warn("[Meta FB Login Button]", e);
      });

    return () => {
      cancelled = true;
      unregister();
    };
  }, [appId, configId, disabled, onLoginStatusChange]);

  if (disabled || !appId) return null;

  return (
    <div
      ref={containerRef}
      className="inline-flex min-h-[40px] items-center [&_.fb-login-button]:!opacity-100"
      dangerouslySetInnerHTML={{ __html: buildLoginButtonMarkup(configId) }}
    />
  );
}
