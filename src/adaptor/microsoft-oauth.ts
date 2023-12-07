import { AccessTokenService, AuthorizeUrlService } from "../service/login";

const MICROSOFT_OAUTH_ROOT =
  "https://login.microsoftonline.com/organizations/oauth2/v2.0";
const AZURE_CLIENT_ID = "788aebee-7aa0-4286-b58c-7e35bf22e92a";
const AZURE_APP_SCOPE = "https://graph.microsoft.com/user.read";

export class MicrosoftOAuth implements AuthorizeUrlService, AccessTokenService {
  buildAuthorizeUrl(
    challenge: string,
    redirectUri: string,
    referer?: string,
  ): string {
    return (
      MICROSOFT_OAUTH_ROOT +
      "/authorize?" +
      new URLSearchParams({
        client_id: AZURE_CLIENT_ID,
        response_type: "code",
        redirect_uri: redirectUri,
        response_mode: "form_post",
        scope: AZURE_APP_SCOPE,
        state: referer ?? "",
        code_challenge: challenge,
        code_challenge_method: "S256",
      })
    );
  }

  async acquireToken(
    code: string,
    redirectUri: string,
    verifier: string,
  ): Promise<string> {
    const res = await fetch(MICROSOFT_OAUTH_ROOT + "/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "",
      },
      body: new URLSearchParams({
        client_id: AZURE_CLIENT_ID,
        scope: AZURE_APP_SCOPE,
        code: code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    });
    if (!res.ok) {
      throw new Error("token grant failure");
    }

    const { access_token: accessToken } = (await res.json()) as {
      access_token: string;
    };
    return accessToken;
  }
}
