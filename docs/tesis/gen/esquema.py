"""Lee database/01_schema.sql y devuelve tablas, columnas, llaves y comentarios."""
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3]


def _partir(cuerpo: str) -> list[str]:
    """Separa por comas de primer nivel (fuera de paréntesis y comillas)."""
    partes, nivel, actual, comilla = [], 0, "", None
    for c in cuerpo:
        if comilla:
            actual += c
            if c == comilla:
                comilla = None
            continue
        if c in "'\"":
            comilla = c
        elif c == "(":
            nivel += 1
        elif c == ")":
            nivel -= 1
        if c == "," and nivel == 0:
            partes.append(actual.strip()); actual = ""
        else:
            actual += c
    if actual.strip():
        partes.append(actual.strip())
    return partes


def leer():
    sql = (RAIZ / "database/01_schema.sql").read_text(encoding="utf-8")
    sql = re.sub(r"--[^\n]*", "", sql)
    tablas = {}
    for m in re.finditer(r"CREATE TABLE (\w+) \((.*?)\n\)\s*ENGINE", sql, re.S):
        nombre, cuerpo = m.group(1), m.group(2)
        cols, pk, fks, unicos = [], [], {}, set()
        for parte in _partir(cuerpo):
            p = " ".join(parte.split())
            up = p.upper()
            if up.startswith("PRIMARY KEY"):
                pk += [x.strip() for x in re.search(r"\((.*?)\)", p).group(1).split(",")]
            elif up.startswith("UNIQUE KEY"):
                cs = [x.strip() for x in re.search(r"\((.*?)\)", p).group(1).split(",")]
                if len(cs) == 1:
                    unicos.add(cs[0])
            elif up.startswith("CONSTRAINT") and "FOREIGN KEY" in up:
                fm = re.search(r"FOREIGN KEY \((\w+)\) REFERENCES (\w+)\((\w+)\)", p)
                fks[fm.group(1)] = (fm.group(2), fm.group(3))
            elif up.startswith(("CONSTRAINT", "INDEX", "KEY")):
                continue
            else:
                cm = re.match(r"(\w+)\s+(.*)", p)
                col, resto = cm.group(1), cm.group(2)
                com = re.search(r"COMMENT '((?:[^']|'')*)'", resto)
                comentario = com.group(1).replace("''", "'") if com else ""
                resto_sin = re.sub(r"COMMENT '((?:[^']|'')*)'", "", resto)
                tm = re.match(r"(ENUM\(.*?\)|\w+(?:\([\d, ]+\))?)", resto_sin)
                tipo = tm.group(1)
                cols.append(dict(nombre=col, tipo=tipo, resto=resto_sin, comentario=comentario))
                if "PRIMARY KEY" in resto_sin.upper():
                    pk.append(col)
                if re.search(r"\bUNIQUE\b", resto_sin.upper()):
                    unicos.add(col)
        tablas[nombre] = dict(columnas=cols, pk=pk, fks=fks, unicos=unicos)
    for m in re.finditer(r"ALTER TABLE (\w+)\s+ADD CONSTRAINT \w+ FOREIGN KEY \((\w+)\) REFERENCES (\w+)\((\w+)\)", sql):
        tablas[m.group(1)]["fks"][m.group(2)] = (m.group(3), m.group(4))
    vistas = re.findall(r"CREATE OR REPLACE VIEW (\w+)", sql)
    return tablas, vistas


if __name__ == "__main__":
    t, v = leer()
    print(len(t), "tablas", v)
    for n, d in t.items():
        print(n, len(d["columnas"]), d["pk"], d["fks"])
