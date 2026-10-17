"""Busca en el PDF la página de cada título (encabezados.json) y escribe paginas.json para el índice."""
import json
import re
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent


def normal(t):
    return re.sub(r"\s+", " ", t.replace("​", "")).strip().lower()


def main(pdf):
    titulos = json.loads((AQUI / "encabezados.json").read_text(encoding="utf-8"))
    n = int(re.search(r"Pages:\s+(\d+)", subprocess.run(["pdfinfo", pdf], capture_output=True, text=True).stdout).group(1))
    paginas = []
    for i in range(1, n + 1):
        txt = subprocess.run(["pdftotext", "-f", str(i), "-l", str(i), "-layout", pdf, "-"], capture_output=True,
                             text=True).stdout
        paginas.append([normal(l) for l in txt.splitlines() if l.strip()])
    out, desde = [], 3  # la portada y el índice no cuentan
    for _, t in titulos:
        buscado = normal(t)
        encontrado = None
        for p in range(desde, n + 1):
            if buscado in paginas[p - 1]:
                encontrado = p
                break
        if encontrado is None:
            print("No encontrado:", t)
            out.append("")
        else:
            out.append(str(encontrado))
            desde = encontrado
    (AQUI / "paginas.json").write_text(json.dumps(out), encoding="utf-8")
    print(len([x for x in out if x]), "de", len(out), "títulos con página")


if __name__ == "__main__":
    main(sys.argv[1])
