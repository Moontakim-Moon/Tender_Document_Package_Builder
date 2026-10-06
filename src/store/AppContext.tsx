import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from 'react';
import type {
  UploadedFile,
  Match,
  RequirementsJson,
  AppStep,
  Language,
  FileProcessingStatus,
} from '../types';

// ================================================================
// State
// ================================================================
interface AppState {
  requirements: RequirementsJson | null;
  uploadedFiles: UploadedFile[];
  matches: Match[];
  currentStep: AppStep;
  language: Language;
  requirementsError: string | null;
}

const initialState: AppState = {
  requirements: null,
  uploadedFiles: [],
  matches: [],
  currentStep: 'setup',
  language: 'en',
  requirementsError: null,
};

// ================================================================
// Actions
// ================================================================
type Action =
  | { type: 'SET_REQUIREMENTS'; payload: RequirementsJson }
  | { type: 'SET_REQUIREMENTS_ERROR'; payload: string }
  | { type: 'CLEAR_REQUIREMENTS' }
  | { type: 'ADD_FILE'; payload: UploadedFile }
  | { type: 'UPDATE_FILE'; payload: { id: string; updates: Partial<UploadedFile> } }
  | { type: 'REMOVE_FILE'; payload: string }
  | { type: 'CLEAR_FILES' }
  | { type: 'SET_MATCH'; payload: Match }
  | { type: 'REMOVE_MATCH'; payload: { requirementId: string } }
  | { type: 'SET_EXPIRY'; payload: { requirementId: string; expiryDate: string } }
  | { type: 'SET_STEP'; payload: AppStep }
  | { type: 'SET_LANGUAGE'; payload: Language }
  | { type: 'RESET_PROJECT' };

// ================================================================
// Reducer
// ================================================================
function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_REQUIREMENTS':
      return {
        ...state,
        requirements: action.payload,
        requirementsError: null,
      };

    case 'SET_REQUIREMENTS_ERROR':
      return {
        ...state,
        requirements: null,
        requirementsError: action.payload,
      };

    case 'CLEAR_REQUIREMENTS':
      return {
        ...state,
        requirements: null,
        requirementsError: null,
        uploadedFiles: [],
        matches: [],
        currentStep: 'setup',
      };

    case 'ADD_FILE':
      return {
        ...state,
        uploadedFiles: [...state.uploadedFiles, action.payload],
      };

    case 'UPDATE_FILE':
      return {
        ...state,
        uploadedFiles: state.uploadedFiles.map((f) =>
          f.id === action.payload.id
            ? { ...f, ...action.payload.updates }
            : f
        ),
      };

    case 'REMOVE_FILE': {
      const removedId = action.payload;
      // Remove matches associated with this file
      const newMatches = state.matches.filter((m) => m.fileId !== removedId);
      // Revoke object URL if present
      const file = state.uploadedFiles.find((f) => f.id === removedId);
      if (file?.objectUrl) {
        URL.revokeObjectURL(file.objectUrl);
      }
      // If removed file was a "primary" (others are duplicates of it),
      // update status of those duplicates
      const newFiles = state.uploadedFiles
        .filter((f) => f.id !== removedId)
        .map((f) => {
          if (f.duplicateOfId === removedId) {
            // Find if there's another file with same hash to become the new primary
            const sameHash = state.uploadedFiles.find(
              (other) =>
                other.id !== removedId &&
                other.id !== f.id &&
                other.sha256 === f.sha256 &&
                other.status !== 'duplicate'
            );
            if (sameHash) {
              return { ...f, duplicateOfId: sameHash.id };
            } else {
              // Promote this to primary (no longer duplicate)
              return { ...f, status: 'ready' as FileProcessingStatus, duplicateOfId: undefined };
            }
          }
          return f;
        });
      return {
        ...state,
        uploadedFiles: newFiles,
        matches: newMatches,
      };
    }

    case 'CLEAR_FILES': {
      // Revoke all object URLs
      state.uploadedFiles.forEach((f) => {
        if (f.objectUrl) URL.revokeObjectURL(f.objectUrl);
      });
      return {
        ...state,
        uploadedFiles: [],
        matches: [],
      };
    }

    case 'SET_MATCH': {
      const { requirementId, fileId } = action.payload;
      // Remove any existing match for this requirement or this file
      const filtered = state.matches.filter(
        (m) => m.requirementId !== requirementId && m.fileId !== fileId
      );
      return {
        ...state,
        matches: [...filtered, action.payload],
      };
    }

    case 'REMOVE_MATCH':
      return {
        ...state,
        matches: state.matches.filter(
          (m) => m.requirementId !== action.payload.requirementId
        ),
      };

    case 'SET_EXPIRY':
      return {
        ...state,
        matches: state.matches.map((m) =>
          m.requirementId === action.payload.requirementId
            ? { ...m, expiryDate: action.payload.expiryDate }
            : m
        ),
      };

    case 'SET_STEP':
      return { ...state, currentStep: action.payload };

    case 'SET_LANGUAGE':
      return { ...state, language: action.payload };

    case 'RESET_PROJECT': {
      state.uploadedFiles.forEach((f) => {
        if (f.objectUrl) URL.revokeObjectURL(f.objectUrl);
      });
      return { ...initialState };
    }

    default:
      return state;
  }
}

