param(
	[Parameter(Mandatory = $true)][string]$PrinterName,
	[Parameter(Mandatory = $true)][string]$FilePath
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $FilePath)) {
	Write-Error "Print file not found: $FilePath"
	exit 2
}

Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class PatsRawPrinter {
	[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
	public class DOCINFOA {
		[MarshalAs(UnmanagedType.LPStr)] public string pDocName;
		[MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
		[MarshalAs(UnmanagedType.LPStr)] public string pDataType;
	}

	[DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true)]
	public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

	[DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true)]
	public static extern bool ClosePrinter(IntPtr hPrinter);

	[DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true)]
	public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

	[DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true)]
	public static extern bool EndDocPrinter(IntPtr hPrinter);

	[DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true)]
	public static extern bool StartPagePrinter(IntPtr hPrinter);

	[DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true)]
	public static extern bool EndPagePrinter(IntPtr hPrinter);

	[DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true)]
	public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

	public static void SendBytes(string printerName, byte[] bytes) {
		IntPtr hPrinter;
		if (!OpenPrinter(printerName.Normalize(), out hPrinter, IntPtr.Zero)) {
			throw new InvalidOperationException("OpenPrinter failed for '" + printerName + "'.");
		}
		var di = new DOCINFOA();
		di.pDocName = "PATS Glory-L ZPL";
		di.pDataType = "RAW";
		try {
			if (!StartDocPrinter(hPrinter, 1, di)) {
				throw new InvalidOperationException("StartDocPrinter failed.");
			}
			try {
				if (!StartPagePrinter(hPrinter)) {
					throw new InvalidOperationException("StartPagePrinter failed.");
				}
				IntPtr pBytes = Marshal.AllocCoTaskMem(bytes.Length);
				try {
					Marshal.Copy(bytes, 0, pBytes, bytes.Length);
					int written;
					if (!WritePrinter(hPrinter, pBytes, bytes.Length, out written) || written != bytes.Length) {
						throw new InvalidOperationException("WritePrinter failed.");
					}
				} finally {
					Marshal.FreeCoTaskMem(pBytes);
					EndPagePrinter(hPrinter);
				}
			} finally {
				EndDocPrinter(hPrinter);
			}
		} finally {
			ClosePrinter(hPrinter);
		}
	}
}
"@

$bytes = [System.IO.File]::ReadAllBytes($FilePath)
[PatsRawPrinter]::SendBytes($PrinterName, $bytes)
