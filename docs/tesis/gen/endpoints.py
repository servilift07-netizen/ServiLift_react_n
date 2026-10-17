"""Extrae los endpoints de la API con sus roles leyendo el código de servilift-backend/app/routes."""
import ast
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3]
RUTAS = RAIZ / "servilift-backend" / "app" / "routes"
ROLES = {"ADMIN", "ASESOR", "CLIENTE", "PROGRAMACION", "INSPECTOR", "DIRECTOR_TECNICO", "CERTIFICADOS"}


def _constantes(arbol):
    """Constantes de módulo que son tuplas o listas de roles (por ejemplo OFICINA = (ASESOR, ...))."""
    out = {}
    for n in arbol.body:
        if isinstance(n, ast.Assign) and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name):
            v = n.value
            if isinstance(v, (ast.Tuple, ast.List, ast.Set)):
                out[n.targets[0].id] = [e.id if isinstance(e, ast.Name) else getattr(e, "value", "?") for e in v.elts]
            elif isinstance(v, ast.Constant) and isinstance(v.value, str):
                out[n.targets[0].id] = [v.value]
    return out


def _resolver(nombre, consts, prof=0):
    if nombre in ROLES:
        return [nombre]
    if nombre in consts and prof < 4:
        r = []
        for x in consts[nombre]:
            r += _resolver(x, consts, prof + 1) if x not in ROLES else [x]
        return r
    return [nombre]


def leer():
    eps = []
    for f in sorted(RUTAS.glob("*.py")):
        arbol = ast.parse(f.read_text(encoding="utf-8"))
        consts = _constantes(arbol)
        prefijo = ""
        for n in arbol.body:
            if isinstance(n, ast.Assign) and isinstance(n.value, ast.Call) and getattr(n.value.func, "id", "") == "APIRouter":
                for k in n.value.keywords:
                    if k.arg == "prefix":
                        prefijo = k.value.value
        for n in arbol.body:
            if not isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            for d in n.decorator_list:
                if isinstance(d, ast.Call) and isinstance(d.func, ast.Attribute) and d.func.attr in (
                        "get", "post", "put", "delete", "patch"):
                    ruta = prefijo + (d.args[0].value if d.args else "")
                    roles, sesion = set(), False
                    for sub in ast.walk(n.args):
                        if isinstance(sub, ast.Call) and getattr(sub.func, "id", "") == "require_roles":
                            sesion = True
                            if not sub.args:
                                roles.add("ADMIN")
                            for a in sub.args:
                                if isinstance(a, ast.Starred):
                                    a = a.value
                                if isinstance(a, ast.Name):
                                    roles.update(_resolver(a.id, consts))
                                elif isinstance(a, ast.Constant):
                                    roles.add(a.value)
                        if isinstance(sub, ast.Name) and sub.id in ("get_current_user", "usuario_actual"):
                            sesion = True
                    doc = (ast.get_docstring(n) or "").strip().split("\n")[0]
                    eps.append(dict(modulo=f.stem, metodo=d.func.attr.upper(), ruta=ruta or "/",
                                    roles=sorted(roles), sesion=sesion, funcion=n.name, doc=doc))
    return eps


if __name__ == "__main__":
    for e in leer():
        print(e["modulo"], e["metodo"], e["ruta"], e["roles"] or ("sesión" if e["sesion"] else "PÚBLICO"), "|", e["doc"][:60])
