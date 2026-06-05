export interface DefectRecord {
  id: string;
  location: string;
  elementId: string;
  element: string;
  environment: string;
  defect: string;
  defectId: string;
  cs: "CS1" | "CS2" | "CS3" | "CS4";
  quantityValue: string;
  maintenanceQuantityValue: string;
  quantity: string;
  size: string;
  locationDesc: string;
  photosCount: number;
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
}

export interface NbiRating {
  item: string;
  description: string;
  subComponents: SubComponent[];
}

export interface SessionData {
  structureNumber?: string;
  defects?: DefectRecord[];
  nbiRatings?: NbiRating[];
}
