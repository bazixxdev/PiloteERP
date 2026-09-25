import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { SECURITY_ACTORS, signInActor } from "./fixtures";

const prisma = new PrismaClient();

test.afterAll(async () => prisma.$disconnect());

test("SEC-09 — un reset invalide les deux sessions antérieures", async ({ baseURL }) => {
  const url = String(baseURL);
  const password = process.env.SECURITY_TEST_PASSWORD ?? "security-test-password-2026";
  const nextPassword = "security-reset-password-2026";
  const actor = SECURITY_ACTORS.resettable;
  const a = await signInActor(url, actor, password);
  const b = await signInActor(url, actor, password);
  const cookie = (state: typeof a) => state.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const session = async (state: typeof a) => {
    const response = await fetch(`${url}/api/auth/get-session`, { headers: { Cookie: cookie(state) } });
    return { response, body: await response.json() as { user?: unknown } | null };
  };
  expect((await session(a)).body?.user).toBeTruthy();
  expect((await session(b)).body?.user).toBeTruthy();

  await prisma.mailOutbox.deleteMany({ where: { to: actor.email, kind: "password_reset" } });
  const requested = await fetch(`${url}/api/auth/request-password-reset`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: url },
    body: JSON.stringify({ email: actor.email, redirectTo: `${url}/reinitialiser` }),
  });
  expect(requested.ok).toBeTruthy();
  const mail = await prisma.mailOutbox.findFirst({ where: { to: actor.email, kind: "password_reset" }, orderBy: { createdAt: "desc" } });
  expect(mail?.link).toBeTruthy();
  const resetUrl = new URL(mail!.link!);
  const token = resetUrl.pathname.split("/").filter(Boolean).at(-1);
  expect(token).toBeTruthy();
  const reset = await fetch(`${url}/api/auth/reset-password`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: url },
    body: JSON.stringify({ token, newPassword: nextPassword }),
  });
  expect(reset.ok).toBeTruthy();

  expect((await session(a)).body?.user).toBeFalsy();
  expect((await session(b)).body?.user).toBeFalsy();
  const oldLogin = await fetch(`${url}/api/auth/sign-in/email`, { method: "POST", headers: { "Content-Type": "application/json", Origin: url }, body: JSON.stringify({ email: actor.email, password }) });
  expect(oldLogin.ok).toBeFalsy();
  const newLogin = await fetch(`${url}/api/auth/sign-in/email`, { method: "POST", headers: { "Content-Type": "application/json", Origin: url }, body: JSON.stringify({ email: actor.email, password: nextPassword }) });
  expect(newLogin.ok).toBeTruthy();
  const reused = await fetch(`${url}/api/auth/reset-password`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: url },
    body: JSON.stringify({ token, newPassword: "security-reset-password-reused-2026" }),
  });
  expect(reused.ok).toBeFalsy();
});
