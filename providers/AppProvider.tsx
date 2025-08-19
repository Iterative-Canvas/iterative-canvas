"use client"

import { Id } from "@/convex/_generated/dataModel"
import { useParams } from "next/navigation"
import React, { createContext, useReducer, useContext, Dispatch } from "react"

type State = {
  showNewFolderModal: boolean
  newFolderName: string
  openFolders: Record<Id<"folders">, boolean>
}

type Action =
  | { type: "OPEN_NEW_FOLDER_MODAL" }
  | { type: "CLOSE_NEW_FOLDER_MODAL" }
  | { type: "TOGGLE_NEW_FOLDER_MODAL" }
  | { type: "SET_NEW_FOLDER_NAME"; payload: string }
  | { type: "TOGGLE_FOLDER"; payload: Id<"folders"> }

const initialState: State = {
  showNewFolderModal: false,
  newFolderName: "",
  openFolders: {}, // Will be initialized in AppProvider
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
