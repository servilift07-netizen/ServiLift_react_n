# Documento de la tesis

`ServiLift_Documentacion.docx` es el documento completo del proyecto con la estructura del documento modelo
(normas APA, tablas de requisitos y de casos de uso) y los diagramas de `img/`.

- `img/`: diagramas en SVG y PNG (casos de uso por rol, modelo de datos general, por área y por rol,
  arquitectura, flujo, estados, sincronización y pruebas).
- `gen/`: scripts que los generan. El diccionario de datos sale de `database/01_schema.sql` y la lista de
  endpoints del código de `servilift-backend/app/routes`, así que el documento coincide con el sistema.

Para regenerar todo (diagramas, documento e índice):

```bash
bash docs/tesis/gen/construir.sh
```

Requiere Python con Pillow, Node con los paquetes `docx` y `playwright` (Chromium), LibreOffice y poppler-utils.
