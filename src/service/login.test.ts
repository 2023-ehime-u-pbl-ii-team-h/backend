import { Account } from "../model/account";
import { ID } from "../model/id";
import { Session } from "../model/session";
import { loginRedirect } from "./login";
import { expect, test, vi } from "vitest";

test("receive and process auth token", async () => {
  const accessTokenService = {
    acquireToken: () => Promise.resolve("zzzz"),
  };
  const acquireTokenSpy = vi.spyOn(accessTokenService, "acquireToken");
  const accountRepo = {
    getAccount: () =>
      Promise.resolve({
        id: "acc01" as ID<Account>,
        name: "TEST Account",
        email: "test.account@example.com",
        role: "STUDENT",
      }),
    addAccount: () => Promise.resolve(true),
  };
  const getAccountSpy = vi.spyOn(accountRepo, "getAccount");
  const addAccountSpy = vi.spyOn(accountRepo, "addAccount");
  const sessionRepo = {
    createLoginSession: (_account: Session) => Promise.resolve(),
  };
  const createLoginSessionSpy = vi.spyOn(sessionRepo, "createLoginSession");

  const returnUrl = await loginRedirect({
    query: {
      code: "xxxx",
      requestUrl: "https://example.com/request",
      returnUrl: "https://example.com/return",
      userAgent: "",
    },
    accessTokenService,
    verifierRepo: {
      load: () => Promise.resolve("yyyy"),
      store: () => Promise.resolve(),
    },
    userRepo: {
      getMe: () =>
        Promise.resolve({
          name: "TEST Account",
          email: "test.account@example.com",
        }),
    },
    accountRepo,
    sessionRepo,
    clock: {
      now: () => new Date("2024-01-01T11:43:58Z"),
    },
  });

  expect(returnUrl).toBe("https://example.com/return");
  expect(acquireTokenSpy).toHaveBeenCalledWith(
    "xxxx",
    "https://example.com/redirect",
    "yyyy",
  );
  expect(getAccountSpy).toHaveBeenCalledWith("test.account@example.com");
  expect(addAccountSpy).not.toHaveBeenCalled();
  const [[createdSession]] = createLoginSessionSpy.mock.calls;
  expect(createdSession.account).toStrictEqual({
    id: "acc01",
    name: "TEST Account",
    email: "test.account@example.com",
    role: "STUDENT",
  });
  expect(createdSession.loginAt).toStrictEqual(
    new Date("2024-01-01T11:43:58Z"),
  );
  expect(createdSession.deviceName).toBe("");
});
