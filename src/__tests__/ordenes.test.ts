import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  ESTADOS_INICIALES,
  OT_CAMPOS_CREAR,
  OT_CAMPOS_EDITAR,
  esConflictoDeCodigo,
  numeroDeCodigo,
  pickCampos,
  siguienteCodigo,
} from '../app/api/_lib/ordenes.ts'

describe('correlativo de órdenes', () => {
  it('empieza en OT-00001 cuando no hay órdenes', () => {
    assert.equal(siguienteCodigo(null), 'OT-00001')
  })

  it('incrementa el último código regular', () => {
    assert.equal(siguienteCodigo('OT-00012'), 'OT-00013')
    assert.equal(siguienteCodigo('OT-00999'), 'OT-01000')
  })

  it('ignora el sufijo de reapertura (antes saltaba a OT-00346)', () => {
    assert.equal(numeroDeCodigo('OT-00012-R345'), 12)
    assert.equal(siguienteCodigo('OT-00012-R345'), 'OT-00013')
  })

  it('avanza con cada reintento', () => {
    assert.equal(siguienteCodigo('OT-00012', 2), 'OT-00015')
  })

  it('no falla con formatos desconocidos', () => {
    assert.equal(numeroDeCodigo('LEGACY-77'), null)
    assert.equal(siguienteCodigo('LEGACY-77'), 'OT-00001')
  })

  it('detecta colisiones de código', () => {
    assert.equal(esConflictoDeCodigo({ code: '23505' }), true)
    assert.equal(esConflictoDeCodigo({ message: 'violates uq_ot_empresa_codigo' }), true)
    assert.equal(esConflictoDeCodigo({ message: 'otro error' }), false)
    assert.equal(esConflictoDeCodigo(null), false)
  })
})

describe('lista blanca de campos', () => {
  const malicioso = {
    titulo: 'Cambio de filtro',
    cliente_id: 5,
    estado: 'CERRADA',
    empresa_id: 99,
    id: 1,
    codigo_interno: 'OT-99999',
    firma_cliente: 'x.png',
    fecha_cierre: '2026-01-01',
    es_reapertura: true,
  }

  it('al editar descarta estado, empresa y campos de control', () => {
    assert.deepEqual(pickCampos(malicioso, OT_CAMPOS_EDITAR), { titulo: 'Cambio de filtro', cliente_id: 5 })
  })

  it('al crear descarta estado, empresa y campos de control', () => {
    assert.deepEqual(pickCampos(malicioso, OT_CAMPOS_CREAR), { titulo: 'Cambio de filtro', cliente_id: 5 })
  })

  it('conserva null explícito y omite undefined', () => {
    assert.deepEqual(pickCampos({ descripcion: null, monto: undefined }, OT_CAMPOS_EDITAR), { descripcion: null })
  })

  it('no permite crear órdenes en estados terminales o de ejecución', () => {
    for (const estado of ['CERRADA', 'COMPLETADA', 'ANULADA', 'EN_EJECUCION']) {
      assert.equal((ESTADOS_INICIALES as readonly string[]).includes(estado), false)
    }
  })
})
