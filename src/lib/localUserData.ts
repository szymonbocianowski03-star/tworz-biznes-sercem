// Dane aplikacji w localStorage są izolowane per konto (patrz userScopedStorage.ts).

export {
  syncLocalDataOwner,
  clearAppLocalDataForUser as clearAppLocalData,
  LOCAL_DATA_OWNER_KEY,
} from "@/lib/userScopedStorage";
