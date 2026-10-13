# Diagramas para la tesis

Cada diagrama está en dos formatos: el fuente Mermaid (`.mmd`, el mismo bloque que aparece en los documentos de
`docs/`) y una imagen PNG lista para pegar en Word.

| Imagen | Documento |
|---|---|
| `arquitectura-componentes.png`, `arquitectura-backend.png`, `arquitectura-app.png`, `sincronizacion-sin-senal.png`, `despliegue.png` | [arquitectura.md](../arquitectura.md) |
| `casos-de-uso.png`, `flujo-del-negocio.png` | [casos-de-uso.md](../casos-de-uso.md) |
| `modelo-entidad-relacion.png`, `estados-del-servicio.png` | [modelo-de-datos.md](../modelo-de-datos.md) |
| `niveles-de-prueba.png` | [pruebas.md](../pruebas.md) |

Si cambia un diagrama, actualice el bloque en el `.md`, copie el mismo texto al `.mmd` y regenere la imagen:

```bash
npx -y @mermaid-js/mermaid-cli@11.4.2 -b white -s 2 -i casos-de-uso.mmd -o casos-de-uso.png
```

También se puede pegar el `.mmd` en https://mermaid.live y descargar la imagen desde allí.
