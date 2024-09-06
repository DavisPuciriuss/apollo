import type { ClientConfig, ClientConfigFactory } from './types'

export type { ClientConfig }
export const defineApolloClient = (config: ClientConfig | ClientConfigFactory) => config
