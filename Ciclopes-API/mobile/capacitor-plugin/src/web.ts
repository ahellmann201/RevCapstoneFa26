import { WebPlugin } from '@capacitor/core';
import type {
  AnalyzeFrameOptions,
  ApplyLaneCorrectionOptions,
  CiclopesLaneAnalysisPlugin,
  LaneAnalysisStatus,
  LaneFrameResult,
} from './definitions';

/** Browser/iOS fallback. Local ONNX inference is intentionally Android-only. */
export class CiclopesLaneAnalysisWeb extends WebPlugin implements CiclopesLaneAnalysisPlugin {
  async isAvailable(): Promise<LaneAnalysisStatus> {
    return { available: false, reason: 'Local Ciclopes inference is available only on Android.' };
  }

  async analyzeFrame(_options: AnalyzeFrameOptions): Promise<LaneFrameResult> {
    throw this.unavailable();
  }

  async applyLaneCorrection(_options: ApplyLaneCorrectionOptions): Promise<{ accepted: boolean }> {
    throw this.unavailable();
  }

  async release(): Promise<void> {}

  private unavailable(): Error {
    return this.unimplemented('Local Ciclopes inference is not available on this platform.');
  }
}
