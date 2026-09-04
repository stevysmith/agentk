import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import * as React from 'react'
import { Command } from '../index'

/**
 * jsdom ships no matchMedia, so every test here declares the pointer it is
 * about. `(pointer: coarse)` is the only query the palette asks.
 */
function setPointer(kind: 'coarse' | 'fine') {
  const listeners = new Set<() => void>()
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('coarse') ? kind === 'coarse' : kind === 'fine',
    media: query,
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as any
}

function Palette(props: { autoFocus?: boolean; autoFocusOnTouch?: boolean }) {
  return (
    <Command label="Test">
      <Command.Input placeholder="Search..." autoFocus={props.autoFocus} autoFocusOnTouch={props.autoFocusOnTouch} />
      <Command.List>
        <Command.Item value="alpha">Alpha</Command.Item>
        <Command.Item value="beta">Beta</Command.Item>
      </Command.List>
    </Command>
  )
}

afterEach(() => {
  cleanup()
  delete (window as any).matchMedia
})

describe('pointer selection on touch', () => {
  it('does not move the selection when a finger drags across a row', () => {
    setPointer('coarse')
    render(<Palette />)

    const alpha = screen.getByText('Alpha').closest('[cmdk-item]') as HTMLElement
    const beta = screen.getByText('Beta').closest('[cmdk-item]') as HTMLElement

    // first item starts selected
    expect(alpha).toHaveAttribute('data-selected', 'true')

    // a finger travelling down the list is a scroll, not a hover
    fireEvent.pointerMove(beta, { pointerType: 'touch' })

    expect(beta).toHaveAttribute('data-selected', 'false')
    expect(alpha).toHaveAttribute('data-selected', 'true')
  })

  it('still moves the selection for a mouse', () => {
    setPointer('fine')
    render(<Palette />)

    const beta = screen.getByText('Beta').closest('[cmdk-item]') as HTMLElement
    fireEvent.pointerMove(beta, { pointerType: 'mouse' })

    expect(beta).toHaveAttribute('data-selected', 'true')
  })

  it('a tap still selects and fires onSelect', () => {
    setPointer('coarse')
    const onSelect = vi.fn()
    render(
      <Command label="Test">
        <Command.List>
          <Command.Item value="alpha" onSelect={onSelect}>
            Alpha
          </Command.Item>
          <Command.Item value="beta" onSelect={onSelect}>
            Beta
          </Command.Item>
        </Command.List>
      </Command>,
    )

    const beta = screen.getByText('Beta').closest('[cmdk-item]') as HTMLElement
    fireEvent.click(beta)

    // the value passed is the tapped row's own, not whatever was highlighted
    expect(onSelect).toHaveBeenCalledWith('beta')
    expect(beta).toHaveAttribute('data-selected', 'true')
  })
})

describe('autoFocus on touch', () => {
  it('does not summon the keyboard over the list', () => {
    setPointer('coarse')
    render(<Palette autoFocus />)

    expect(screen.getByPlaceholderText('Search...')).not.toHaveFocus()
  })

  it('honours autoFocus with a mouse', () => {
    setPointer('fine')
    render(<Palette autoFocus />)

    expect(screen.getByPlaceholderText('Search...')).toHaveFocus()
  })

  it('honours autoFocusOnTouch when the app asks for it', () => {
    setPointer('coarse')
    render(<Palette autoFocus autoFocusOnTouch />)

    expect(screen.getByPlaceholderText('Search...')).toHaveFocus()
  })

  it('never focuses when autoFocus was not asked for', () => {
    setPointer('fine')
    render(<Palette />)

    expect(screen.getByPlaceholderText('Search...')).not.toHaveFocus()
  })
})

describe('data-touch', () => {
  it('marks the root on a coarse pointer so a sheet layout can style off it', () => {
    setPointer('coarse')
    const { container } = render(<Palette />)

    expect(container.querySelector('[cmdk-root]')).toHaveAttribute('data-touch')
  })

  it('leaves the root unmarked for a mouse', () => {
    setPointer('fine')
    const { container } = render(<Palette />)

    expect(container.querySelector('[cmdk-root]')).not.toHaveAttribute('data-touch')
  })
})
