/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file was automatically generated by TanStack Router.
// You should NOT make any changes in this file as it will be overwritten.
// Additionally, you should also exclude this file from your linter and/or formatter to prevent it from being checked or modified.

// Import Routes

import { Route as rootRoute } from './routes/__root'
import { Route as LoginImport } from './routes/login'
import { Route as AuthImport } from './routes/_auth'
import { Route as AuthIndexImport } from './routes/_auth.index'
import { Route as AuthRetrosRetroIdImport } from './routes/_auth.retros.$retroId'

// Create/Update Routes

const LoginRoute = LoginImport.update({
  id: '/login',
  path: '/login',
  getParentRoute: () => rootRoute,
} as any)

const AuthRoute = AuthImport.update({
  id: '/_auth',
  getParentRoute: () => rootRoute,
} as any)

const AuthIndexRoute = AuthIndexImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => AuthRoute,
} as any)

const AuthRetrosRetroIdRoute = AuthRetrosRetroIdImport.update({
  id: '/retros/$retroId',
  path: '/retros/$retroId',
  getParentRoute: () => AuthRoute,
} as any)

// Populate the FileRoutesByPath interface

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/_auth': {
      id: '/_auth'
      path: ''
      fullPath: ''
      preLoaderRoute: typeof AuthImport
      parentRoute: typeof rootRoute
    }
    '/login': {
      id: '/login'
      path: '/login'
      fullPath: '/login'
      preLoaderRoute: typeof LoginImport
      parentRoute: typeof rootRoute
    }
    '/_auth/': {
      id: '/_auth/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof AuthIndexImport
      parentRoute: typeof AuthImport
    }
    '/_auth/retros/$retroId': {
      id: '/_auth/retros/$retroId'
      path: '/retros/$retroId'
      fullPath: '/retros/$retroId'
      preLoaderRoute: typeof AuthRetrosRetroIdImport
      parentRoute: typeof AuthImport
    }
  }
}

// Create and export the route tree

interface AuthRouteChildren {
  AuthIndexRoute: typeof AuthIndexRoute
  AuthRetrosRetroIdRoute: typeof AuthRetrosRetroIdRoute
}

const AuthRouteChildren: AuthRouteChildren = {
  AuthIndexRoute: AuthIndexRoute,
  AuthRetrosRetroIdRoute: AuthRetrosRetroIdRoute,
}

const AuthRouteWithChildren = AuthRoute._addFileChildren(AuthRouteChildren)

export interface FileRoutesByFullPath {
  '': typeof AuthRouteWithChildren
  '/login': typeof LoginRoute
  '/': typeof AuthIndexRoute
  '/retros/$retroId': typeof AuthRetrosRetroIdRoute
}

export interface FileRoutesByTo {
  '/login': typeof LoginRoute
  '/': typeof AuthIndexRoute
  '/retros/$retroId': typeof AuthRetrosRetroIdRoute
}

export interface FileRoutesById {
  __root__: typeof rootRoute
  '/_auth': typeof AuthRouteWithChildren
  '/login': typeof LoginRoute
  '/_auth/': typeof AuthIndexRoute
  '/_auth/retros/$retroId': typeof AuthRetrosRetroIdRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: '' | '/login' | '/' | '/retros/$retroId'
  fileRoutesByTo: FileRoutesByTo
  to: '/login' | '/' | '/retros/$retroId'
  id: '__root__' | '/_auth' | '/login' | '/_auth/' | '/_auth/retros/$retroId'
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  AuthRoute: typeof AuthRouteWithChildren
  LoginRoute: typeof LoginRoute
}

const rootRouteChildren: RootRouteChildren = {
  AuthRoute: AuthRouteWithChildren,
  LoginRoute: LoginRoute,
}

export const routeTree = rootRoute
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()

/* ROUTE_MANIFEST_START
{
  "routes": {
    "__root__": {
      "filePath": "__root.tsx",
      "children": [
        "/_auth",
        "/login"
      ]
    },
    "/_auth": {
      "filePath": "_auth.tsx",
      "children": [
        "/_auth/",
        "/_auth/retros/$retroId"
      ]
    },
    "/login": {
      "filePath": "login.tsx"
    },
    "/_auth/": {
      "filePath": "_auth.index.tsx",
      "parent": "/_auth"
    },
    "/_auth/retros/$retroId": {
      "filePath": "_auth.retros.$retroId.tsx",
      "parent": "/_auth"
    }
  }
}
ROUTE_MANIFEST_END */