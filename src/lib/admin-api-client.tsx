'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface BackendNode {
  id: string;
  name: string;
  baseUrl: string;
}

export interface NodeHealthStatus {
  nodeId: string;
  status: 'unknown' | 'online' | 'offline' | 'degraded';
  latencyMs?: number;
  version?: string;
  message?: string;
  checkedAt?: string;
}

export interface NodeFetchResult<T = unknown> {
  node: BackendNode;
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

interface AdminApiContextValue {
  nodes: BackendNode[];
  selectedNode: BackendNode;
  selectedNodeId: string;
  setSelectedNodeId: (nodeId: string) => void;
  nodeStatuses: Record<string, NodeHealthStatus>;
  refreshNodeStatuses: () => Promise<void>;
  authToken: string | null;
  setAuthToken: (token: string | null) => void;
  clearAuthToken: () => void;
  adminFetch: (path: string, init?: RequestInit) => Promise<Response>;
  buildAdminUrl: (path: string) => string;
  buildNodeUrl: (nodeId: string, path: string) => string;
  fetchNode: (nodeId: string, path: string, init?: RequestInit) => Promise<Response>;
  fetchAllNodes: <T = unknown>(path: string, init?: RequestInit) => Promise<NodeFetchResult<T>[]>;
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

function getCurrentFrontendNodeId(): string {
  return process.env.NEXT_PUBLIC_NODE_ID || 'local';
}

function getSelectedNodeStorageKey(): string {
  return `${SELECTED_NODE_KEY}:${getCurrentFrontendNodeId()}:${getCurrentOrigin()}`;
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

function getPreferredDefaultNode(nodes: BackendNode[]): BackendNode {
  const currentNodeId = getCurrentFrontendNodeId();
  const currentOrigin = normalizeBaseUrl(getCurrentOrigin());
  return nodes.find((node) => node.id === currentNodeId)
    || nodes.find((node) => normalizeBaseUrl(node.baseUrl) === currentOrigin)
    || nodes[0]
    || { id: 'local', name: '当前节点', baseUrl: getCurrentOrigin() };
}

function mergeHeaders(initHeaders: HeadersInit | undefined, authToken: string | null): Headers {
  const headers = new Headers(initHeaders);
  if (authToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  return headers;
}

function createUnknownNodeStatuses(nodes: BackendNode[]): Record<string, NodeHealthStatus> {
  return Object.fromEntries(nodes.map((node) => [
    node.id,
    {
      nodeId: node.id,
      status: 'unknown' as const
    }
  ]));
}

export function AdminApiProvider({ children }: { children: React.ReactNode }) {
  const nodes = useMemo(() => parseBackendNodes(), []);
  const fallbackNode = useMemo(() => (
    getPreferredDefaultNode(nodes)
  ), [nodes]);
  const [selectedNodeId, setSelectedNodeIdState] = useState(fallbackNode.id);
  const [authToken, setAuthTokenState] = useState<string | null>(null);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeHealthStatus>>(() => createUnknownNodeStatuses(nodes));

  useEffect(() => {
    const storedNodeId = localStorage.getItem(getSelectedNodeStorageKey());
    if (storedNodeId && nodes.some((node) => node.id === storedNodeId)) {
      setSelectedNodeIdState(storedNodeId);
    } else {
      setSelectedNodeIdState(fallbackNode.id);
    }
    setAuthTokenState(localStorage.getItem(AUTH_TOKEN_KEY));
  }, [fallbackNode.id, nodes]);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || fallbackNode;
  const nodeById = useMemo(() => {
    return new Map(nodes.map((node) => [node.id, node]));
  }, [nodes]);

  const setSelectedNodeId = useCallback((nodeId: string) => {
    setSelectedNodeIdState(nodeId);
    localStorage.setItem(getSelectedNodeStorageKey(), nodeId);
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

  const buildNodeUrl = useCallback((nodeId: string, path: string) => {
    if (/^https?:\/\//i.test(path)) return path;
    const node = nodeById.get(nodeId) || selectedNode || fallbackNode;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${normalizeBaseUrl(node.baseUrl)}${normalizedPath}`;
  }, [fallbackNode, nodeById, selectedNode]);

  const fetchNode = useCallback((nodeId: string, path: string, init: RequestInit = {}) => {
    return fetch(buildNodeUrl(nodeId, path), {
      ...init,
      headers: mergeHeaders(init.headers, authToken),
      credentials: 'omit'
    });
  }, [authToken, buildNodeUrl]);

  const buildAdminUrl = useCallback((path: string) => {
    return buildNodeUrl(selectedNode.id, path);
  }, [buildNodeUrl, selectedNode.id]);

  const adminFetch = useCallback((path: string, init: RequestInit = {}) => {
    return fetchNode(selectedNode.id, path, init);
  }, [fetchNode, selectedNode.id]);

  const fetchAllNodes = useCallback(async <T = unknown,>(path: string, init: RequestInit = {}) => {
    return Promise.all(nodes.map(async (node) => {
      try {
        const response = await fetchNode(node.id, path, init);
        let data: T | undefined;
        try {
          data = await response.json() as T;
        } catch {
          data = undefined;
        }
        return {
          node,
          ok: response.ok,
          status: response.status,
          data,
          error: response.ok ? undefined : response.statusText
        };
      } catch (error) {
        return {
          node,
          ok: false,
          status: 0,
          error: error instanceof Error ? error.message : '网络错误'
        };
      }
    }));
  }, [fetchNode, nodes]);

  const refreshNodeStatuses = useCallback(async () => {
    const results = await Promise.all(nodes.map(async (node) => {
      const startedAt = performance.now();
      try {
        const response = await fetchNode(node.id, '/api/status');
        const latencyMs = Math.round(performance.now() - startedAt);
        const data = await response.json().catch(() => null);
        const reportedStatus = data?.data?.status;
        return [
          node.id,
          {
            nodeId: node.id,
            status: response.ok && reportedStatus === 'healthy'
              ? 'online'
              : response.ok
                ? 'degraded'
                : 'offline',
            latencyMs,
            version: data?.data?.version,
            message: response.ok ? reportedStatus : response.statusText,
            checkedAt: new Date().toISOString()
          } satisfies NodeHealthStatus
        ] as const;
      } catch (error) {
        return [
          node.id,
          {
            nodeId: node.id,
            status: 'offline',
            message: error instanceof Error ? error.message : '网络错误',
            checkedAt: new Date().toISOString()
          } satisfies NodeHealthStatus
        ] as const;
      }
    }));

    setNodeStatuses(Object.fromEntries(results));
  }, [fetchNode, nodes]);

  useEffect(() => {
    setNodeStatuses((previous) => ({
      ...createUnknownNodeStatuses(nodes),
      ...previous
    }));
  }, [nodes]);

  const value = useMemo<AdminApiContextValue>(() => ({
    nodes,
    selectedNode,
    selectedNodeId,
    setSelectedNodeId,
    nodeStatuses,
    refreshNodeStatuses,
    authToken,
    setAuthToken,
    clearAuthToken,
    adminFetch,
    buildAdminUrl,
    buildNodeUrl,
    fetchNode,
    fetchAllNodes
  }), [
    nodes,
    selectedNode,
    selectedNodeId,
    setSelectedNodeId,
    nodeStatuses,
    refreshNodeStatuses,
    authToken,
    setAuthToken,
    clearAuthToken,
    adminFetch,
    buildAdminUrl,
    buildNodeUrl,
    fetchNode,
    fetchAllNodes
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
    nodeStatuses: { [fallbackNode.id]: { nodeId: fallbackNode.id, status: 'unknown' } },
    refreshNodeStatuses: async () => {},
    authToken: typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null,
    setAuthToken: () => {},
    clearAuthToken: () => {},
    buildAdminUrl: (path: string) => path,
    buildNodeUrl: (_nodeId: string, path: string) => path,
    adminFetch: (path: string, init?: RequestInit) => fetch(path, init),
    fetchNode: (_nodeId: string, path: string, init?: RequestInit) => fetch(path, init),
    fetchAllNodes: async <T = unknown,>(path: string, init?: RequestInit) => {
      try {
        const response = await fetch(path, init);
        let data: T | undefined;
        try {
          data = await response.json() as T;
        } catch {
          data = undefined;
        }
        return [{ node: fallbackNode, ok: response.ok, status: response.status, data, error: response.ok ? undefined : response.statusText }];
      } catch (error) {
        return [{ node: fallbackNode, ok: false, status: 0, error: error instanceof Error ? error.message : '网络错误' }];
      }
    }
  };
}
