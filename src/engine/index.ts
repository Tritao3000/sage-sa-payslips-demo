export {
  comparePayslips,
  getHighImportanceChanges,
  getChangesByCategory,
  getLineItemChanges,
  getAggregateChanges,
} from "./diff-engine";

export {
  generateFacts,
  getKeyFacts,
  getFactsByType,
  getCausalFacts,
  getAllSentences,
} from "./facts-generator";

export {
  narrateFacts,
  narrateFactsSimple,
  type NarratorConfig,
  type NarratorResult,
} from "./narrator";

export {
  runPipeline,
  compareSpecificPayslips,
  type PipelineResult,
  type PipelineOptions,
} from "./pipeline";

