import { cursorWorkflowArgs, planCursorAutomations, WORKSPACE_REPOS } from "../../kit/src/quality-loops/cursorFleet.js";

export function workflowLogicalNames(kitRoot: string): string[] {
  return planCursorAutomations(WORKSPACE_REPOS, kitRoot).map((item) => cursorWorkflowArgs(item).logicalName);
}
