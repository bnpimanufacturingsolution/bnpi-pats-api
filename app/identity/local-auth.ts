import { randomUUID } from "node:crypto";
import type { Request } from "express";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import type { IdentityDependencies, LocalAccountRepository, SubjectRepository, VerifiedIdentity } from "./types";

export const LOCAL_IDENTITY_PROVIDER = "local";
export const LOCAL_IDENTITY_ISSUER = "pats-local";
const LOCAL_TOKEN_TYPE = "pats-local-access";
const DEFAULT_TOKEN_TTL_SECONDS = 8 * 60 * 60;

interface LocalTokenPayload extends jwt.JwtPayload {
	sub: string;
	typ: typeof LOCAL_TOKEN_TYPE;
}

export interface LocalLoginResult {
	accessToken: string;
	tokenType: "Bearer";
	expiresIn: number;
}

export interface LocalAuthDependencies extends IdentityDependencies {
	login(username: string, password: string): Promise<LocalLoginResult | null>;
}

export interface LocalAuthOptions {
	tokenTtlSeconds?: number;
}

function normalizeUsername(username: string): string | null {
	const normalized = username.trim().toLowerCase();
	if (!/^[a-z0-9][a-z0-9._-]{2,127}$/.test(normalized)) return null;
	return normalized;
}

function bearerToken(request: Request): string | null {
	const authorization = request.header("Authorization");
	if (!authorization) return null;
	const match = /^Bearer\s+([^\s]+)$/i.exec(authorization.trim());
	return match?.[1] ?? null;
}

function toVerifiedIdentity(subject: Awaited<ReturnType<SubjectRepository["findById"]>>): VerifiedIdentity | null {
	if (!subject) return null;
	return {
		provider: subject.provider,
		issuer: subject.issuer,
		providerSubject: subject.providerSubject,
		subjectId: subject.id,
		displayName: subject.displayNameSnapshot,
		email: subject.emailSnapshot,
	};
}

export function createLocalAuthDependencies(
	subjects: SubjectRepository,
	accounts: LocalAccountRepository,
	secret: string,
	options: LocalAuthOptions = {},
): LocalAuthDependencies {
	const tokenTtlSeconds = options.tokenTtlSeconds ?? DEFAULT_TOKEN_TTL_SECONDS;
	if (!Number.isInteger(tokenTtlSeconds) || tokenTtlSeconds < 300 || tokenTtlSeconds > 24 * 60 * 60) {
		throw new Error("Local auth token TTL must be an integer between 300 and 86400 seconds.");
	}

	return {
			authenticator: {
			async authenticate(request: Request): Promise<VerifiedIdentity | null> {
				const token = bearerToken(request);
				if (!token) return null;

				let payload: LocalTokenPayload;
				try {
					payload = jwt.verify(token, secret, {
						algorithms: ["HS256"],
						issuer: LOCAL_IDENTITY_ISSUER,
					}) as LocalTokenPayload;
				} catch {
					return null;
				}
				if (payload.typ !== LOCAL_TOKEN_TYPE || typeof payload.sub !== "string") return null;

				return toVerifiedIdentity(await subjects.findById(payload.sub));
			},
		},
		subjects,
		async login(username: string, password: string): Promise<LocalLoginResult | null> {
			if (typeof username !== "string" || typeof password !== "string" || password.length === 0 || password.length > 1024) {
				return null;
			}

			const normalizedUsername = normalizeUsername(username);
			if (!normalizedUsername) return null;

			const credential = await accounts.findByUsername(normalizedUsername);
			if (!credential) return null;

			let passwordMatches = false;
			try {
				passwordMatches = await argon2.verify(credential.passwordHash, password);
			} catch {
				passwordMatches = false;
			}
			if (!passwordMatches) return null;

			const subject = await subjects.findById(credential.subjectId);
			if (!subject || subject.status !== "ACTIVE") return null;

			const accessToken = jwt.sign(
				{ sub: subject.id, typ: LOCAL_TOKEN_TYPE, jti: randomUUID() },
				secret,
				{
					algorithm: "HS256",
					issuer: LOCAL_IDENTITY_ISSUER,
					expiresIn: tokenTtlSeconds,
				},
			);
			await accounts.markLogin(subject.id, new Date());

			return { accessToken, tokenType: "Bearer", expiresIn: tokenTtlSeconds };
		},
	};
}
