"use client";
import { createContext, useContext } from "react";
import { createStore, type StateCreator, useStore } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { useShallow } from "zustand/react/shallow";

interface ResourceStoreProps {
  sessionId?: string;
  open?: boolean;

  // List View State
  searchKw?: string;
  selectedType?: string;

  // Form View State
  viewMode?: "list" | "form";
  formResourceType?: string;
  formResourceId?: string;
}

export interface ResourceStoreState extends ResourceStoreProps {
  setOpen: (open: boolean) => void;
  setSelectedType: (type: string) => void;
  setSearchKw: (kw: string) => void;
  openResourceForm: (type: string, id?: string) => void;
  backToList: () => void;
}

const createAppSlice: StateCreator<ResourceStoreState, [], [], ResourceStoreState> = (set, _get, init) => {
  return {
    viewMode: "list",
    searchKw: "",
    selectedType: "",
    ...init,

    setOpen: (open) => set({ open }),
    setSelectedType: (type) => set({ selectedType: type }),
    setSearchKw: (kw) => set({ searchKw: kw }),

    openResourceForm: (type, id) =>
      set({
        viewMode: "form",
        formResourceType: type,
        formResourceId: id,
        open: true,
      }),

    backToList: () =>
      set({
        viewMode: "list",
        formResourceType: undefined,
        formResourceId: undefined,
      }),
  };
};

type MainStoreState = ResourceStoreState;
const createResourceStore = (initProps?: Partial<MainStoreState>) => {
  const initialState = { ...initProps };
  return createStore<MainStoreState>()(
    subscribeWithSelector(
      devtools(
        immer((...a) => ({
          ...createAppSlice(...a),
          ...initialState,
        })),
        { name: "resources-store" },
      ),
    ),
  );
};

const resourceStoreContext = createContext<ReturnType<typeof createResourceStore> | null>(null);

export const ResourceStoreProvider = (props: React.PropsWithChildren<ResourceStoreProps>) => {
  const { children, ...etc } = props;
  return (
    <resourceStoreContext.Provider value={createResourceStore({ ...etc })}>{children}</resourceStoreContext.Provider>
  );
};

export function useResourcesStore(): MainStoreState;
export function useResourcesStore<T>(selector: (state: MainStoreState) => T): T;
export function useResourcesStore<T>(selector?: (state: MainStoreState) => T) {
  const store = useContext(resourceStoreContext);
  if (!store) throw new Error("useResourcesStore must be used within ResourceStoreProvider");
  const shallowSelector = useShallow(selector || ((state: MainStoreState) => state as T));
  return useStore(store, selector ? shallowSelector : (state) => state as T);
}
