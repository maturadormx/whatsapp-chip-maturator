export interface ExecutionAction {
  type: string;
  payload: Record<string, unknown>;
}

export interface ExecutionPlan {
  id: string;
  factId: string;
  actions: ExecutionAction[];
  metadata: Record<string, unknown>;
  createdAt: string;
}
