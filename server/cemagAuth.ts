import type { Request, Response } from "express";
import { jwtVerify, SignJWT } from "jose";
import type { User } from "../drizzle/schema";
import { ENV } from "./_core/env";

export const CEMAG_ADMIN_EMAIL = "pcp1@cemag.com.br";
export const CEMAG_SESSION_COOKIE = "cemag_session";
export const CEMAG_SESSION_MAX_AGE_SECONDS = 48 * 60 * 60;
const CEMAG_EMAIL_REGEX = /^[^\s@]+@(cemag|itaueira)\.com\.br$/i;
const CEMAG_PASSWORD = "000000";

function parseCookieHeader(header: string) {
  return Object.fromEntries(header.split(";").map((part) => {
    const index = part.indexOf("=");
    if (index < 0) return ["", ""];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function serializeCookie(name: string, value: string, options: { httpOnly: boolean; secure: boolean; sameSite: "lax"; path: string; maxAge: number }) {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${options.maxAge}; Path=${options.path}; SameSite=Lax${options.httpOnly ? "; HttpOnly" : ""}${options.secure ? "; Secure" : ""}`;
}

function secretKey() {
  return new TextEncoder().encode(ENV.cookieSecret || "cemag-development-secret");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isCemagEmail(email: string) {
  return CEMAG_EMAIL_REGEX.test(normalizeEmail(email));
}

export function isCemagAdmin(email: string) {
  return normalizeEmail(email) === CEMAG_ADMIN_EMAIL;
}

export function validateCemagCredentials(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  return isCemagEmail(normalizedEmail) && password === CEMAG_PASSWORD;
}

function userFromEmail(email: string): User {
  const now = new Date();
  return {
    id: -1,
    openId: `cemag:${email}`,
    name: email.split("@")[0],
    email,
    loginMethod: "cemag-password",
    role: isCemagAdmin(email) ? "admin" : "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

export async function createCemagSession(res: Response, req: Request, email: string) {
  const normalizedEmail = normalizeEmail(email);
  const now = Date.now();
  const token = await new SignJWT({
    email: normalizedEmail,
    role: isCemagAdmin(normalizedEmail) ? "admin" : "user",
    lastActivity: now,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${CEMAG_SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());

  res.setHeader("Set-Cookie", serializeCookie(CEMAG_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: req.protocol === "https" || req.headers["x-forwarded-proto"] === "https",
    sameSite: "lax",
    path: "/",
    maxAge: CEMAG_SESSION_MAX_AGE_SECONDS,
  }));
}

export async function readCemagSession(req: Request): Promise<User | null> {
  const token = parseCookieHeader(req.headers.cookie || "")[CEMAG_SESSION_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const email = typeof payload.email === "string" ? normalizeEmail(payload.email) : "";
    const lastActivity = typeof payload.lastActivity === "number" ? payload.lastActivity : 0;
    if (!email || !isCemagEmail(email) || !lastActivity || Date.now() - lastActivity >= CEMAG_SESSION_MAX_AGE_SECONDS * 1000) return null;
    return userFromEmail(email);
  } catch {
    return null;
  }
}

export function clearCemagSession(res: Response, req: Request) {
  if (typeof res.setHeader === "function") {
    res.setHeader("Set-Cookie", serializeCookie(CEMAG_SESSION_COOKIE, "", {
      httpOnly: true,
      secure: req.protocol === "https" || req.headers["x-forwarded-proto"] === "https",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    }));
  }
}
