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
  renamingFolderId: Id<"folders"> | null
  renamingFolderName: string
  showDeleteCanvasModal: boolean
  canvasIdToDelete: Id<"canvases"> | null
  canvasNameToDelete: string
  canvasDeleteInProgress: boolean
  showDeleteFolderModal: boolean
  folderIdToDelete: Id<"folders"> | null
  folderNameToDelete: string
  folderDeleteInProgress: boolean
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
  | {
      type: "START_RENAMING_FOLDER"
      payload: { folderId: Id<"folders">; currentName: string }
    }
  | { type: "CANCEL_RENAMING_FOLDER" }
  | { type: "SET_RENAMING_FOLDER_NAME"; payload: string }
  | {
      type: "OPEN_DELETE_CANVAS_MODAL"
      payload: { canvasId: Id<"canvases">; canvasName: string }
    }
  | { type: "CLOSE_DELETE_CANVAS_MODAL" }
  | { type: "TOGGLE_DELETE_CANVAS_MODAL" }
  | { type: "BEGIN_DELETE_CANVAS" }
  | { type: "FINISH_DELETE_CANVAS" }
  | {
      type: "OPEN_DELETE_FOLDER_MODAL"
      payload: { folderId: Id<"folders">; folderName: string }
    }
  | { type: "CLOSE_DELETE_FOLDER_MODAL" }
  | { type: "TOGGLE_DELETE_FOLDER_MODAL" }
  | { type: "BEGIN_DELETE_FOLDER" }
  | { type: "FINISH_DELETE_FOLDER" }

const initialState: State = {
  showNewFolderModal: false,
  newFolderName: "",
  openFolders: {},
  renamingCanvasId: null,
  renamingCanvasName: "",
  renamingFolderId: null,
  renamingFolderName: "",
  showDeleteCanvasModal: false,
  canvasIdToDelete: null,
  canvasNameToDelete: "",
  canvasDeleteInProgress: false,
  showDeleteFolderModal: false,
  folderIdToDelete: null,
  folderNameToDelete: "",
  folderDeleteInProgress: false,
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
    case "START_RENAMING_FOLDER":
      return {
        ...state,
        renamingFolderId: action.payload.folderId,
        renamingFolderName: action.payload.currentName,
      }
    case "CANCEL_RENAMING_FOLDER":
      return { ...state, renamingFolderId: null, renamingFolderName: "" }
    case "SET_RENAMING_FOLDER_NAME":
      return { ...state, renamingFolderName: action.payload }
    case "OPEN_DELETE_CANVAS_MODAL":
      return {
        ...state,
        showDeleteCanvasModal: true,
        canvasIdToDelete: action.payload.canvasId,
        canvasNameToDelete: action.payload.canvasName,
      }
    case "CLOSE_DELETE_CANVAS_MODAL":
      return {
        ...state,
        showDeleteCanvasModal: false,
        canvasIdToDelete: null,
        canvasNameToDelete: "",
      }
    case "TOGGLE_DELETE_CANVAS_MODAL":
      return {
        ...state,
        showDeleteCanvasModal: !state.showDeleteCanvasModal,
      }
    case "BEGIN_DELETE_CANVAS":
      return {
        ...state,
        canvasDeleteInProgress: true,
      }
    case "FINISH_DELETE_CANVAS":
      return {
        ...state,
        canvasDeleteInProgress: false,
      }
    case "OPEN_DELETE_FOLDER_MODAL":
      return {
        ...state,
        showDeleteFolderModal: true,
        folderIdToDelete: action.payload.folderId,
        folderNameToDelete: action.payload.folderName,
      }
    case "CLOSE_DELETE_FOLDER_MODAL":
      return {
        ...state,
        showDeleteFolderModal: false,
        folderIdToDelete: null,
        folderNameToDelete: "",
      }
    case "TOGGLE_DELETE_FOLDER_MODAL":
      return {
        ...state,
        showDeleteFolderModal: !state.showDeleteFolderModal,
      }
    case "BEGIN_DELETE_FOLDER":
      return {
        ...state,
        folderDeleteInProgress: true,
      }
    case "FINISH_DELETE_FOLDER":
      return {
        ...state,
        folderDeleteInProgress: false,
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
