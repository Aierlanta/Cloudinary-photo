'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface BackendNode {
  id: string;
  name: string;
  baseUrl: string;
}

interface AdminApiContextValue {
  nodes: BackendNode[];
  selectedNode: BackendNode;
  selectedNodeId: string;
  setSelectedNodeId: (nodeId: string) => void;
  authToken: string | null;
  setAuthToken: (token: string | null) => void;
  clearAuthToken: () => void;
  adminFetch: (path: string, init?: RequestInit) => Promise<Response>;
  buildAdminUrl: (path: string) => string;
}

const AUTH_TOKEN_KEY = 'adminToken';
const SELECTED_NODE_KEY = 'admin-selected-node-id';

const AdminApiContext = createContext<AdminApiContextValue | null>(null);

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function getCurrentOrigin(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

function normalizeNode(input: Partial<BackendNode>, fallbackIndex: number): BackendNode | null {
  const baseUrl = typeof input.baseUrl === 'string' ? normalizeBaseUrl(input.baseUrl) : '';
  if (!baseUrl) return null;
  const id = input.id || `node-${fallbackIndex + 1}`;
  return {
    id,
    name: input.name || id,
    baseUrl
  };
}

function parseBackendNodes(): BackendNode[] {
  const raw = process.env.NEXT_PUBLIC_BACKEND_NODES;
  const currentNode = normalizeNode({
    id: process.env.NEXT_PUBLIC_NODE_ID || 'local',
    name: process.env.NEXT_PUBLIC_NODE_NAME || '当前节点',
    baseUrl: process.env.NEXT_PUBLIC_PUBLIC_API_BASE_URL || getCurrentOrigin()
  }, 0);

  if (!raw) {
    return currentNode ? [currentNode] : [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const nodes = parsed
        .map((item, index) => normalizeNode(item, index))
        .filter((node): node is BackendNode => !!node);
      return nodes.length > 0 ? nodes : (currentNode ? [currentNode] : []);
    }
  } catch {
    // 支持简易格式：id|name|url,id2|name2|url2
  }

  const nodes = raw
    .split(',')
    .map((part, index) => {
      const [id, name, baseUrl] = part.split('|').map((value) => value?.trim());
      return normalizeNode({ id, name, baseUrl: baseUrl || name || id }, index);
    })
    .filter((node): node is BackendNode => !!node);

  return nodes.length > 0 ? nodes : (currentNode ? [currentNode] : []);
}

function mergeHeaders(initHeaders: HeadersInit | undefined, authToken: string | null): Headers {
  const headers = new Headers(initHeaders);
  if (authToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  return headers;
}

export function AdminApiProvider({ children }: { children: React.ReactNode }) {
  const nodes = useMemo(() => parseBackendNodes(), []);
  const fallbackNode = nodes[0] || { id: 'local', name: '当前节点', baseUrl: getCurrentOrigin() };
  const [selectedNodeId, setSelectedNodeIdState] = useState(fallbackNode.id);
  const [authToken, setAuthTokenState] = useState<string | null>(null);

  useEffect(() => {
    const storedNodeId = localStorage.getItem(SELECTED_NODE_KEY);
    if (storedNodeId && nodes.some((node) => node.id === storedNodeId)) {
      setSelectedNodeIdState(storedNodeId);
    }
    setAuthTokenState(localStorage.getItem(AUTH_TOKEN_KEY));
  }, [nodes]);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || fallbackNode;

  const setSelectedNodeId = useCallback((nodeId: string) => {
    setSelectedNodeIdState(nodeId);
    localStorage.setItem(SELECTED_NODE_KEY, nodeId);
  }, []);

  const setAuthToken = useCallback((token: string | null) => {
    setAuthTokenState(token);
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  }, []);

  const clearAuthToken = useCallback(() => setAuthToken(null), [setAuthToken]);

  const buildAdminUrl = useCallback((path: string) => {
    if (/^https?:\/\//i.test(path)) return path;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${normalizeBaseUrl(selectedNode.baseUrl)}${normalizedPath}`;
  }, [selectedNode.baseUrl]);

  const adminFetch = useCallback((path: string, init: RequestInit = {}) => {
    return fetch(buildAdminUrl(path), {
      ...init,
      headers: mergeHeaders(init.headers, authToken),
      credentials: 'omit'
    });
  }, [authToken, buildAdminUrl]);

  const value = useMemo<AdminApiContextValue>(() => ({
    nodes,
    selectedNode,
    selectedNodeId,
    setSelectedNodeId,
    authToken,
    setAuthToken,
    clearAuthToken,
    adminFetch,
    buildAdminUrl
  }), [
    nodes,
    selectedNode,
    selectedNodeId,
    setSelectedNodeId,
    authToken,
    setAuthToken,
    clearAuthToken,
    adminFetch,
    buildAdminUrl
  ]);

  return <AdminApiContext.Provider value={value}>{children}</AdminApiContext.Provider>;
}

export function useAdminApi(): AdminApiContextValue {
  const value = useContext(AdminApiContext);
  if (value) {
    return value;
  }

  const fallbackNode = {
    id: 'local',
    name: '当前节点',
    baseUrl: getCurrentOrigin()
  };

  return {
    nodes: [fallbackNode],
    selectedNode: fallbackNode,
    selectedNodeId: fallbackNode.id,
    setSelectedNodeId: () => {},
    authToken: typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null,
    setAuthToken: () => {},
    clearAuthToken: () => {},
    buildAdminUrl: (path: string) => path,
    adminFetch: (path: string, init?: RequestInit) => fetch(path, init)
  };
}
