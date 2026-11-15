import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { rutaDeArchivo, urlDeArchivo } from '../lib/files.ts'

describe('URLs de archivos', () => {
  it('convierte una ruta relativa en URL del proxy', () => {
    assert.equal(urlDeArchivo('ordenes/12/a.pdf'), '/api/archivos?path=ordenes%2F12%2Fa.pdf')
  })

  it('convierte URLs públicas antiguas de Supabase', () => {
    const vieja = 'https://abc.supabase.co/storage/v1/object/public/adjuntos/checklist/7/f.jpg'
    assert.equal(rutaDeArchivo(vieja), 'checklist/7/f.jpg')
    assert.equal(urlDeArchivo(vieja), '/api/archivos?path=checklist%2F7%2Ff.jpg')
  })

  it('es idempotente con URLs del proxy', () => {
    const una = urlDeArchivo('firmas/3/x.png')
    assert.equal(urlDeArchivo(una), una)
  })

  it('deja intactos data:, blob: y URLs externas', () => {
    assert.equal(urlDeArchivo('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA')
    assert.equal(urlDeArchivo('https://example.com/logo.png'), 'https://example.com/logo.png')
  })

  it('devuelve vacío sin valor', () => {
    assert.equal(urlDeArchivo(null), '')
    assert.equal(urlDeArchivo(''), '')
  })
})