// ================================================================
// Context
// ================================================================
interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  // Convenience helpers
  setRequirements: (data: RequirementsJson) => void;
  setRequirementsError: (err: string) => void;
  clearRequirements: () => void;
  addFile: (file: UploadedFile) => void;
  updateFile: (id: string, updates: Partial<UploadedFile>) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  setMatch: (match: Match) => void;
  removeMatch: (requirementId: string) => void;
  setExpiry: (requirementId: string, expiryDate: string) => void;
  setStep: (step: AppStep) => void;
  setLanguage: (lang: Language) => void;
  resetProject: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setRequirements = useCallback(
    (data: RequirementsJson) => dispatch({ type: 'SET_REQUIREMENTS', payload: data }),
    []
  );
  const setRequirementsError = useCallback(
    (err: string) => dispatch({ type: 'SET_REQUIREMENTS_ERROR', payload: err }),
    []
  );
  const clearRequirements = useCallback(
    () => dispatch({ type: 'CLEAR_REQUIREMENTS' }),
    []
  );
  const addFile = useCallback(
    (file: UploadedFile) => dispatch({ type: 'ADD_FILE', payload: file }),
    []
  );
  const updateFile = useCallback(
    (id: string, updates: Partial<UploadedFile>) =>
      dispatch({ type: 'UPDATE_FILE', payload: { id, updates } }),
    []
  );
  const removeFile = useCallback(
    (id: string) => dispatch({ type: 'REMOVE_FILE', payload: id }),
    []
  );
  const clearFiles = useCallback(() => dispatch({ type: 'CLEAR_FILES' }), []);
  const setMatch = useCallback(
    (match: Match) => dispatch({ type: 'SET_MATCH', payload: match }),
    []
  );
  const removeMatch = useCallback(
    (requirementId: string) =>
      dispatch({ type: 'REMOVE_MATCH', payload: { requirementId } }),
    []
  );
  const setExpiry = useCallback(
    (requirementId: string, expiryDate: string) =>
      dispatch({ type: 'SET_EXPIRY', payload: { requirementId, expiryDate } }),
    []
  );
  const setStep = useCallback(
    (step: AppStep) => dispatch({ type: 'SET_STEP', payload: step }),
    []
  );
  const setLanguage = useCallback(
    (lang: Language) => dispatch({ type: 'SET_LANGUAGE', payload: lang }),
    []
  );
  const resetProject = useCallback(() => dispatch({ type: 'RESET_PROJECT' }), []);

  const value: AppContextValue = {
    state,
    dispatch,
    setRequirements,
    setRequirementsError,
    clearRequirements,
    addFile,
    updateFile,
    removeFile,
    clearFiles,
    setMatch,
    removeMatch,
    setExpiry,
    setStep,
    setLanguage,
    resetProject,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return ctx;
}
