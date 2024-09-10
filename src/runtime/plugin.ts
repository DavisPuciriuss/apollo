import { destr } from 'destr'
import { onError } from '@apollo/client/link/error'
import { getMainDefinition } from '@apollo/client/utilities'
import { createApolloProvider } from '@vue/apollo-option'
import { ApolloClients, provideApolloClients } from '@vue/apollo-composable'
import { ApolloClient, ApolloLink, createHttpLink, InMemoryCache, split, type DefaultContext, type GraphQLRequest } from '@apollo/client/core'
import { createPersistedQueryLink } from '@apollo/client/link/persisted-queries'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import { setContext } from '@apollo/client/link/context'
import type { ClientConfig, ErrorResponse } from '../types'
import createRestartableClient from './ws'
import { useApollo } from './composables'
import { ref, useCookie, defineNuxtPlugin, useRequestHeaders } from '#imports'
import type { Ref } from '#imports'
import { createHash } from 'crypto'

import { NuxtApollo } from '#apollo'
import type { ApolloClientKeys } from '#apollo'

const sha256 = (data: string): string => createHash('sha256').update(data).digest('hex');

export default defineNuxtPlugin((nuxtApp) => {
  const requestCookies = (process.server && NuxtApollo.proxyCookies && useRequestHeaders(['cookie'])) || undefined

  const clients = {} as Record<ApolloClientKeys, ApolloClient<any>>

  for (const [key, clientConfig] of Object.entries(NuxtApollo.clients) as [ApolloClientKeys, ClientConfig][]) {
    const getAuth = async () => {
      const token = ref<string | null>(null)

      await nuxtApp.callHook('apollo:auth', { token, client: key })

      if (!token.value) {
        if (clientConfig.tokenStorage === 'cookie') {
          if (process.client) {
            const t = useCookie(clientConfig.tokenName!).value
            if (t) { token.value = t }
          } else if (requestCookies?.cookie) {
            const t = requestCookies.cookie.split(';').find(c => c.trim().startsWith(`${clientConfig.tokenName}=`))?.split('=')?.[1]
            if (t) { token.value = t }
          }
        } else if (process.client && clientConfig.tokenStorage === 'localStorage') {
          token.value = localStorage.getItem(clientConfig.tokenName!)
        }

        if (!token.value) { return }
      }

      const authScheme = !!token.value?.match(/^[a-zA-Z]+\s/)?.[0]

      if (authScheme || clientConfig?.authType === null) { return token.value }

      return `${clientConfig?.authType} ${token.value}`
    }

    const authLink = setContext(async (_: GraphQLRequest, prevContext: DefaultContext) => {
      const auth = await getAuth()
      let _headers = ref<Record<string, string>>(prevContext.headers || {})
      await nuxtApp.callHook('apollo:appendHeaders', { client: key, request: _, headers: _headers })

      if (requestCookies && requestCookies.cookie) {
        _headers.value = { ..._headers.value, cookie: requestCookies.cookie }
      }

      if (auth) {
        _headers.value = { ..._headers.value, [clientConfig.authHeader!]: auth }
      }

      return {
        headers: {
          ..._headers.value,
        }
      }
    })

    let httpLink = createHttpLink({
      ...(clientConfig?.httpLinkOptions && clientConfig.httpLinkOptions),
      uri: (process.client && clientConfig.browserHttpEndpoint) || clientConfig.httpEndpoint,
      headers: { ...(clientConfig?.httpLinkOptions?.headers || {}) }
    });

    if (clientConfig.usePersistedQuery) {
      httpLink = createPersistedQueryLink({
        sha256,
        useGETForHashedQueries: clientConfig.httpLinkOptions?.useGETForQueries ?? false,
      }).concat(httpLink);
    }

    const errorLink = onError((err) => {
      nuxtApp.callHook('apollo:error', { client: key, error: err })
    })

    let wsLink: GraphQLWsLink | null = null

    if (process.client && clientConfig.wsEndpoint) {
      const wsClient = createRestartableClient({
        ...clientConfig.wsLinkOptions,
        url: clientConfig.wsEndpoint,
        connectionParams: async () => {
          const auth = await getAuth()

          if (!auth) { return }

          return { headers: { [clientConfig.authHeader!]: auth } }
        }
      })

      wsLink = new GraphQLWsLink(wsClient)

      nuxtApp._apolloWsClients = nuxtApp._apolloWsClients || {}

      // @ts-ignore
      nuxtApp._apolloWsClients[key] = wsClient
    }

    let link = null;

    if (!wsLink) {
      link = ApolloLink.from([errorLink, authLink, httpLink])
    } else {
      link = ApolloLink.from([
        split(({ query }) => {
          const definition = getMainDefinition(query)
          return (definition.kind === 'OperationDefinition' && definition.operation === 'subscription')
        },
        wsLink,
        authLink.concat(httpLink))
      ])
    }

    const cache = new InMemoryCache(clientConfig.inMemoryCacheOptions)

    clients[key as ApolloClientKeys] = new ApolloClient({
      link,
      cache,
      ...(NuxtApollo.clientAwareness && { name: key }),
      ...(process.server
        ? { ssrMode: true }
        : { ssrForceFetchDelay: 100 }),
      connectToDevTools: clientConfig.connectToDevTools || false,
      defaultOptions: clientConfig?.defaultOptions
    })

    if (!clients?.default && !NuxtApollo?.clients?.default && key === Object.keys(NuxtApollo.clients)[0]) {
      clients.default = clients[key as ApolloClientKeys]
    }

    const cacheKey = `_apollo:${key}`

    nuxtApp.hook('app:rendered', () => {
      nuxtApp.payload.data[cacheKey] = cache.extract()
    })

    if (process.client && nuxtApp.payload.data[cacheKey]) {
      cache.restore(destr(JSON.stringify(nuxtApp.payload.data[cacheKey])))
    }
  }

  provideApolloClients(clients)
  nuxtApp.vueApp.provide(ApolloClients, clients)
  nuxtApp.vueApp.use(createApolloProvider({ defaultClient: clients?.default as any }))
  nuxtApp._apolloClients = clients

  const defaultClient = clients?.default

  return {
    provide: {
      apolloHelpers: useApollo(),
      apollo: { clients, defaultClient }
    }
  }
})

export interface ModuleRuntimeHooks {
  'apollo:auth': (params: { client: ApolloClientKeys, token: Ref<string | null> }) => void
  'apollo:appendHeaders': (params: { client: ApolloClientKeys, request: GraphQLRequest, headers: Ref<Record<string, string>> }) => void
  'apollo:error': (params: { client: ApolloClientKeys, error: ErrorResponse }) => void
}

interface DollarApolloHelpers extends ReturnType<typeof useApollo> {}
interface DollarApollo {
  clients: Record<ApolloClientKeys, ApolloClient<any>>
  defaultClient: ApolloClient<any>
}

declare module '#app' {
  interface RuntimeNuxtHooks extends ModuleRuntimeHooks {}
  interface NuxtApp {
    $apolloHelpers: DollarApolloHelpers
    $apollo: DollarApollo
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $apolloHelpers: DollarApolloHelpers
    // @ts-ignore
    $apollo: DollarApollo
  }
}
