import { registerPlugin } from '@capacitor/core';
import type { CiclopesLaneAnalysisPlugin } from './definitions';
import { CiclopesLaneAnalysisWeb } from './web';

const CiclopesLaneAnalysis = registerPlugin<CiclopesLaneAnalysisPlugin>(
  'CiclopesLaneAnalysis',
  { web: () => new CiclopesLaneAnalysisWeb() },
);

export * from './definitions';
export { CiclopesLaneAnalysis };
