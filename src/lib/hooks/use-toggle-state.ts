import { useState } from "react"

export type StateType = [boolean, () => void, () => void, () => void] & {
  state: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

const useToggleState = (initialState = false) => {
  const [state, setState] = useState<boolean>(initialState)

  const close = () => setState(false)
  const open = () => setState(true)
  const toggle = () => setState((s) => !s)

  const hookData = [state, open, close, toggle] as StateType
  hookData.state = state
  hookData.open = open
  hookData.close = close
  hookData.toggle = toggle
  return hookData
}

export default useToggleState
