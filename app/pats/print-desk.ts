import type { Request } from "express";
import { clampGloryLWidthMm, GLORY_L_DEFAULTS, renderLabel, type LabelIr } from "./label-ir";
import { selectPrintPort, type PrintPortResult } from "./print-ports";
import { resolvePrinterBinding, type PrintJobStation } from "./print-job";

export type DeskPrintResult = PrintPortResult & {
	language: string;
	address: string | null;
};

export function isLoopbackRequest(req: Request): boolean {
	const candidates = [req.ip, req.socket.remoteAddress, ...(req.ips ?? [])];
	return candidates.some((value) => {
		if (!value) return false;
		return (
			value === "127.0.0.1" ||
			value === "::1" ||
			value === "::ffff:127.0.0.1" ||
			value.endsWith("127.0.0.1")
		);
	});
}

export function allowUnauthenticatedDeskPrint(req: Request): boolean {
	return process.env.ENABLE_TEST_MODE === "true" && isLoopbackRequest(req);
}

export function deskStationFromEnv(): PrintJobStation {
	const windowsName = process.env.PATS_PRINTER_WINDOWS_NAME?.trim() || null;
	const network = process.env.PATS_PRINTER_ADDRESS?.trim() || null;
	return {
		id: "desk",
		name: "Desk Glory-L",
		stageId: "desk",
		printerConnection: windowsName ? "USB_AGENT" : network ? "NETWORK" : null,
		printerAddress: windowsName ? `winspool:${windowsName}` : network,
		printerLanguage: "ZPL",
		printerDpi: GLORY_L_DEFAULTS.dpi,
		labelWidthMm: GLORY_L_DEFAULTS.widthMm,
		labelHeightMm: GLORY_L_DEFAULTS.heightMm,
	};
}

export async function deliverDeskLabel(ir: LabelIr): Promise<DeskPrintResult> {
	const binding = resolvePrinterBinding(deskStationFromEnv());
	if (!binding.address) {
		return {
			status: "FAILED",
			failureReason:
				"No desk printer configured. Set PATS_PRINTER_WINDOWS_NAME (USB) or PATS_PRINTER_ADDRESS (Ethernet).",
			language: "ZPL",
			address: null,
		};
	}

	const sized: LabelIr = {
		...ir,
		widthMm: clampGloryLWidthMm(ir.widthMm || binding.widthMm),
		heightMm: ir.heightMm || binding.heightMm,
		dpi: ir.dpi || binding.dpi,
	};
	const language = "ZPL";
	const payload = renderLabel(language, sized);
	const delivered = await selectPrintPort(binding.connection).deliver({
		address: binding.address,
		payload,
	});
	return { ...delivered, language, address: binding.address };
}
