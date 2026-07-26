import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Card } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Zap } from "lucide-react";

export default function PlanLimitsIndicator() {
  const limits = usePlanLimits();

  const getChipStatus = () => {
    if (limits.chipsRemaining <= 0) {
      return { color: "text-red-500", bg: "bg-red-500/10", icon: AlertCircle };
    }
    if (limits.chipsRemaining <= 2) {
      return { color: "text-yellow-500", bg: "bg-yellow-500/10", icon: AlertCircle };
    }
    return { color: "text-green-500", bg: "bg-green-500/10", icon: CheckCircle2 };
  };

  const getTaskStatus = () => {
    if (limits.tasksRemaining <= 0) {
      return { color: "text-red-500", bg: "bg-red-500/10", icon: AlertCircle };
    }
    if (limits.tasksRemaining <= 2) {
      return { color: "text-yellow-500", bg: "bg-yellow-500/10", icon: AlertCircle };
    }
    return { color: "text-green-500", bg: "bg-green-500/10", icon: CheckCircle2 };
  };

  const chipStatus = getChipStatus();
  const taskStatus = getTaskStatus();
  const ChipIcon = chipStatus.icon;
  const TaskIcon = taskStatus.icon;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Chips Limit */}
      <Card className="bg-gray-900 border-gray-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-300">Chips</h3>
          <ChipIcon className={`${chipStatus.color}`} size={18} />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-2xl font-bold text-cyan-500">{limits.chipsRemaining}</span>
            <span className="text-xs text-gray-500">de {limits.maxChips}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${chipStatus.color.replace("text-", "bg-")}`}
              style={{ width: `${(limits.chipCount / limits.maxChips) * 100}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Tasks Limit */}
      <Card className="bg-gray-900 border-gray-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-300">Tarefas</h3>
          <TaskIcon className={`${taskStatus.color}`} size={18} />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-2xl font-bold text-blue-400">{limits.tasksRemaining}</span>
            <span className="text-xs text-gray-500">de {limits.maxTasks}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${taskStatus.color.replace("text-", "bg-")}`}
              style={{ width: `${(limits.taskCount / limits.maxTasks) * 100}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Messages Limit */}
      <Card className="bg-gray-900 border-gray-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-300">Mensagens</h3>
          <Zap className="text-cyan-400" size={18} />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-2xl font-bold text-cyan-400">
              {limits.messagesRemaining === -1 ? "∞" : limits.messagesRemaining}
            </span>
            <span className="text-xs text-gray-500">
              {limits.messagesRemaining === -1 ? "ilimitado" : `de ${limits.maxMessages}`}
            </span>
          </div>
          {limits.messagesRemaining !== -1 && (
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-cyan-400 transition-all"
                style={{ width: `${(limits.messageCount / limits.maxMessages) * 100}%` }}
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
