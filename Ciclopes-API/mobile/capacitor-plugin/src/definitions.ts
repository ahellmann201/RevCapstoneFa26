export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface LaneCandidate {
  confidence: number;
  /** top-left, top-right, bottom-right, bottom-left */
  corners: [NormalizedPoint, NormalizedPoint, NormalizedPoint, NormalizedPoint];
}

export interface LaneFrameResult {
  frameWidth: number;
  frameHeight: number;
  candidates: LaneCandidate[];
  health: Record<string, number>;
}

export interface LaneAnalysisStatus {
  /** True only after a usable model/runtime is loaded. */
  available: boolean;
  reason?: string;
}

export interface AnalyzeFrameOptions {
  /** Local file URI readable by the Android application. */
  frameUri: string;
  width: number;
  height: number;
  rotation: number;
}

export interface ApplyLaneCorrectionOptions {
  /** Four corners in normalized coordinates, in lane-corner order. */
  corners: [NormalizedPoint, NormalizedPoint, NormalizedPoint, NormalizedPoint];
  coordinateSpace: 'normalized_frame';
}

export interface CiclopesLaneAnalysisPlugin {
  isAvailable(): Promise<LaneAnalysisStatus>;
  analyzeFrame(options: AnalyzeFrameOptions): Promise<LaneFrameResult>;
  applyLaneCorrection(options: ApplyLaneCorrectionOptions): Promise<{ accepted: boolean }>;
  release(): Promise<void>;
}
