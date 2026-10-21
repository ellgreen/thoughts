# Signing in

`THOUGHTS_AUTH` lists the ways in, in the order the sign-in page shows them.
The default is `name`, which is how v1 worked.

```bash
THOUGHTS_AUTH=oidc,ldap,name
```

## Name (`name`)

People type a name and they're in. There's no password. A name is a label,
not an account: two people called Alex are two people, and signing in again
makes a new person. Fine on a trusted network; use LDAP or OIDC anywhere
else.

## LDAP (`ldap`)

thoughts binds to the directory as the person signing in, with the
password they type. There's no service account to create or store. Once
bound, it reads the person's own entry for their name, and, if you set a
group, checks they're in it.

| Variable | Example | |
|---|---|---|
| `THOUGHTS_LDAP_URL` | `ldaps://ldap.example.org` | Required. `ldap://` needs `THOUGHTS_LDAP_STARTTLS=true`. |
| `THOUGHTS_LDAP_BIND` | `uid={username},ou=people,dc=example,dc=org` | Required. Who to bind as; `{username}` is what they type. For Active Directory, `{username}@corp.example`. |
| `THOUGHTS_LDAP_STARTTLS` | `true` | Upgrade an `ldap://` connection to TLS before sending the password. |
| `THOUGHTS_LDAP_CA_FILE` | `/data/ldap-ca.pem` | Trust this CA for the directory's certificate. |
| `THOUGHTS_LDAP_GROUP` | `cn=retro-people,ou=groups,dc=example,dc=org` | Only members of this group can sign in. |
| `THOUGHTS_LDAP_NAME_ATTRIBUTE` | `displayName` | The attribute shown as their name. Falls back to `cn`, then the username. |
| `THOUGHTS_LDAP_BASE_DN` | `dc=corp,dc=example` | Only when `THOUGHTS_LDAP_BIND` isn't a DN (Active Directory): where to find the person's entry. |
| `THOUGHTS_LDAP_USER_FILTER` | `(userPrincipalName={bind})` | With `THOUGHTS_LDAP_BASE_DN`: how to find it. `{bind}` is the bind identity. |
| `THOUGHTS_LDAP_LABEL` | `Acme account` | What the sign-in page calls it. Default "Company account". |
| `THOUGHTS_LDAP_ALLOW_PLAINTEXT` | `true` | Allow `ldap://` without TLS. This sends passwords in the clear; only for test directories. |

Group membership is read from `memberOf` first. Many OpenLDAP servers don't
keep `memberOf`, so thoughts then asks the group itself whether it lists the
person (`member`, `uniqueMember` or `memberUid`). Both need the person to be
able to read their own entry or the group, which most directories allow.

Someone signing in through LDAP is the same person every time, keyed by
their DN, and takes the directory's current name for them.

## OpenID Connect (`oidc`)

Any OIDC provider: Okta, Entra ID, Google Workspace, Keycloak, Authentik,
Dex and so on. Register thoughts as a web application with the redirect URI
`<THOUGHTS_PUBLIC_URL>/api/auth/oidc/callback`.

| Variable | Example | |
|---|---|---|
| `THOUGHTS_PUBLIC_URL` | `https://thoughts.example.com` | Required. Where people open thoughts. |
| `THOUGHTS_OIDC_ISSUER` | `https://id.example.com` | Required. The provider's issuer URL. |
| `THOUGHTS_OIDC_CLIENT_ID` | `thoughts` | Required. |
| `THOUGHTS_OIDC_CLIENT_SECRET` | | Leave empty for a public client; PKCE is always used. |
| `THOUGHTS_OIDC_SCOPES` | `openid profile email groups` | Default `openid profile email`. |
| `THOUGHTS_OIDC_GROUP` | `retro-people` | Only people with this in their groups claim can sign in. |
| `THOUGHTS_OIDC_GROUPS_CLAIM` | `groups` | Which claim holds groups. Default `groups`. |
| `THOUGHTS_OIDC_LABEL` | `Acme SSO` | Shown as "Sign in with …". Default "Single sign-on". |

thoughts reads the provider's configuration the first time someone signs in,
not at startup, so it starts even while the provider is down. Someone
signing in through OIDC is the same person every time, keyed by the `sub`
claim, and their name comes from `name`, then `preferred_username`, then
`email`.

## Trying it locally

`internal/auth/testdata/compose.yml` runs an OpenLDAP directory (users
`priya` and `sam`, passwords `priya-password` and `sam-password`, group
`cn=retro-people,ou=groups,dc=example,dc=org`) and Dex, which signs in a
test user without a login page. `task test:auth-live` starts them, runs the
live tests and stops them again.
