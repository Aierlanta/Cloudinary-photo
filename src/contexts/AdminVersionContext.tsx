'use client';

import { createContext, useContext } from 'react';

export type AdminVersion = 'v1' | 'v2';

interface AdminVersionContextType {
  version: AdminVersion;
  setVersion: (version: AdminVersion) => void;
}

export const AdminVersionContext = createContext<AdminVersionContextType>({
  version: 'v1',
  setVersion: () => {},
});

export const useAdminVersion = () => useContext(AdminVersionContext);

