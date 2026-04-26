from decimal import Decimal
from typing import Dict, List, Any
import ast
import operator

SAFE_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
}


class FormulaEngine:
    """Dynamic salary formula engine with DAG dependency resolution"""

    BUILTIN_FORMULAS = {
        "HRA": "BASIC * (HRA_PERCENT / 100)",
        "PF_EMPLOYEE": "min(BASIC, 15000) * 0.12",
        "PF_EMPLOYER": "min(BASIC, 15000) * 0.12",
        "ESI_EMPLOYEE": "GROSS * 0.0075 if GROSS <= 21000 else 0",
        "ESI_EMPLOYER": "GROSS * 0.0325 if GROSS <= 21000 else 0",
        "PT": "200 if GROSS >= 10000 else 0",
        "OT_AMOUNT": "(FULL_BASIC / 26 / SHIFT_HOURS) * OT_MULTIPLIER * OT_HOURS",
    }

    def evaluate_expression(self, expression: str, context: Dict[str, Any]) -> Decimal:
        """Safely evaluate a formula expression with given context variables."""
        safe_context = {
            "min": min,
            "max": max,
            "abs": abs,
            "round": round,
            **{k: Decimal(str(v)) for k, v in context.items() if v is not None},
        }
        try:
            result = eval(expression, {"__builtins__": {}}, safe_context)  # noqa: S307
            return Decimal(str(result)).quantize(Decimal("0.01"))
        except Exception as e:
            raise ValueError(f"Formula evaluation error: {e}")

    def resolve_dependencies(self, formulas: List[Dict]) -> List[Dict]:
        """Topological sort of formulas based on dependencies (DAG)."""
        graph = {f["output_variable"]: set(f.get("dependencies", [])) for f in formulas}
        formula_map = {f["output_variable"]: f for f in formulas}

        # Detect circular dependencies before sorting
        self._detect_cycles(graph)

        # Kahn's algorithm for topological sort
        in_degree = {node: 0 for node in graph}
        for node, deps in graph.items():
            for dep in deps:
                if dep in in_degree:
                    in_degree[node] += 1

        queue = [node for node, degree in in_degree.items() if degree == 0]
        sorted_vars: List[str] = []

        while queue:
            node = queue.pop(0)
            sorted_vars.append(node)
            for other_node, deps in graph.items():
                if node in deps:
                    in_degree[other_node] -= 1
                    if in_degree[other_node] == 0:
                        queue.append(other_node)

        return [formula_map[var] for var in sorted_vars if var in formula_map]

    def _detect_cycles(self, graph: Dict[str, set]) -> None:
        """Detect circular dependencies using DFS."""
        visited: set = set()
        rec_stack: set = set()

        def dfs(node: str) -> None:
            visited.add(node)
            rec_stack.add(node)
            for dep in graph.get(node, set()):
                if dep not in visited:
                    if dep in graph:
                        dfs(dep)
                elif dep in rec_stack:
                    raise ValueError(
                        f"Circular dependency detected involving: {node} -> {dep}"
                    )
            rec_stack.discard(node)

        for node in graph:
            if node not in visited:
                dfs(node)

    def calculate_all(
        self,
        context: Dict[str, Any],
        custom_formulas: List[Dict] = None,
    ) -> Dict[str, Decimal]:
        """Calculate all salary components using built-in + custom formulas."""
        results: Dict[str, Any] = dict(context)

        # Apply built-in formulas first
        for var, expr in self.BUILTIN_FORMULAS.items():
            try:
                results[var] = self.evaluate_expression(expr, results)
            except Exception:
                results[var] = Decimal("0")

        # Apply custom formulas in dependency order
        if custom_formulas:
            sorted_formulas = self.resolve_dependencies(custom_formulas)
            for formula in sorted_formulas:
                try:
                    results[formula["output_variable"]] = self.evaluate_expression(
                        formula["formula_expression"], results
                    )
                except Exception:
                    results[formula["output_variable"]] = Decimal("0")

        return results


formula_engine = FormulaEngine()
