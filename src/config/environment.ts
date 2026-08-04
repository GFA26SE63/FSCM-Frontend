const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

const apiBaseUrl = trimTrailingSlash(
  import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:7027',
)

export const environment = {
  apiBaseUrl,
  graphqlEndpoint:
    import.meta.env.VITE_GRAPHQL_ENDPOINT ?? `${apiBaseUrl}/graphql`,
}
