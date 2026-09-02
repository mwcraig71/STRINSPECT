export interface PhotoItem {
  uri: string;
  description: string;
  heading?: number | null;
}

export interface DefectRecord {
  id: string;
  location: string;
  elementId: string;
  element: string;
  environment: string;
  defect: string;
  defectId: string;
  cs: "CS1" | "CS2" | "CS3" | "CS4";
  conditionQuantities?: Partial<Record<"CS1" | "CS2" | "CS3" | "CS4", string>>;
  quantityValue: string;
  maintenanceQuantityValue: string;
  quantity: string;
  size: string;
  locationDesc: string;
  photosCount: number;
  photos?: PhotoItem[];
  isCritical: boolean;
  isMaintenance: boolean;
  needsVerification: boolean;
  isLegacy: boolean;
  isImported?: boolean;
}

export interface SubComponent {
  name: string;
  desc: string;
  min: string;
  rating: string;
  comments: string;
  previousRating?: string;
  previousDesc?: string;
  previousMin?: string;
  previousComments?: string;
  isImported?: boolean;
}

export interface NbiRating {
  item: string;
  description: string;
  subComponents: SubComponent[];
}

export interface ImportSectionAudit {
  item: string;
  description: string;
  filled: number;
  total: number;
  hasData: boolean;
}

export interface ImportSummary {
  timestamp: number;
  structureNumber: string;
  structureNumberFound: boolean;
  elementsFound: number;
  elementRecordsCreated: number;
  nbiFilledCount: number;
  nbiTotalCount: number;
  sections: ImportSectionAudit[];
  emptySections: ImportSectionAudit[];
  unmatchedComponents: string[];
  /** Agency asset identifier when it differs from the structure number (SCDOT Asset ID). */
  assetId?: string;
  agency?: string;
  /** Records created from itemised "[elem, CSn, Qn]" defect notes (SCDOT). */
  taggedDefectRecords?: number;
  /** Parser notes for the inspector: roll-up mismatches, ambiguous values, unattributed captions. */
  warnings?: string[];
}

export interface SessionData {
  structureNumber?: string;
  teamLeader?: string | null;
  teamMembers?: string[];
  inspectionDate?: string | null;
  weather?: string | null;
  equipmentUsed?: string | null;
  defects?: DefectRecord[];
  nbiRatings?: NbiRating[];
  importSummary?: ImportSummary | null;
}
