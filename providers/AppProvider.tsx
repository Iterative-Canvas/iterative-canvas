"use client"

import { Id } from "@/convex/_generated/dataModel"
import { useParams } from "next/navigation"
import React, { createContext, useReducer, useContext, Dispatch } from "react"

type State = {
  showNewFolderModal: boolean
  newFolderName: string
  openFolders: Record<Id<"folders">, boolean>
  renamingCanvasId: Id<"canvases"> | null
  renamingCanvasName: string
}

type Action =
  | { type: "OPEN_NEW_FOLDER_MODAL" }
  | { type: "CLOSE_NEW_FOLDER_MODAL" }
  | { type: "TOGGLE_NEW_FOLDER_MODAL" }
  | { type: "SET_NEW_FOLDER_NAME"; payload: string }
  | { type: "TOGGLE_FOLDER"; payload: Id<"folders"> }
  | {
      type: "START_RENAMING_CANVAS"
      payload: { canvasId: Id<"canvases">; currentName: string }
    }
  | { type: "CANCEL_RENAMING_CANVAS" }
  | { type: "SET_RENAMING_CANVAS_NAME"; payload: string }

const initialState: State = {
  showNewFolderModal: false,
  newFolderName: "",
  openFolders: {}, // Will be initialized in AppProvider
  renamingCanvasId: null,
  renamingCanvasName: "",
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "OPEN_NEW_FOLDER_MODAL":
      return { ...state, showNewFolderModal: true, newFolderName: "" }
    case "CLOSE_NEW_FOLDER_MODAL":
      return { ...state, showNewFolderModal: false, newFolderName: "" }
    case "TOGGLE_NEW_FOLDER_MODAL":
      return {
        ...state,
        showNewFolderModal: !state.showNewFolderModal,
        newFolderName: state.showNewFolderModal ? "" : state.newFolderName,
      }
    case "SET_NEW_FOLDER_NAME":
      return { ...state, newFolderName: action.payload }
    case "TOGGLE_FOLDER":
      return {
        ...state,
        openFolders: {
          ...state.openFolders,
          [action.payload]: !state.openFolders[action.payload],
        },
      }
    case "START_RENAMING_CANVAS":
      return {
        ...state,
        renamingCanvasId: action.payload.canvasId,
        renamingCanvasName: action.payload.currentName,
      }
    case "CANCEL_RENAMING_CANVAS":
      return {
        ...state,
        renamingCanvasId: null,
        renamingCanvasName: "",
      }
    case "SET_RENAMING_CANVAS_NAME":
      return { ...state, renamingCanvasName: action.payload }
    default:
      return state
  }
}

const AppContext = createContext<{
  state: State
  dispatch: Dispatch<Action>
}>({
  state: initialState,
  dispatch: () => undefined,
})

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const { folderId: activeFolderId } = useParams<{ folderId: string }>()
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    openFolders: activeFolderId === "root" ? {} : { [activeFolderId]: true },
  })
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

export const useAppContext = () => useContext(AppContext)
