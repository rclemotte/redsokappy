# Importación de las planillas Tookan

1. `python3 parse_tookan.py <carpeta del zip de Drive> filas.json` — lee las 13 planillas.
2. `python3 generar.py filas.json <carpeta salida>` — arma `tookan_03_importar.sql`.

Reglas principales:
- Primera columna de la lista del han (G / Gz / Nº) marcada = tiene Gohonzon (coincide con el resumen de cada planilla). Si la planilla tiene columna "Gohonzon", se usa esa.
- Todos los de la lista del han son miembros, salvo que la planilla diga Amigo/No miembro o tenga columna "Membresía" sin marcar (Pioneros).
- Columna Estado AC / IN (Renacer) e "Inactivo" en Cargo → estado inicial.
- Secciones de abajo (exterior, fallecidos, taiten, traslados, a ubicar) → bajas con su motivo.
- Cargos en castellano → función · nivel · división. Cargos en japonés → vacíos, el texto queda en la observación.
- Duplicados: mismo nombre en el mismo cabildo → se carga una vez (gana la lista del han).
