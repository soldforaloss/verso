import { describe, it, expect, beforeEach } from 'vitest'
import { useViewStore } from '@/store/viewStore'
import { MAX_SCALE, MIN_SCALE } from '@/lib/geometry'

const reset = (): void =>
  useViewStore.setState({
    zoomMode: 'fit-width',
    scale: 1,
    rotation: 0,
    currentPage: 1,
    pendingScrollPage: null
  })

describe('viewStore', () => {
  beforeEach(reset)

  it('zoomIn switches to custom and increases scale', () => {
    useViewStore.getState().zoomIn()
    const { zoomMode, scale } = useViewStore.getState()
    expect(zoomMode).toBe('custom')
    expect(scale).toBeGreaterThan(1)
  })

  it('clamps zoom in at the maximum', () => {
    for (let i = 0; i < 50; i += 1) useViewStore.getState().zoomIn()
    expect(useViewStore.getState().scale).toBe(MAX_SCALE)
  })

  it('clamps zoom out at the minimum', () => {
    for (let i = 0; i < 50; i += 1) useViewStore.getState().zoomOut()
    expect(useViewStore.getState().scale).toBe(MIN_SCALE)
  })

  it('rotates clockwise and wraps 270 → 0', () => {
    useViewStore.setState({ rotation: 270 })
    useViewStore.getState().rotateCw()
    expect(useViewStore.getState().rotation).toBe(0)
  })

  it('rotates counter-clockwise and wraps 0 → 270', () => {
    useViewStore.getState().rotateCcw()
    expect(useViewStore.getState().rotation).toBe(270)
  })

  it('setScale switches to custom mode', () => {
    useViewStore.getState().setScale(2)
    expect(useViewStore.getState().zoomMode).toBe('custom')
    expect(useViewStore.getState().scale).toBe(2)
  })

  it('requestScrollToPage sets currentPage and a pending scroll', () => {
    useViewStore.getState().requestScrollToPage(5)
    expect(useViewStore.getState().currentPage).toBe(5)
    expect(useViewStore.getState().pendingScrollPage).toBe(5)
  })

  it('setCurrentPage never goes below 1', () => {
    useViewStore.getState().setCurrentPage(-3)
    expect(useViewStore.getState().currentPage).toBe(1)
  })

  it('resetForDocument restores defaults', () => {
    useViewStore.setState({ rotation: 90, currentPage: 9, zoomMode: 'custom' })
    useViewStore.getState().resetForDocument()
    const state = useViewStore.getState()
    expect(state).toMatchObject({ rotation: 0, currentPage: 1, zoomMode: 'fit-width' })
  })
})
