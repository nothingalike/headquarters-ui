import type { ComponentType } from "react";
import type { ReportBundle } from "../../../shared/types.ts";
import { TodoReportView } from "./TodoReportView.tsx";

export type ReportViewProps = { bundle: ReportBundle };

/**
 * One view per report type. To add a kind of report, write its view here and
 * teach the `hq-ui-report` skill its `report.json` shape.
 */
export const REPORT_VIEWS: Record<string, ComponentType<ReportViewProps>> = {
  todo: TodoReportView,
};
