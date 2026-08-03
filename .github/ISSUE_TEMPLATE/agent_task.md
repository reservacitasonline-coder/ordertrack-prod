---
name: Tarea para Agente de Código
about: Plantilla estructurada para resolución automática de bugs o features.
title: '[AGENT] <Componente>: <Descripción corta del objetivo>'
labels: agent-task
assignees: ''
---

## 1. Contexto y Comportamiento Esperado
- **Problema actual:** [Descripción breve del fallo o falta de funcionalidad]
- **Resultado esperado:** [Comportamiento exacto tras aplicar el cambio]

## 2. Alcance (Scope)
- **Archivos a modificar:**
  - `ruta/al/archivo1.ext`
  - `ruta/al/archivo2.ext`
- **Archivos de solo lectura (referencia):**
  - `ruta/al/contexto.ext`
- **Restricción de modificación:** NO modificar nada fuera de los archivos explícitamente declarados.

## 3. Criterios de Aceptación y Validación
- [ ] Ejecución exitosa del comando de prueba: `<comando_de_test_o_lint>`
- [ ] Sin regresiones en pruebas existentes.
- [ ] Estilo de código conforme a las linter rules del repositorio.

## 4. Instrucciones de Entrega
1. Crear una rama dedicada: `fix/issue-<ID>` o `feat/issue-<ID>`.
2. Generar un commit con mensaje en formato Conventional Commits (`fix: ...` o `feat: ...`).
3. Abrir Pull Request apuntando a `main` vinculando este issue (`Closes #<ID>`).
