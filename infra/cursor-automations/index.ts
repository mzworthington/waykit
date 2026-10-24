import * as cursor from "@pulumi/cursor";
import * as pulumi from "@pulumi/pulumi";
import { fileURLToPath } from "node:url";
import { cursorWorkflowArgs, planCursorAutomations, WORKSPACE_REPOS } from "../../kit/src/quality-loops/cursorFleet.js";
import { workflowLogicalNames } from "./program.js";

export const stackEntryExportsPlan = workflowLogicalNames;

const kitRoot = fileURLToPath(new URL("../..", import.meta.url));

function insidePulumi(): boolean {
  return (process.env.PULUMI_NODEJS_STACK ?? "") !== "";
}

function defineWorkflows(): pulumi.Output<string>[] {
  const provider = new cursor.Provider("cursor", {
    token: new pulumi.Config("cursor").requireSecret("token")
  });
  return planCursorAutomations(WORKSPACE_REPOS, kitRoot).map((item) => {
    const args = cursorWorkflowArgs(item);
    const workflow = new cursor.PlatformWorkflow(
      args.logicalName,
      {
        name: args.name,
        prompt: args.prompt,
        enabled: args.enabled,
        memoryEnabled: args.memoryEnabled,
        gitRepo: args.gitRepo,
        disabledDefaultTools: args.disabledDefaultTools ? [...args.disabledDefaultTools] : undefined,
        triggers: args.triggers.map((trigger) => {
          if ("cron" in trigger) {
            return { cron: { schedule: trigger.cron.schedule } };
          }
          return {
            gitPullRequest: {
              repos: [...trigger.gitPullRequest.repos],
              prAction: trigger.gitPullRequest.prAction
            }
          };
        }),
        actions: args.actions.map((action) => {
          if ("mcp" in action) {
            return { mcp: { server: action.mcp.server } };
          }
          return { gitPr: {} };
        })
      },
      { provider }
    );
    return workflow.id;
  });
}

export const workflowIds = insidePulumi() ? defineWorkflows() : [];
