from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable


@dataclass
class ResultadoAuditoria:
    criterio: str
    status: str
    detalhe: str


class AuditorSprint0:
    def __init__(self, log_content: str, app_logs: str = "") -> None:
        self.log_content = log_content or ""
        self.app_logs = app_logs or ""
        self.resultados: list[ResultadoAuditoria] = []

    @property
    def _all_logs(self) -> str:
        return f"{self.log_content}\n{self.app_logs}"

    def _registrar(self, criterio: str, aprovado: bool, detalhe_ok: str, detalhe_fail: str) -> ResultadoAuditoria:
        resultado = ResultadoAuditoria(
            criterio=criterio,
            status="✅" if aprovado else "❌",
            detalhe=detalhe_ok if aprovado else detalhe_fail,
        )
        self.resultados.append(resultado)
        return resultado

    def _contains(self, text: str, patterns: list[str], flags: int = re.IGNORECASE | re.MULTILINE) -> bool:
        return any(re.search(pattern, text, flags) for pattern in patterns)

    def _extract_metrics_block(self, marker: str) -> str:
        pattern = rf"{re.escape(marker)}\s*(.*?)(?=\n[A-Z][A-Z _-]{{2,}}:|\Z)"
        match = re.search(pattern, self.log_content, re.IGNORECASE | re.DOTALL)
        return match.group(1) if match else ""

    def _extract_section(self, marker: str) -> str:
        pattern = rf"===\s*{re.escape(marker)}\s*===\s*(.*?)(?=\n===|\Z)"
        match = re.search(pattern, self.log_content, re.IGNORECASE | re.DOTALL)
        return match.group(1) if match else ""

    def _extract_metric_value(self, block: str, metric_names: list[str]) -> float | None:
        for metric_name in metric_names:
            match = re.search(rf"^{re.escape(metric_name)}\s+([0-9]+(?:\.[0-9]+)?)$", block, re.MULTILINE)
            if match:
                return float(match.group(1))
        return None

    def auditar_redis_pong(self) -> ResultadoAuditoria:
        aprovado = self._contains(
            self.log_content,
            [r"redis-cli ping.*PONG", r"^\s*PONG\s*$"],
        )
        return self._registrar(
            "1. Redis PONG",
            aprovado,
            "Encontrado `PONG` nos logs de Redis.",
            "Não encontrei evidência de `redis-cli ping -> PONG`.",
        )

    def auditar_app_sem_erros(self) -> ResultadoAuditoria:
        base = self.app_logs or self.log_content
        encontrou_erro = self._contains(
            base,
            [
                r"ECONNREFUSED",
                r"\bFATAL\b",
                r"UnhandledPromiseRejection",
                r"\buncaught\b",
                r"\bError:\b",
            ],
        )
        return self._registrar(
            "2. App sem erros",
            not encontrou_erro,
            "Não encontrei erros fatais nos logs da aplicação.",
            "Encontrei erro fatal ou erro explícito nos logs da aplicação.",
        )

    def auditar_scheduler_publica(self) -> ResultadoAuditoria:
        aprovado = self._contains(
            self._all_logs,
            [
                r"\[Scheduler\]",
                r"scheduler\.triggered",
                r"scheduler_runs_total",
                r"scheduler_jobs_published_total",
                r"queue\.job\.published",
            ],
        )
        return self._registrar(
            "3. Scheduler publica",
            aprovado,
            "Encontrei evidência de execução/publicação do scheduler.",
            "Não encontrei evidência de publicação pelo scheduler.",
        )

    def auditar_worker_consome(self) -> ResultadoAuditoria:
        aprovado = self._contains(
            self._all_logs,
            [
                r"\[Worker\]",
                r"worker\.processed",
                r"worker\.batch\.completed",
                r"worker_jobs_processed_total",
                r"queue\.job\.processing",
            ],
        )
        return self._registrar(
            "4. Worker consome",
            aprovado,
            "Encontrei evidência de consumo/processamento pelo worker.",
            "Não encontrei evidência de consumo pelo worker.",
        )

    def auditar_pipeline_conclui(self) -> ResultadoAuditoria:
        aprovado = self._contains(
            self._all_logs,
            [
                r"\[Pipeline\]",
                r"pipeline\.completed",
                r"pipeline_completed_total",
                r"PlanExecuted",
            ],
        )
        return self._registrar(
            "5. Pipeline conclui",
            aprovado,
            "Encontrei evidência de conclusão da pipeline.",
            "Não encontrei evidência de conclusão da pipeline.",
        )

    def auditar_metricas_200(self) -> ResultadoAuditoria:
        before = self._extract_metrics_block("METRICS BEFORE")
        after = self._extract_metrics_block("METRICS AFTER")
        sem_erro = not self._contains(
            self.log_content,
            [
                r"Failed to connect",
                r"Connection refused",
                r"ECONNREFUSED",
                r"404 Not Found",
                r"500 Internal Server Error",
            ],
        )
        aprovado = bool(before.strip()) and bool(after.strip()) and sem_erro
        return self._registrar(
            "6. Métricas 200",
            aprovado,
            "Encontrei `METRICS BEFORE` e `METRICS AFTER` sem erro de conexão.",
            "Não encontrei os blocos BEFORE/AFTER ou houve erro de conexão no scrape.",
        )

    def auditar_vinte_metricas(self) -> ResultadoAuditoria:
        metricas = [
            "queue_jobs_published_total",
            "queue_jobs_consumed_total",
            "queue_pending_observations",
            "queue_active_jobs",
            "queue_failed_jobs",
            "queue_delayed_jobs",
            "queue_wait_seconds",
            "pipeline_started_total",
            "pipeline_completed_total",
            "pipeline_failed_total",
            "pipeline_processing_seconds",
            "worker_jobs_processed_total",
            "worker_jobs_failed_total",
            "worker_running",
            "worker_batch_processing_seconds",
            "scheduler_runs_total",
            "scheduler_jobs_published_total",
            "scheduler_publish_failures_total",
            "dlq_jobs_total",
            "dlq_current_size",
        ]
        ausentes = [metrica for metrica in metricas if metrica not in self.log_content]
        aprovado = not ausentes
        return self._registrar(
            "7. 20 métricas",
            aprovado,
            "As 20 métricas customizadas apareceram na saída coletada.",
            f"Faltaram métricas na saída: {', '.join(ausentes[:8])}{'...' if len(ausentes) > 8 else ''}",
        )

    def auditar_metricas_aumentam(self) -> ResultadoAuditoria:
        before = self._extract_metrics_block("METRICS BEFORE")
        after = self._extract_metrics_block("METRICS AFTER")
        nomes = ["queue_jobs_published_total", "queue_jobs_total"]
        before_value = self._extract_metric_value(before, nomes)
        after_value = self._extract_metric_value(after, nomes)
        aprovado = before_value is not None and after_value is not None and after_value > before_value
        return self._registrar(
            "8. Métricas aumentam",
            aprovado,
            f"A métrica de queue aumentou de {before_value} para {after_value}.",
            "Não consegui provar aumento das métricas de queue entre BEFORE e AFTER.",
        )

    def auditar_npm_test_verde(self) -> ResultadoAuditoria:
        block = self._extract_section("NPM TEST")
        has_pass = self._contains(block, [r"\bPASS\b", r"\bpassed\b", r"tests passing"], re.IGNORECASE)
        has_fail = self._contains(block, [r"\bFAIL\b", r"not ok", r"Test Files.*failed"], re.IGNORECASE)
        aprovado = has_pass and not has_fail
        return self._registrar(
            "9. npm test verde",
            aprovado,
            "Encontrei evidência de teste verde sem FAIL.",
            "Não encontrei evidência clara de `npm test` verde ou encontrei FAIL.",
        )

    def auditar_npm_build_verde(self) -> ResultadoAuditoria:
        block = self._extract_section("NPM BUILD")
        has_build = self._contains(block, [r"npm run build", r"vite v", r"\bbuilt in\b", r"⚡ Done"])
        has_error = self._contains(block, [r"\bERR!\b", r"\bBuild failed\b", r"failed to solve", r"\berror during build\b"], re.IGNORECASE)
        aprovado = has_build and not has_error
        return self._registrar(
            "10. npm build verde",
            aprovado,
            "Encontrei evidência de build concluído sem erro.",
            "Não encontrei evidência clara de build verde ou encontrei erro de build.",
        )

    def auditar_tudo(self) -> list[ResultadoAuditoria]:
        self.resultados = []
        checks: list[Callable[[], ResultadoAuditoria]] = [
            self.auditar_redis_pong,
            self.auditar_app_sem_erros,
            self.auditar_scheduler_publica,
            self.auditar_worker_consome,
            self.auditar_pipeline_conclui,
            self.auditar_metricas_200,
            self.auditar_vinte_metricas,
            self.auditar_metricas_aumentam,
            self.auditar_npm_test_verde,
            self.auditar_npm_build_verde,
        ]
        for check in checks:
            check()
        return self.resultados

    def gerar_veredito(self) -> str:
        if not self.resultados:
            self.auditar_tudo()

        falhas = sum(1 for item in self.resultados if item.status == "❌")
        if falhas > 0:
            return "🔴 NO-GO"

        avisos = sum(1 for item in self.resultados if item.status == "⚠️")
        if avisos > 0:
            return "🟡 WARN"

        return "🟢 GO"

    def gerar_relatorio(self) -> str:
        if not self.resultados:
            self.auditar_tudo()

        linhas = ["RELATÓRIO DE AUDITORIA SPRINT 0", ""]
        for item in self.resultados:
            linhas.append(f"{item.status} {item.criterio} — {item.detalhe}")

        aprovados = sum(1 for item in self.resultados if item.status == "✅")
        linhas.extend(
            [
                "",
                f"Aprovados: {aprovados}/{len(self.resultados)}",
                f"Veredito: {self.gerar_veredito()}",
            ]
        )
        return "\n".join(linhas)


if __name__ == "__main__":
    import argparse
    from pathlib import Path

    parser = argparse.ArgumentParser(description="Audita evidências da Sprint 0 e emite GO/NO-GO.")
    parser.add_argument("--log", required=True, help="Caminho para o arquivo sprint0-evidencias.log")
    parser.add_argument("--app-logs", default="", help="Caminho opcional para arquivo com logs do npm run dev")
    args = parser.parse_args()

    log_content = Path(args.log).read_text(encoding="utf-8")
    app_logs = Path(args.app_logs).read_text(encoding="utf-8") if args.app_logs else ""

    auditor = AuditorSprint0(log_content=log_content, app_logs=app_logs)
    auditor.auditar_tudo()
    print(auditor.gerar_relatorio())
