import type { Request } from "express";

export type SubjectStatus = "ACTIVE" | "DISABLED";
export type SubjectAssignmentKind = "CAPABILITY" | "ROLE_BUNDLE";
export type SubjectAssignmentStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";

export interface VerifiedIdentity {
	provider: string;
	issuer: string;
	providerSubject: string;
	subjectId?: string;
	displayName?: string;
	email?: string;
}

export interface SubjectRecord {
	id: string;
	provider: string;
	issuer: string;
	providerSubject: string;
	displayNameSnapshot?: string;
	emailSnapshot?: string;
	status: SubjectStatus;
}

export interface SubjectAssignmentRecord {
	kind: SubjectAssignmentKind;
	key: string;
	status: SubjectAssignmentStatus;
}

export interface IdentityAuthenticator {
	authenticate(request: Request): Promise<VerifiedIdentity | null>;
}

export interface SubjectRepository {
	resolve(identity: VerifiedIdentity): Promise<SubjectRecord>;
	findById(subjectId: string): Promise<SubjectRecord | null>;
	listAssignments(subjectId: string): Promise<SubjectAssignmentRecord[]>;
}

export interface LocalCredentialRecord {
	subjectId: string;
	username: string;
	passwordHash: string;
}

export interface LocalAccountRepository {
	findByUsername(username: string): Promise<LocalCredentialRecord | null>;
	markLogin(subjectId: string, occurredAt: Date): Promise<void>;
}

export interface IdentityDependencies {
	authenticator: IdentityAuthenticator;
	subjects: SubjectRepository;
}

export class IdentityProviderUnavailableError extends Error {
	constructor(message = "The configured identity provider is unavailable.") {
		super(message);
		this.name = "IdentityProviderUnavailableError";
	}
}
