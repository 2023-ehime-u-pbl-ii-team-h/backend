import { generatePkceKeys } from "../model/auth";
import { UAParser } from "ua-parser-js";
import {
  AccountRepository,
  getOrNewAccount,
} from "../service/get-or-new-account";
import { Session, Clock } from "../model/session";

export const REDIRECT_API_PATH = "/redirect";

export interface VerifierRepository {
  store(verifier: string): Promise<void>;
  load(): Promise<string>;
}

export interface LoginQueryService {
  requestUrl: string;
  requestReferer: string | undefined;
}

export interface AuthorizeUrlService {
  buildAuthorizeUrl(
    challenge: string,
    redirectUri: string,
    referer?: string,
  ): string;
}

export async function login(
  query: LoginQueryService,
  authorizeUrl: AuthorizeUrlService,
  verifierRepo: VerifierRepository,
): Promise<string> {
  const { verifier, challenge } = await generatePkceKeys();

  verifierRepo.store(verifier);

  return authorizeUrl.buildAuthorizeUrl(
    challenge,
    new URL(REDIRECT_API_PATH, query.requestUrl).toString(),
    query.requestReferer,
  );
}

export interface LoginRedirectQueryService {
  requestUrl: string;
  code: string;
  userAgent: string;
  returnUrl: string;
}

export interface AccessTokenService {
  acquireToken(
    code: string,
    redirectUri: string,
    verifier: string,
  ): Promise<string>;
}

export interface UserRepository {
  getMe(token: string): Promise<{ email: string; name: string }>;
}

export interface LoginRepository {
  createLoginSession(newSession: Session): Promise<void>;
}

export interface LoginRedirectDeps {
  query: LoginRedirectQueryService;
  accessTokenService: AccessTokenService;
  verifierRepo: VerifierRepository;
  userRepo: UserRepository;
  accountRepo: AccountRepository;
  sessionRepo: LoginRepository;
}

export async function loginRedirect({
  query,
  accessTokenService,
  verifierRepo,
  userRepo,
  accountRepo,
  sessionRepo,
}: LoginRedirectDeps): Promise<string> {
  const verifier = await verifierRepo.load();
  await verifierRepo.store("");

  const accessToken = await accessTokenService.acquireToken(
    query.code,
    new URL(REDIRECT_API_PATH, query.requestUrl).toString(),
    verifier,
  );

  const { email, name } = await userRepo.getMe(accessToken);

  const parser = new UAParser(query.userAgent);
  const parserResults = parser.getResult();

  const account = await getOrNewAccount(accountRepo, email, name);
  if (!account) {
    throw new Error("failure to get account");
  }
  const clock: Clock = {
    now: () => new Date(),
  };
  const newSession = Session.newSession(
    clock,
    account,
    parserResults.device.type + parserResults.browser.name,
  );
  sessionRepo.createLoginSession(newSession);
  return query.returnUrl;
}
