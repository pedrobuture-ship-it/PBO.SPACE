import { create } from 'zustand'
interface UiState {
  activeWorkspaceId: string | null
  setActiveWorkspaceId: (id: string | null) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void
  activeTaskId: string | null
  setActiveTaskId: (id: string | null) => void
  boardSearch: string
  setBoardSearch: (value: string) => void
}
export const useUiStore = create<UiState>((set) => ({
  activeWorkspaceId: null,
  setActiveWorkspaceId: (activeWorkspaceId) => set({ activeWorkspaceId }),
  sidebarCollapsed: false,
  toggleSidebar: () => set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  mobileNavOpen: false,
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  activeTaskId: null,
  setActiveTaskId: (activeTaskId) => set({ activeTaskId }),
  boardSearch: '',
  setBoardSearch: (boardSearch) => set({ boardSearch }),
}))
