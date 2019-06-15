import Vue from 'vue'
import { ApolloClient } from 'apollo-client'
import NuxtConfiguration from '@nuxt/config'
import * as types from '../index'

const vm = new Vue()

const apolloClient = new ApolloClient({
  link: 'dummy link' as any,
  cache: 'dummy cache' as any
})

const tokenName = 'foo'
const token = 'bar'
const tokenExpires = 1

// Nuxt config

const config: NuxtConfiguration = {
  apollo: {
    tokenName: 'yourApolloTokenName',
    tokenExpires: 10,
    includeNodeModules: true,
    authenticationType: 'Basic',
    defaultOptions: {
      $query: {
        loadingKey: 'loading',
        fetchPolicy: 'cache-and-network'
      }
    },
    errorHandler: '~/plugins/apollo-error-handler.js',
    clientConfigs: {
      default: {
        httpEndpoint: 'http://localhost:4000',
        httpLinkOptions: {
          credentials: 'same-origin'
        },
        wsEndpoint: 'ws://localhost:4000',
        tokenName: 'apollo-token',
        persisting: false,
        websocketsOnly: false
      },
      test: {
        httpEndpoint: 'http://localhost:5000',
        wsEndpoint: 'ws://localhost:5000',
        tokenName: 'apollo-token'
      },
      test2: '~/plugins/my-alternative-apollo-config.js'
    }
  }
}

// onLogin

async () => {
  await vm.$apolloHelpers.onLogin(token)
  await vm.$apolloHelpers.onLogin(token, apolloClient)
  await vm.$apolloHelpers.onLogin(token, apolloClient, tokenExpires)
  await vm.$apolloHelpers.onLogin(token, undefined, tokenExpires)
}

// onLogout

async () => {
  await vm.$apolloHelpers.onLogout()
  await vm.$apolloHelpers.onLogout(apolloClient)
}

// getToken

vm.$apolloHelpers.getToken()
vm.$apolloHelpers.getToken(tokenName)
