/**
 * Transaction Types
 * Type definitions for transaction operations
 */

import {
	Transaction,
	TransactionStatus,
	TransactionType,
	PaymentMethod,
} from "../../generated/prisma";
import {
	type CheckPaymentDetails,
	type CashPaymentDetails,
	type BankTransferPaymentDetails,
	type OnlinePaymentDetails,
} from "../../zod/transaction.zod";

// ============================================================================
// DTO TYPES
// ============================================================================

export interface CreateTransactionDto {
	workspaceId: string;
	projectId: string;
	transactionNumber?: string;
	transactionDate: Date;
	payeeName: string;
	amount: number;
	transactionType: TransactionType;
	status?: TransactionStatus;
	paymentMethod?: PaymentMethod;
	documentUrls?: string[];
	idempotencyKey?: string;
	checkDetails?: CheckPaymentDetails | null;
	cashDetails?: CashPaymentDetails | null;
	bankTransferDetails?: BankTransferPaymentDetails | null;
	onlineDetails?: OnlinePaymentDetails | null;
	itemId?: string;
	purchaseOrderId?: string;
	userId?: string;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

export interface CreateTransactionResult {
	transaction: Transaction;
}
