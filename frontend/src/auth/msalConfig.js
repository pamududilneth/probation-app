// Fill these in from your Azure App Registration (the SPA registration, not
// the API one). clientId/authority come from the SPA registration overview
// page; redirectUri must exactly match one registered there.
export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || '<spa-client-id>',
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || '<tenant-id>'}`,
    redirectUri: import.meta.env.VITE_AZURE_REDIRECT_URI || window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

// The API scope you exposed on the API's App Registration
// (Expose an API → Add a scope), e.g. api://<api-client-id>/access_as_user
export const apiRequest = {
  scopes: [import.meta.env.VITE_AZURE_API_SCOPE || 'api://<api-client-id>/access_as_user'],
};

export const loginRequest = {
  scopes: ['openid', 'profile', 'email', ...apiRequest.scopes],
};
