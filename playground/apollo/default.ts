import { defineApolloClient, type ClientConfig } from '@nuxtjs/apollo/config'
import type { Nuxt } from '@nuxt/schema';

export default defineApolloClient((context: Nuxt): ClientConfig => {
  const runtimeConfig = context.options.runtimeConfig;

  return {
    // The GraphQL endpoint.
    httpEndpoint: runtimeConfig.public.defaultApi + '/query',

    // Provide a GraphQL endpoint to be used client-side. Overrides `httpEndpoint`.
    // browserHttpEndpoint: '/graphql',

    // See https://www.apollographql.com/docs/link/links/http.html#options
    httpLinkOptions: {
      credentials: 'same-origin'
    },

    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'cache-and-network'
      }
    },

    // Specify a websocket endpoint to be used for subscriptions.
    // The `wss` protocol is recommended in production.
    // wsEndpoint: 'ws://localhost:4000',

    // LocalStorage token
    tokenName: 'spacex-token',

    // Specify if the client should solely use WebSocket.
    // requires `wsEndpoint`.
    websocketsOnly: false
  }
})
