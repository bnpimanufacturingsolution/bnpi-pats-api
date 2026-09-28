-- Park the paper PMRS Control No outside Project/Lot. User-provided workbook
-- analysis identifies it as a decoration requisition/run/destination/revision
-- composite (NEEDS_CONFIRMATION); it is not canonical PATS Project identity.
-- The only stored values were auto-suggestions from the unconfirmed pattern.
ALTER TABLE "Lot" DROP COLUMN "controlNumber";
